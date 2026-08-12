#!/usr/bin/env node
/**
 * Imports trait layer art + collection metadata from the piggy-image-composer
 * repo into this app.
 *
 *   node scripts/import-assets.mjs --source <path-to-piggy-image-composer> [--verify 25]
 *
 * Writes (all committed, because the source repo does not exist on the deploy host):
 *   public/piggy/<slug>/full/<category>/<slug>.png    preview + download
 *   public/piggy/<slug>/thumb/<category>/<slug>.png   trait grid + landing cards
 *   public/piggy/<slug>/tokens.txt                    per-token look codes
 *   lib/collections.generated.ts                      the manifest
 *
 * The script asserts rather than filters: if the source art changes shape, it
 * fails loudly instead of silently shipping something wrong.
 *
 * macOS only — uses `sips` for thumbnail encoding. PNG *reading* is done here
 * with node:zlib (encoding is the part that is easy to get subtly wrong, so
 * that is left to ImageIO).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANVAS = 1080;
const THUMB = 256;
const ALPHA_CUTOFF = 8;
const FOCUS_PAD = 0.12;

/** Look-code alphabet: 64 chars, every one unreserved in RFC 3986. */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/**
 * Source-repo knowledge. `stack` is the paint order (bottom first) lifted from
 * the Rust compositor; `categories` is an allow-list, so metadata pseudo-traits
 * ("Name", "Attribute count") and non-visual ones ("Received Mud") never leak in.
 */
const COLLECTIONS = [
  {
    slug: "piggy-sol-gang",
    meta: "piggy-sol-gang.json",
    layers: "piggy-sol-gang-layers",
    renders: "piggy-sol-gang-images",
    stack: [
      "Background",
      "Body",
      "Clothes",
      "BodyRightEar",
      "BodyHead",
      "Head",
      "BodyLeftEar",
      "Eyes",
      "Earring",
      "Mouth",
    ],
    derived: { BodyHead: "Body", BodyLeftEar: "Body", BodyRightEar: "Body" },
    categories: ["Background", "Body", "Clothes", "Eyes", "Mouth", "Head", "Earring"],
    labels: { Body: "Skin", Head: "Headwear", Earring: "Earring" },
    expectedDead: [
      "Body/outline",
      "BodyHead/outline",
      "BodyRightEar/outline",
      "Head/blue",
      "Head/green",
      "Head/outline",
      "Head/pink",
      "Head/purple",
      "Head/salmon",
      "Head/solana",
      "Head/yellow",
    ],
  },
  {
    slug: "piggy-girl-gang",
    meta: "piggy-girl-gang.json",
    layers: "piggy-girl-gang-layers",
    renders: "piggy-girl-gang-images",
    stack: [
      "Background",
      "Body",
      "Clothes",
      "BodyRightEar",
      "BodyHead",
      "Hair",
      "Hats",
      "BodyLeftEar",
      "Eyes",
      "Earring",
      "Mouth",
    ],
    derived: { BodyHead: "Body", BodyLeftEar: "Body", BodyRightEar: "Body" },
    categories: ["Background", "Body", "Clothes", "Eyes", "Mouth", "Hair", "Hats", "Earring"],
    labels: { Body: "Skin", Hats: "Hat" },
    // Clothes "None" HAS art in this collection (a censored bar) — see the
    // none-art detection in buildCollection. Give it a real name.
    traitLabels: { Clothes: { None: "Censored" } },
    expectedDead: [],
  },
];

// ---------------------------------------------------------------- utilities

function fail(message) {
  console.error(`\n  ERROR  ${message}\n`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

/** Byte-for-byte port of kebabify() in the composer's src/main.rs. */
function kebabify(value) {
  let out = "";
  let lastDash = false;
  for (const ch of value) {
    const c = ch.toLowerCase();
    if (/[a-z0-9]/.test(c) && c.charCodeAt(0) < 128) {
      out += c;
      lastDash = false;
    } else if (!lastDash) {
      out += "-";
      lastDash = true;
    }
  }
  return out.endsWith("-") ? out.slice(0, -1) : out;
}

const isNone = (value) => value === "None" || value === "No";

/** PascalCase source dir -> lowercase kebab public path segment. */
const dirSlug = (name) => kebabify(name.replace(/([a-z0-9])([A-Z])/g, "$1-$2"));

function parseArgs(argv) {
  const args = { source: null, verify: 0, renders: {} };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source") args.source = argv[++i];
    else if (argv[i] === "--verify") args.verify = Number(argv[++i] ?? 0);
    // --renders <slug>=<dir> points verification at reference renders held
    // somewhere else (piggy-sol-gang-images/ on disk is all zero-byte files;
    // the real ones only survive inside piggy-sol-gang-images.zip).
    else if (argv[i] === "--renders") {
      const [slug, dir] = String(argv[++i]).split("=");
      args.renders[slug] = dir;
    }
  }
  return args;
}

// ------------------------------------------------------------- png decoding

/** Reads IHDR only — cheap, no inflate. */
function readHeader(file) {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(33);
  fs.readSync(fd, buf, 0, 33, 0);
  fs.closeSync(fd);
  assert(buf.readUInt32BE(0) === 0x89504e47, `not a PNG: ${file}`);
  assert(buf.subarray(12, 16).toString() === "IHDR", `no IHDR: ${file}`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    depth: buf[24],
    colorType: buf[25],
    interlace: buf[28],
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes an 8-bit RGBA non-interlaced PNG to a flat Uint8Array. */
function decodeRGBA(file) {
  const buf = fs.readFileSync(file);
  const head = readHeader(file);
  assert(head.depth === 8 && head.colorType === 6 && head.interlace === 0,
    `unsupported PNG (depth ${head.depth} colorType ${head.colorType} interlace ${head.interlace}): ${file}`);

  const idat = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString();
    if (type === "IDAT") idat.push(buf.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));

  const { width, height } = head;
  const bpp = 4;
  const stride = width * bpp;
  const out = new Uint8Array(width * height * bpp);

  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[pos + x];
      const left = x >= bpp ? out[row + x - bpp] : 0;
      const up = y > 0 ? out[prev + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + ((left + up) >> 1);
      else if (filter === 4) restored = value + paeth(left, up, upLeft);
      else fail(`bad PNG filter ${filter} in ${file}`);
      out[row + x] = restored & 0xff;
    }
    pos += stride;
  }
  return { width, height, data: out };
}

/** Source-over in non-premultiplied space, matching the image crate's blend. */
function blendOver(dst, src) {
  for (let i = 0; i < dst.length; i += 4) {
    const sa = src[i + 3];
    if (sa === 0) continue;
    if (sa === 255) {
      dst[i] = src[i];
      dst[i + 1] = src[i + 1];
      dst[i + 2] = src[i + 2];
      dst[i + 3] = 255;
      continue;
    }
    const fg = sa / 255;
    const bg = dst[i + 3] / 255;
    const outA = bg + fg - bg * fg;
    if (outA === 0) {
      dst[i] = dst[i + 1] = dst[i + 2] = dst[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c += 1) {
      const f = src[i + c] / 255;
      const b = dst[i + c] / 255;
      dst[i + c] = Math.round(((f * fg + b * bg * (1 - fg)) / outA) * 255);
    }
    dst[i + 3] = Math.round(outA * 255);
  }
}

// ------------------------------------------------------------------- import

function buildCollection(config, sourceDir) {
  const layersDir = path.join(sourceDir, config.layers);
  const metaPath = path.join(sourceDir, config.meta);
  assert(fs.existsSync(layersDir), `missing layers dir: ${layersDir}`);
  assert(fs.existsSync(metaPath), `missing metadata: ${metaPath}`);

  const items = JSON.parse(fs.readFileSync(metaPath, "utf8")).result.data.items;
  const supply = items.length;

  // 1. Does an empty slot have art? Girl Gang's Clothes "None" paints a
  //    censored bar, and the shipped renders prove it (the composer's current
  //    None-skip postdates them). Where the file exists, "None" is a real
  //    trait; where it does not, it is a genuinely empty slot.
  const hasNoneArt = new Map(config.categories.map((metaName) => [
    metaName,
    ["none", "no"].some((stem) => fs.existsSync(path.join(layersDir, metaName, `${stem}.png`))),
  ]));

  // 2. Tally raw metadata values, so display-name overrides can never change
  //    a filename or the wire order.
  const counts = new Map(config.categories.map((name) => [name, new Map()]));
  const noneCounts = new Map(config.categories.map((name) => [name, 0]));
  for (const item of items) {
    for (const attr of item.attributes ?? []) {
      if (!counts.has(attr.name)) continue;
      if (isNone(attr.value) && !hasNoneArt.get(attr.name)) {
        noneCounts.set(attr.name, noneCounts.get(attr.name) + 1);
        continue;
      }
      const bucket = counts.get(attr.name);
      bucket.set(attr.value, (bucket.get(attr.value) ?? 0) + 1);
    }
  }

  // 3. Deterministic order — this IS the wire format for look codes. Sorted by
  //    slug, not label, so renaming a trait cannot repoint shared links.
  const categories = config.categories.map((metaName) => {
    const traits = [...counts.get(metaName).entries()]
      .map(([value, count]) => ({
        name: config.traitLabels?.[metaName]?.[value] ?? value,
        slug: kebabify(value),
        count,
        ext: "png",
      }))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
    assert(traits.length > 0, `${config.slug}: category ${metaName} has no traits`);
    assert(traits.length + 1 <= ALPHABET.length,
      `${config.slug}: category ${metaName} has ${traits.length} traits, over the ${ALPHABET.length}-char alphabet`);
    return {
      id: dirSlug(metaName),
      metaName,
      label: config.labels?.[metaName] ?? metaName,
      dir: dirSlug(metaName),
      noneCount: noneCounts.get(metaName),
      optional: noneCounts.get(metaName) > 0,
      traits,
    };
  });
  const byMeta = new Map(categories.map((category) => [category.metaName, category]));

  // 4. Every value resolves to a file, and every file is claimed or declared dead.
  const dead = new Set(config.expectedDead);
  const visited = new Set(config.stack);
  for (const dirName of visited) {
    const dir = path.join(layersDir, dirName);
    assert(fs.existsSync(dir), `${config.slug}: missing layer dir ${dir}`);
    const source = config.derived[dirName] ?? dirName;
    const category = byMeta.get(source);
    assert(category, `${config.slug}: stack entry ${dirName} maps to unknown category ${source}`);

    const claimed = new Set(category.traits.map((trait) => trait.slug));
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".png")) continue;
      const stem = file.slice(0, -4);
      if (claimed.has(stem)) continue;
      assert(dead.has(`${dirName}/${stem}`),
        `${config.slug}: unclaimed file ${dirName}/${file} — add it to expectedDead or fix the metadata`);
    }
    for (const trait of category.traits) {
      const file = path.join(dir, `${trait.slug}.png`);
      assert(fs.existsSync(file), `${config.slug}: ${dirName} has no art for "${trait.name}" (${trait.slug}.png)`);
      const head = readHeader(file);
      assert(head.width === CANVAS && head.height === CANVAS && head.depth === 8 && head.colorType === 6,
        `${config.slug}: ${dirName}/${trait.slug}.png is ${head.width}x${head.height} depth ${head.depth} type ${head.colorType}`);
    }
  }

  return { config, supply, items, categories, byMeta, layersDir };
}

/**
 * Union alpha bounding box across a category's art, padded and squared.
 *
 * Takes every source dir that paints this category — for Body that means
 * BodyHead and the ears too, since the `Body` dir alone is only the torso.
 */
function focusRect(dirs, traits) {
  let x0 = CANVAS;
  let y0 = CANVAS;
  let x1 = -1;
  let y1 = -1;
  for (const { dir, trait } of dirs.flatMap((dir) => traits.map((trait) => ({ dir, trait })))) {
    const { data } = decodeRGBA(path.join(dir, `${trait.slug}.png`));
    for (let y = 0; y < CANVAS; y += 1) {
      const row = y * CANVAS * 4;
      for (let x = 0; x < CANVAS; x += 1) {
        if (data[row + x * 4 + 3] <= ALPHA_CUTOFF) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };

  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  let side = Math.max(x1 - x0 + 1, y1 - y0 + 1) * (1 + FOCUS_PAD * 2);
  side = Math.min(side, CANVAS);
  const left = Math.max(0, Math.min(CANVAS - side, cx - side / 2));
  const top = Math.max(0, Math.min(CANVAS - side, cy - side / 2));
  const round = (n) => Math.round(n * 1e4) / 1e4;
  return { x: round(left / CANVAS), y: round(top / CANVAS), w: round(side / CANVAS), h: round(side / CANVAS) };
}

function copyAndThumb(built) {
  const { config, categories, layersDir } = built;
  const outRoot = path.join(ROOT, "public", "piggy", config.slug);
  fs.rmSync(outRoot, { recursive: true, force: true });

  let files = 0;
  for (const dirName of config.stack) {
    const source = config.derived[dirName] ?? dirName;
    const category = built.byMeta.get(source);
    const srcDir = path.join(layersDir, dirName);
    const segment = dirSlug(dirName);

    const fullDir = path.join(outRoot, "full", segment);
    const thumbDir = path.join(outRoot, "thumb", segment);
    fs.mkdirSync(fullDir, { recursive: true });
    fs.mkdirSync(thumbDir, { recursive: true });

    const sources = category.traits.map((trait) => path.join(srcDir, `${trait.slug}.png`));
    for (const file of sources) {
      fs.copyFileSync(file, path.join(fullDir, path.basename(file)));
      files += 1;
    }

    execFileSync("sips", ["-s", "format", "png", "-Z", String(THUMB), ...sources, "--out", thumbDir], {
      stdio: "ignore",
    });

    for (const trait of category.traits) {
      const head = readHeader(path.join(thumbDir, `${trait.slug}.png`));
      assert(head.width === THUMB && head.height === THUMB && head.colorType === 6,
        `${config.slug}: thumb ${segment}/${trait.slug}.png came out ${head.width}x${head.height} type ${head.colorType} — sips flattened it`);
    }
  }

  for (const category of categories) {
    const dirs = config.stack
      .filter((dirName) => (config.derived[dirName] ?? dirName) === category.metaName)
      .map((dirName) => path.join(layersDir, dirName));
    category.focus = focusRect(dirs, category.traits);
  }
  return { outRoot, files };
}

// -------------------------------------------------------------- look codes

function makeCodec(categories, codeOrder) {
  const slots = codeOrder.map((id) => {
    const category = categories.find((c) => c.id === id);
    return { category, values: category.optional ? [null, ...category.traits] : [...category.traits] };
  });

  const encode = (equipped) =>
    slots
      .map((slot) => {
        const index = slot.values.findIndex((value) => (value === null ? equipped[slot.category.id] === null : value.slug === equipped[slot.category.id]));
        assert(index >= 0, `cannot encode ${slot.category.id}=${equipped[slot.category.id]}`);
        return ALPHABET[index];
      })
      .join("");

  return { slots, encode };
}

/**
 * Look each token is actually wearing, as slug-per-category. A slot is empty
 * only when the collection ships no art for it, so Girl Gang's Clothes "None"
 * resolves to the censored-bar trait rather than to nothing.
 */
function lookOf(item, categories) {
  const worn = {};
  const byName = new Map((item.attributes ?? []).map((attr) => [attr.name, attr.value]));
  for (const category of categories) {
    const value = byName.get(category.metaName);
    const slug = value === undefined ? null : kebabify(value);
    worn[category.id] = slug && category.traits.some((trait) => trait.slug === slug) ? slug : null;
  }
  return worn;
}

function rarityScore(worn, categories, supply) {
  let score = 0;
  for (const category of categories) {
    const slug = worn[category.id];
    const count = slug === null
      ? category.noneCount
      : (category.traits.find((trait) => trait.slug === slug)?.count ?? 0);
    if (count > 0) score += -Math.log10(count / supply);
  }
  return score;
}

// ------------------------------------------------------------------ verify

function verifyRenders(built, sampleSize, override) {
  const { config, items, categories, layersDir } = built;
  const rendersDir = override ? path.resolve(override) : path.join(path.dirname(layersDir), config.renders);
  if (!fs.existsSync(rendersDir)) {
    console.log(`  verify: skipped, no ${config.renders}/`);
    return;
  }

  // Select from the references that actually exist rather than sampling by
  // index — a partial extraction may hold only a handful out of thousands.
  const usable = new Set(
    fs.readdirSync(rendersDir)
      .filter((file) => file.endsWith(".png") && fs.statSync(path.join(rendersDir, file)).size > 0)
      .map((file) => file.slice(0, -4)),
  );
  const candidates = items.filter((item) => usable.has(item.mint));
  const step = Math.max(1, Math.floor(candidates.length / sampleSize));

  let checked = 0;
  let worstMae = 0;
  let worstDelta = 0;

  for (let i = 0; i < candidates.length && checked < sampleSize; i += step) {
    const item = candidates[i];
    const reference = path.join(rendersDir, `${item.mint}.png`);
    const worn = lookOf(item, categories);
    const canvas = new Uint8Array(CANVAS * CANVAS * 4);
    for (const dirName of config.stack) {
      const source = config.derived[dirName] ?? dirName;
      const category = built.byMeta.get(source);
      const slug = worn[category.id];
      if (slug === null) continue;
      blendOver(canvas, decodeRGBA(path.join(layersDir, dirName, `${slug}.png`)).data);
    }

    const expected = decodeRGBA(reference).data;
    let sum = 0;
    let maxDelta = 0;
    for (let p = 0; p < canvas.length; p += 4) {
      for (let c = 0; c < 3; c += 1) {
        const delta = Math.abs(canvas[p + c] - expected[p + c]);
        sum += delta;
        if (delta > maxDelta) maxDelta = delta;
      }
    }
    const mae = sum / (CANVAS * CANVAS * 3);
    worstMae = Math.max(worstMae, mae);
    worstDelta = Math.max(worstDelta, maxDelta);
    checked += 1;
  }

  if (checked === 0) {
    console.log(`  verify: skipped, no usable reference renders`);
    return;
  }
  console.log(`  verify: ${checked} tokens, worst MAE ${worstMae.toFixed(4)}, worst channel delta ${worstDelta}`);
  assert(worstMae < 0.02 && worstDelta <= 2,
    `${config.slug}: recomposition does not match the reference renders — the layer order is wrong`);
}

// -------------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));
  assert(args.source, "pass --source <path-to-piggy-image-composer>");
  const sourceDir = path.resolve(args.source);
  assert(fs.existsSync(sourceDir), `no such directory: ${sourceDir}`);

  const manifest = {};

  for (const config of COLLECTIONS) {
    console.log(`\n${config.slug}`);
    const built = buildCollection(config, sourceDir);
    const { categories, items, supply } = built;
    console.log(`  ${supply} tokens, ${categories.length} categories, ${categories.reduce((n, c) => n + c.traits.length, 0)} traits`);

    const { files } = copyAndThumb(built);
    console.log(`  copied ${files} layers + ${files} thumbs`);

    // Stable regardless of tab order, which is presentation and may change.
    const codeOrder = categories.map((category) => category.id).sort();
    const { encode } = makeCodec(categories, codeOrder);

    const codeHash = createHash("sha256")
      .update(JSON.stringify(codeOrder.map((id) => {
        const category = categories.find((c) => c.id === id);
        return [id, category.optional, category.traits.map((trait) => trait.slug)];
      })))
      .digest("hex")
      .slice(0, 12);

    // Per-token rows: look code + 3-char rank. A row IS a look code.
    const scored = items.map((item, index) => {
      const worn = lookOf(item, categories);
      return { index, id: Number(String(item.name ?? "").replace("#", "")), worn, score: rarityScore(worn, categories, supply) };
    });
    const ids = scored.map((entry) => entry.id).sort((a, b) => a - b);
    const firstId = ids[0];
    assert(ids.every((id, i) => id === firstId + i), `${config.slug}: token ids are not contiguous`);

    const ranks = new Map();
    [...scored].sort((a, b) => b.score - a.score).forEach((entry, position) => ranks.set(entry.id, position + 1));

    const rows = new Array(supply);
    for (const entry of scored) {
      const rank = ranks.get(entry.id);
      const rankCode = ALPHABET[(rank >> 12) & 63] + ALPHABET[(rank >> 6) & 63] + ALPHABET[rank & 63];
      rows[entry.id - firstId] = encode(entry.worn) + rankCode;
    }
    const stride = codeOrder.length + 3;
    assert(rows.every((row) => row?.length === stride), `${config.slug}: row length mismatch`);

    fs.writeFileSync(
      path.join(ROOT, "public", "piggy", config.slug, "tokens.txt"),
      `v1 ${config.slug} ${stride} ${firstId} ${supply} ${codeHash}\n${rows.join("")}\n`,
    );

    const curveSource = scored.map((entry) => entry.score).sort((a, b) => a - b);
    const rarityCurve = Array.from({ length: 101 }, (_, i) =>
      Math.round(curveSource[Math.min(curveSource.length - 1, Math.floor((i / 100) * curveSource.length))] * 1e3) / 1e3);

    // Defaults: the modal look reads like a real piggy, unlike first-of-each.
    const defaultWorn = {};
    for (const category of categories) {
      defaultWorn[category.id] =
        category.noneCount > category.traits[0].count ? null : category.traits[0].slug;
    }

    // Hero: the most-dressed token, rarest among ties. Deterministic.
    const hero = [...scored].sort((a, b) => {
      const aWorn = Object.values(a.worn).filter(Boolean).length;
      const bWorn = Object.values(b.worn).filter(Boolean).length;
      return bWorn - aWorn || b.score - a.score || a.id - b.id;
    })[0];

    const bodyCategory = categories.find((category) => category.metaName === "Body");
    assert(bodyCategory, `${config.slug}: no Body category`);

    manifest[config.slug] = {
      slug: config.slug,
      supply,
      bodyCategoryId: bodyCategory.id,
      mannequinBody: bodyCategory.traits[0].slug,
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        metaName: category.metaName,
        dir: category.dir,
        optional: category.optional,
        noneCount: category.noneCount,
        focus: category.focus,
        traits: category.traits,
      })),
      stack: config.stack.map((dirName) => {
        const source = config.derived[dirName];
        return source
          ? { kind: "derived", dir: dirSlug(dirName), fromCategoryId: built.byMeta.get(source).id }
          : { kind: "category", categoryId: built.byMeta.get(dirName).id };
      }),
      codeOrder,
      codeHash,
      defaultLook: encode(defaultWorn),
      heroLook: encode(hero.worn),
      rarityCurve,
      tokens: { path: `/piggy/${config.slug}/tokens.txt`, stride, firstId, count: supply },
    };

    console.log(`  default ${manifest[config.slug].defaultLook}  hero ${manifest[config.slug].heroLook}  hash ${codeHash}`);
    if (args.verify) verifyRenders(built, args.verify, args.renders[config.slug]);
  }

  const banner = "// GENERATED by scripts/import-assets.mjs — do not edit by hand.\n";
  fs.writeFileSync(
    path.join(ROOT, "lib", "collections.generated.ts"),
    `${banner}import type { GeneratedCollection } from "./collection-types";\n\n` +
      `export const GENERATED: Record<string, GeneratedCollection> = ${JSON.stringify(manifest, null, 2)};\n`,
  );
  console.log("\nwrote lib/collections.generated.ts\n");
}

main();
