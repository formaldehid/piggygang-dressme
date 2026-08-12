#!/usr/bin/env node
/**
 * Imports trait layer art + collection metadata into this app.
 *
 *   node scripts/import-assets.mjs \
 *     --source <piggy-image-composer> \
 *     --art piggy-gang=<Piggy_Gang_New_Art_Files> \
 *     [--verify 8] [--renders piggy-sol-gang=<dir>]
 *
 * All three collections are metadata collections: traits, names and per-token
 * looks come from a HowRare export, so all three get real rarity and a token
 * index. They differ in how a metadata value finds its art:
 *
 *   implied — the value IS the trait name and kebabify(value) IS the filename.
 *     The two minted collections, unchanged.
 *   declared — a per-category `map` from metadata value to the new trait name.
 *     Piggy Gang is Piggy SOL Gang re-skinned, so it reads the same metadata
 *     and the trait mapping spreadsheet lives in those tables.
 *
 * Writes (all committed, because the sources do not exist on the deploy host):
 *   public/piggy/<slug>/full/<category>/<slug>.png    preview + download
 *   public/piggy/<slug>/thumb/<category>/<slug>.png   trait grid + landing cards
 *   public/piggy/<slug>/tokens.txt                    per-token look codes
 *   lib/collections.generated.ts                      the manifest
 *
 * The script asserts rather than filters: if the source art changes shape, it
 * fails loudly instead of silently shipping something wrong.
 *
 * macOS only — uses `sips` to resample and to convert Display P3 to sRGB. PNG
 * *reading* is done here with node:zlib (encoding is the part that is easy to
 * get subtly wrong, so that is left to ImageIO).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THUMB = 256;
const ALPHA_CUTOFF = 8;
const FOCUS_PAD = 0.12;
/**
 * Floor on the thumbnail crop, as a fraction of the canvas. A tiny trait like
 * an ear ring would otherwise zoom so far that the 256px thumb is upscaled
 * past legibility — Piggy Gang's Earring bbox is only 28% of the canvas.
 */
const FOCUS_MIN = 0.5;
const SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";

/** Look-code alphabet: 64 chars, every one unreserved in RFC 3986. */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/** Joins a multi-attribute lookup key. Asserted absent from every value. */
const SEP = " | ";

/**
 * Piggy Gang is Piggy SOL Gang re-skinned — the delivered art carries no
 * metadata of its own, and `Piggy Trait Mapping.xlsx` is what ties it back to
 * the mint. These tables are that spreadsheet: old SOL Gang metadata value on
 * the left, new trait name on the right.
 *
 * SOL Gang's single Earring slot splits in two. The five in PG_SPECIAL are
 * full-canvas companions and props — wings, smoke, a shotgun, an owl, a
 * gangster — not ear jewellery; the sheet marks them "Category change", and
 * they need their own z-slot to sit behind the body. Each half declares the
 * other half's values as `empty`, which is what lets the partition assertion
 * prove the split is exact.
 */
const PG_EARRING = {
  Amulet: "Diamond",
  "Gold Ring": "Gold Ring",
  Palette: "Ear Tag",
  "Red Diamond": "Pink Diamond",
  Solana: "Solana",
};
const PG_SPECIAL = {
  Earth: "Wingman",
  Gun: "Shotgun",
  Kiss: "Angel Wings",
  Weed: "Smoke",
  Western: "Mr. Lovo",
};

const COLLECTIONS = [
  {
    slug: "piggy-sol-gang",
    meta: "piggy-sol-gang.json",
    layers: "piggy-sol-gang-layers",
    renders: "piggy-sol-gang-images",
    canvas: 1080,
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
    labels: { Body: "Skin", Head: "Headwear" },
    // A stale near-duplicate of Head/ that the composer's layer order never
    // reads. Named here so the "nothing goes silently unimported" scan passes.
    skipDirs: ["Head Accesories"],
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
    canvas: 1080,
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
    // none-art probe in traitResolver. Give it a real name.
    traitLabels: { Clothes: { None: "Censored" } },
    skipDirs: [],
    expectedDead: [],
  },
  {
    slug: "piggy-gang",
    // The same 10,000 tokens as SOL Gang, wearing redrawn art. There is no
    // separate metadata export and none is needed: the token -> trait
    // assignment IS SOL Gang's, translated by the `map` tables below.
    meta: "piggy-sol-gang.json",
    // Delivered outside the composer repo, as the folder of category dirs
    // itself — hence `--art piggy-gang=<dir>`.
    layers: ".",
    externalArt: true,
    // 2000px Display P3 at 300dpi. Converted to sRGB or the browser paints the
    // wrong colours; shipped at native size.
    canvas: 2000,
    convert: true,
    // Named after the UI name, apostrophes written as "_".
    fileOf: (name) => `${name.replace(/'/g, "_")}.PNG`,
    // No `renders`: piggy-sol-gang-images/ renders the OLD art, so there is
    // nothing here a pixel-diff could prove. The order was derived by eye —
    // Special under Body so Angel Wings sits behind the shoulders, the rest
    // following the verified SOL order with the derived ear layers dropped
    // (Body here is one flat sprite already containing the head and both ears).
    stack: ["Background", "Special", "Body", "Clothes", "Head", "Eyes", "Earring", "Mouth"],
    derived: {},
    categories: [
      {
        name: "Background",
        map: { Blue: "Blue", Cyan: "Cyan", Green: "Green", Orange: "Orange",
          Purple: "Purple", Red: "Red", Yellow: "Yellow" },
      },
      {
        name: "Special",
        from: "Earring",
        attrs: ["Earring"],
        map: PG_SPECIAL,
        empty: ["None", ...Object.keys(PG_EARRING)],
        // Smoke and Angel Wings are full-canvas, so the union bbox this would
        // otherwise compute is the whole frame and the small props render as
        // smudges. Framed on those props instead; the full tier is untouched.
        focus: { x: 0, y: 0.4, w: 0.55, h: 0.55 },
      },
      {
        name: "Body",
        label: "Skin",
        // "Received Mud" is a SOL Gang trait its art never drew. Here it does,
        // so the body is keyed on both. Spelled out rather than wildcarded, so
        // you can read off that mud only changes Pink and Salmon.
        attrs: ["Body", "Received Mud"],
        map: {
          "Alien | No": "Alien", "Alien | Yes": "Alien",
          "Solana | No": "Solana", "Solana | Yes": "Solana",
          "Zombie | No": "Zombie", "Zombie | Yes": "Zombie",
          "Purple | No": "Dino", "Purple | Yes": "Dino",
          "Yellow | No": "Leopard", "Yellow | Yes": "Leopard",
          "Pink | No": "Pink", "Pink | Yes": "Boar",
          "Salmon | No": "Salmon", "Salmon | Yes": "Mud Splash",
        },
      },
      {
        name: "Clothes",
        empty: ["None"],
        map: {
          "Artist Apron": "Butcher's Apron", Blanket: "Blanket",
          "Bone Necklace": "Bone Necklace", "Fancy Sweater": "Tux",
          "Piggy Tee": "Hoodie", "Pink Leather Jacket": "Biker Leather Jacket",
          "Pocket Watch": "Cyberpunk Jacket", "Purple Shirt": "Prison Suit",
          "Red Jacket": "Tracksuit", "Rich Jacket": "Pimp Coat",
          Singlet: "Singlet", "Solana Tee": "Solana Tee", "Star Tee": "Hawaiian Tee",
        },
      },
      {
        name: "Head",
        label: "Headwear",
        empty: ["None"],
        map: {
          "Afro Hair": "Hawk's Nest", "Afro Tail": "Dreads", Beanie: "Beanie",
          Beret: "Chef's Hat", "Cowboy Hat": "Cowboy Hat", "Elf Hat": "Trucker Hat",
          Fedora: "Cap", Fez: "Durag", "Fisherman Hat": "Straw Hat", Halo: "Halo",
          "Ice Cream": "Ice Cream", "Leprechaun Hat": "Pimp Hat",
          "Mohawk Hair": "Mohawk", Mushroom: "Fly Halo", "Officer Cap": "Pork Patrol",
          "Party Hat": "Bucket Hat", "Propeller Hat": "Propeller Hat",
          "Red Hair": "Medusa", "Royal Crown": "Royal Crown", "Sailor Cap": "Pirate Hat",
          "Santa Cap": "Biker Hat", "Spiky Hair": "Robohawk", Unicorn: "Unicorn",
        },
      },
      {
        name: "Eyes",
        map: {
          "3d Glasses": "Oinkulus", Beaten: "Scar", Closed: "Pimp Glasses",
          Coin: "Coin", Crying: "Tear Drop Tattoos",
          "Dollar Sign Googles": "Dollar Sign Glasses",
          // The artist typed "Focuses" on the file. Ship the real name.
          Focused: { name: "Focused", file: "Focuses.PNG" },
          "Heart Eyes": "Urban Frames Glasses", High: "High", Hypnotize: "White Glow",
          Laser: "Laser", Monocle: "Terminator", Open: "Open",
          Sleeping: "Viper Glasses", "Star Eyes": "Pork Patrol", Wink: "Wink",
        },
      },
      {
        name: "Earring",
        map: PG_EARRING,
        empty: ["None", ...Object.keys(PG_SPECIAL)],
      },
      {
        name: "Mouth",
        map: {
          Annoyed: "Nose Ring", Beaten: "Muzzle", "Biting Brush": "Butcher's Knife",
          "Bubble Gum": "Apple", Braces: "Diamond Grills", Cigarette: "Cigarette",
          "Golden Teeth": "Golden Teeth", Lick: "Coin", Neutral: "Neutral",
          "Party Horn": "Pipe", Smiling: "Smiling", Weed: "Blunt",
        },
      },
    ],
    // `Other /` (note the trailing space) is an uncategorised drawer of loose
    // extras and alternate takes with camera-roll filenames. Left out until
    // someone names and files them.
    skipDirs: ["Other "],
    // The classic piggy, rather than the modal Salmon, behind trait thumbnails.
    mannequin: "pink",
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
  const args = { source: null, art: {}, verify: 0, renders: {} };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source") {
      // The composer repo. `meta` and `renders` always resolve under it.
      args.source = String(argv[++i]);
    } else if (argv[i] === "--art") {
      // Where one collection's layer PNGs live, when not in the composer repo.
      // Separate from --source because Piggy Gang needs both roots at once.
      const [slug, dir] = String(argv[++i]).split("=");
      args.art[slug] = dir;
    } else if (argv[i] === "--verify") {
      args.verify = Number(argv[++i] ?? 0);
    } else if (argv[i] === "--renders") {
      // Points verification at reference renders held elsewhere
      // (piggy-sol-gang-images/ on disk is all zero-byte files; the real ones
      // only survive inside piggy-sol-gang-images.zip).
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

// -------------------------------------------------------------------- build

/** The metadata-attribute tuple a category keys on, joined into one string. */
function keyOf(config, item, attrs) {
  const by = new Map((item.attributes ?? []).map((attr) => [attr.name, attr.value]));
  return attrs
    .map((name) => {
      const value = by.get(name);
      assert(value !== undefined, `${config.slug}: token ${item.name} has no "${name}" attribute`);
      assert(!value.includes(SEP), `${config.slug}: value "${value}" contains the key separator`);
      return value;
    })
    .join(SEP);
}

/**
 * Per-category lookup from a metadata key to the art it wears, or null for an
 * empty slot. Two flavours:
 *
 *   declared — `map` names, for every value the metadata can hold, the new
 *     display name (and the file, where the artist misspelled it); `empty`
 *     names the values that deliberately have no art. Between them they must
 *     partition the observed values exactly, so a new or misspelt value is a
 *     hard error rather than a silently empty slot.
 *   implied — no `map`: the value IS the display name and kebabify(value) IS
 *     the file stem, with "None"/"No" empty unless the dir ships art for it.
 *     What the minted collections have always done.
 *
 * The two key the slug differently, deliberately. Implied slugs come from the
 * raw metadata value, so a display-name override can never repoint a shared
 * link. Declared slugs come from the new name, because for redrawn art the new
 * name is the public identity and the old value is only a join key.
 */
function traitResolver(config, entry, layerDir) {
  if (entry.map) {
    const fileOf = config.fileOf ?? ((name) => `${kebabify(name)}.png`);
    const declared = new Map(Object.entries(entry.map).map(([key, value]) => {
      const art = typeof value === "string" ? { name: value } : value;
      return [key, { name: art.name, slug: kebabify(art.name), file: art.file ?? fileOf(art.name) }];
    }));
    return {
      declared: new Set([...declared.keys(), ...(entry.empty ?? [])]),
      of: (key) => declared.get(key) ?? null,
    };
  }

  // Without a table there is nothing to join a tuple on, so a multi-attribute
  // category would silently kebabify "Pink | No" into a nonsense filename.
  assert(!entry.attrs || entry.attrs.length === 1,
    `${config.slug}: ${entry.name} keys on ${entry.attrs?.length} attributes but has no map`);

  // Does an empty slot have art? Girl Gang's Clothes "None" paints a censored
  // bar, and the shipped renders prove it (the composer's current None-skip
  // postdates them). Where the file exists, "None" is a real trait.
  const hasNoneArt = ["none", "no"].some((stem) => fs.existsSync(path.join(layerDir, `${stem}.png`)));
  return {
    declared: null,
    of: (value) => (isNone(value) && !hasNoneArt ? null : {
      name: config.traitLabels?.[entry.name]?.[value] ?? value,
      slug: kebabify(value),
      file: `${kebabify(value)}.png`,
    }),
  };
}

function buildCollection(config, sourceDir, artDir) {
  const layersDir = path.join(artDir, config.layers);
  const metaPath = path.join(sourceDir, config.meta);
  assert(fs.existsSync(layersDir), `missing layers dir: ${layersDir}`);
  assert(fs.existsSync(metaPath), `missing metadata: ${metaPath}`);

  const items = JSON.parse(fs.readFileSync(metaPath, "utf8")).result.data.items;
  const supply = items.length;

  const categories = config.categories.map((raw) => {
    const entry = typeof raw === "string" ? { name: raw } : raw;
    const srcDir = entry.from ?? entry.name;
    const dir = path.join(layersDir, srcDir);
    assert(fs.existsSync(dir), `${config.slug}: missing layer dir ${dir}`);

    const attrs = entry.attrs ?? [entry.name];
    const resolver = traitResolver(config, entry, dir);

    // Tally the key tuples first, then resolve — several keys can land on one
    // trait (Purple|No and Purple|Yes both wear Dino).
    const observed = new Map();
    for (const item of items) {
      const key = keyOf(config, item, attrs);
      observed.set(key, (observed.get(key) ?? 0) + 1);
    }

    if (resolver.declared) {
      for (const key of observed.keys()) {
        assert(resolver.declared.has(key),
          `${config.slug}: ${entry.name} — metadata value "${key}" is in neither map nor empty`);
      }
      for (const key of resolver.declared) {
        assert(observed.has(key),
          `${config.slug}: ${entry.name} — "${key}" is declared but no token wears it`);
      }
    }

    const bySlug = new Map();
    let noneCount = 0;
    for (const [key, count] of observed) {
      const art = resolver.of(key);
      if (!art) {
        noneCount += count;
        continue;
      }
      const row = bySlug.get(art.slug) ?? { ...art, count: 0, ext: "png" };
      row.count += count;
      bySlug.set(art.slug, row);
    }

    // Deterministic order — this IS the wire format for look codes.
    const traits = [...bySlug.values()]
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
    assert(traits.length > 0, `${config.slug}: category ${entry.name} has no traits`);
    assert(traits.length + 1 <= ALPHABET.length,
      `${config.slug}: category ${entry.name} has ${traits.length} traits, over the ${ALPHABET.length}-char alphabet`);

    return {
      id: dirSlug(entry.name),
      name: entry.name,
      metaName: attrs.join(SEP),
      label: entry.label ?? config.labels?.[entry.name] ?? entry.name,
      dir: dirSlug(entry.name),
      srcDir,
      attrs,
      resolve: (key) => resolver.of(key)?.slug ?? null,
      focus: entry.focus,
      noneCount,
      optional: noneCount > 0,
      traits,
    };
  });
  const byName = new Map(categories.map((category) => [category.name, category]));

  const steps = config.stack.map((dirName) => {
    const source = config.derived[dirName] ?? dirName;
    const category = byName.get(source);
    assert(category, `${config.slug}: stack entry ${dirName} maps to unknown category ${source}`);
    const derived = Boolean(config.derived[dirName]);
    // Pinned to the category for a normal step: with Special carved out of the
    // Earring dir, dirSlug(stackEntry) would write full/earring/ under a
    // manifest that advertises special/.
    return {
      segment: derived ? dirSlug(dirName) : category.dir,
      srcDir: derived ? dirName : category.srcDir,
      category,
      derived,
    };
  });

  // Every file is claimed or declared dead. Accumulated per source dir, because
  // Earring feeds two categories and would otherwise flag each half as unclaimed.
  const claimedByDir = new Map();
  for (const step of steps) {
    const claimed = claimedByDir.get(step.srcDir) ?? new Set();
    // Derived layers are keyed by another category's value, so they are named
    // after the trait slug rather than carrying their own file.
    for (const trait of step.category.traits) {
      claimed.add(step.derived ? `${trait.slug}.png` : trait.file);
    }
    claimedByDir.set(step.srcDir, claimed);
  }
  const dead = new Set(config.expectedDead);
  for (const [srcDir, claimed] of claimedByDir) {
    for (const file of fs.readdirSync(path.join(layersDir, srcDir))) {
      if (!file.toLowerCase().endsWith(".png") || claimed.has(file)) continue;
      assert(dead.has(`${srcDir}/${file.slice(0, file.lastIndexOf("."))}`),
        `${config.slug}: unclaimed file ${srcDir}/${file} — add it to expectedDead or fix the map`);
    }
  }

  // And nothing in the delivery goes silently unimported.
  const skip = new Set(config.skipDirs);
  for (const entry of fs.readdirSync(layersDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || skip.has(entry.name)) continue;
    assert(steps.some((step) => step.srcDir === entry.name),
      `${config.slug}: directory "${entry.name}" is neither imported nor in skipDirs`);
  }

  return { config, supply, items, categories, steps, layersDir };
}

// -------------------------------------------------------------- copy + thumbs

/** Union alpha bounding box across a category's art, padded and squared. */
function focusRect(files, canvas) {
  let x0 = canvas;
  let y0 = canvas;
  let x1 = -1;
  let y1 = -1;
  for (const file of files) {
    const { data } = decodeRGBA(file);
    for (let y = 0; y < canvas; y += 1) {
      const row = y * canvas * 4;
      for (let x = 0; x < canvas; x += 1) {
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
  side = Math.min(Math.max(side, canvas * FOCUS_MIN), canvas);
  const left = Math.max(0, Math.min(canvas - side, cx - side / 2));
  const top = Math.max(0, Math.min(canvas - side, cy - side / 2));
  const round = (n) => Math.round(n * 1e4) / 1e4;
  return { x: round(left / canvas), y: round(top / canvas), w: round(side / canvas), h: round(side / canvas) };
}

function resample(source, target, size, convert) {
  const args = ["-s", "format", "png"];
  if (convert) args.push("--matchTo", SRGB);
  args.push("-Z", String(size), source, "--out", target);
  execFileSync("sips", args, { stdio: "ignore" });
}

function copyAndThumb(built) {
  const { config, categories, steps, layersDir } = built;
  const canvas = config.canvas;
  const outRoot = path.join(ROOT, "public", "piggy", config.slug);
  fs.rmSync(outRoot, { recursive: true, force: true });

  let files = 0;
  for (const step of steps) {
    const srcDir = path.join(layersDir, step.srcDir);
    const fullDir = path.join(outRoot, "full", step.segment);
    const thumbDir = path.join(outRoot, "thumb", step.segment);
    fs.mkdirSync(fullDir, { recursive: true });
    fs.mkdirSync(thumbDir, { recursive: true });

    for (const trait of step.category.traits) {
      const source = path.join(srcDir, trait.file);
      const head = readHeader(source);
      assert(head.width === canvas && head.height === canvas && head.depth === 8 && head.colorType === 6,
        `${config.slug}: ${step.srcDir}/${trait.file} is ${head.width}x${head.height} depth ${head.depth} type ${head.colorType}`);

      // The full tier IS the native canvas, so there is never a resize here —
      // a byte-copy unless the source needs its colour space converted.
      const fullOut = path.join(fullDir, `${trait.slug}.png`);
      if (config.convert) resample(source, fullOut, canvas, true);
      else fs.copyFileSync(source, fullOut);

      resample(source, path.join(thumbDir, `${trait.slug}.png`), THUMB, config.convert);
      files += 1;
    }

    for (const trait of step.category.traits) {
      for (const [dir, size] of [[fullDir, canvas], [thumbDir, THUMB]]) {
        const out = readHeader(path.join(dir, `${trait.slug}.png`));
        assert(out.width === size && out.height === size && out.colorType === 6,
          `${config.slug}: ${step.segment}/${trait.slug}.png came out ${out.width}x${out.height} type ${out.colorType} — sips flattened it`);
      }
    }
  }

  for (const category of categories) {
    // A union bbox is dominated by its largest member, which is wrong wherever
    // one trait is full-canvas and the rest are props. Those categories set
    // `focus` by hand; this only crops the thumbnail, never the shipped art.
    if (category.focus) continue;
    // Every source dir that paints this category — for Body in the minted
    // collections that means BodyHead and the ears too, since the `Body` dir
    // alone is only the torso.
    const sources = steps
      .filter((step) => step.category === category)
      .flatMap((step) => category.traits.map((trait) => path.join(layersDir, step.srcDir, trait.file)));
    category.focus = focusRect(sources, canvas);
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
 * Look each token is actually wearing, as slug-per-category, through the same
 * resolver that built the counts — so a row and its trait's count can never
 * disagree. A slot is empty only when the collection ships no art for it, so
 * Girl Gang's Clothes "None" resolves to the censored-bar trait rather than to
 * nothing, and a Piggy Gang earring leaves the Special slot empty.
 */
function lookOf(config, item, categories) {
  const worn = {};
  for (const category of categories) {
    worn[category.id] = category.resolve(keyOf(config, item, category.attrs));
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

function verifyRenders(built, sourceDir, sampleSize, override) {
  const { config, items, categories, layersDir, steps } = built;
  const rendersDir = override ? path.resolve(override) : path.join(sourceDir, config.renders);
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
  const canvas = config.canvas;

  let checked = 0;
  let worstMae = 0;
  let worstDelta = 0;

  for (let i = 0; i < candidates.length && checked < sampleSize; i += step) {
    const item = candidates[i];
    const reference = path.join(rendersDir, `${item.mint}.png`);
    const worn = lookOf(config, item, categories);
    const composed = new Uint8Array(canvas * canvas * 4);
    for (const layer of steps) {
      const slug = worn[layer.category.id];
      if (slug === null) continue;
      // Derived dirs are keyed by the slug; a normal layer carries its own file.
      const trait = layer.category.traits.find((candidate) => candidate.slug === slug);
      const file = layer.derived ? `${slug}.png` : trait.file;
      blendOver(composed, decodeRGBA(path.join(layersDir, layer.srcDir, file)).data);
    }

    const expected = decodeRGBA(reference).data;
    let sum = 0;
    let maxDelta = 0;
    for (let p = 0; p < composed.length; p += 4) {
      for (let c = 0; c < 3; c += 1) {
        const delta = Math.abs(composed[p + c] - expected[p + c]);
        sum += delta;
        if (delta > maxDelta) maxDelta = delta;
      }
    }
    worstMae = Math.max(worstMae, sum / (canvas * canvas * 3));
    worstDelta = Math.max(worstDelta, maxDelta);
    checked += 1;
  }

  if (checked === 0) {
    console.log("  verify: skipped, no usable reference renders");
    return;
  }
  console.log(`  verify: ${checked} tokens, worst MAE ${worstMae.toFixed(4)}, worst channel delta ${worstDelta}`);
  assert(worstMae < 0.02 && worstDelta <= 2,
    `${config.slug}: recomposition does not match the reference renders — the layer order is wrong`);
}

// -------------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Every collection, every time: the manifest is rewritten wholesale, so a
  // partial run would silently drop the collections it skipped.
  assert(args.source, "pass --source <path-to-piggy-image-composer>");
  const sourceDir = path.resolve(args.source);
  assert(fs.existsSync(sourceDir), `no such directory: ${sourceDir}`);
  const manifest = {};

  for (const config of COLLECTIONS) {
    assert(!config.externalArt || args.art[config.slug],
      `${config.slug}: pass --art ${config.slug}=<dir> — its art is not in the composer repo`);
    const artDir = args.art[config.slug] ? path.resolve(args.art[config.slug]) : sourceDir;
    assert(fs.existsSync(artDir), `no such directory: ${artDir}`);

    console.log(`\n${config.slug}`);
    const built = buildCollection(config, sourceDir, artDir);
    const { categories, items, supply } = built;
    console.log(`  ${supply} tokens, ${categories.length} categories, ${categories.reduce((n, c) => n + c.traits.length, 0)} traits`);
    for (const category of categories) {
      console.log(`    ${category.id.padEnd(11)} ${String(category.traits.length).padStart(2)} traits`
        + `  empty ${String(category.noneCount).padStart(5)}  top ${category.traits[0].slug} (${category.traits[0].count})`);
    }

    const { files } = copyAndThumb(built);
    console.log(`  wrote ${files} layers + ${files} thumbs`);

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

    const bodyCategory = categories.find((category) => category.name === "Body");
    assert(bodyCategory, `${config.slug}: no Body category`);
    const mannequin = config.mannequin ?? bodyCategory.traits[0].slug;
    assert(bodyCategory.traits.some((trait) => trait.slug === mannequin),
      `${config.slug}: mannequin "${mannequin}" is not a Body trait`);

    // Per-token rows: look code + 3-char rank. A row IS a look code.
    const scored = items.map((item) => {
      const worn = lookOf(config, item, categories);
      return { id: Number(String(item.name ?? "").replace("#", "")), worn, score: rarityScore(worn, categories, supply) };
    });
    const ids = scored.map((s) => s.id).sort((a, b) => a - b);
    const firstId = ids[0];
    assert(ids.every((id, i) => id === firstId + i), `${config.slug}: token ids are not contiguous`);

    const ranks = new Map();
    [...scored].sort((a, b) => b.score - a.score).forEach((s, position) => ranks.set(s.id, position + 1));

    const stride = codeOrder.length + 3;
    const rows = new Array(supply);
    for (const s of scored) {
      const rank = ranks.get(s.id);
      rows[s.id - firstId] = encode(s.worn)
        + ALPHABET[(rank >> 12) & 63] + ALPHABET[(rank >> 6) & 63] + ALPHABET[rank & 63];
    }
    assert(rows.every((row) => row?.length === stride), `${config.slug}: row length mismatch`);

    fs.writeFileSync(
      path.join(ROOT, "public", "piggy", config.slug, "tokens.txt"),
      `v1 ${config.slug} ${stride} ${firstId} ${supply} ${codeHash}\n${rows.join("")}\n`,
    );

    const curve = scored.map((s) => s.score).sort((a, b) => a - b);

    // Defaults: the modal look reads like a real piggy, unlike first-of-each.
    const modal = {};
    for (const category of categories) {
      modal[category.id] = category.noneCount > category.traits[0].count ? null : category.traits[0].slug;
    }

    // Hero: the most-dressed token, rarest among ties. Deterministic.
    const hero = [...scored].sort((a, b) => {
      const aw = Object.values(a.worn).filter(Boolean).length;
      const bw = Object.values(b.worn).filter(Boolean).length;
      return bw - aw || b.score - a.score || a.id - b.id;
    })[0];

    const entry = {
      slug: config.slug,
      supply,
      canvas: config.canvas,
      bodyCategoryId: bodyCategory.id,
      mannequinBody: mannequin,
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        metaName: category.metaName,
        dir: category.dir,
        optional: category.optional,
        noneCount: category.noneCount,
        focus: category.focus,
        traits: category.traits.map(({ name, slug, count, ext }) => ({ name, slug, count, ext })),
      })),
      stack: built.steps.map((step) => (step.derived
        ? { kind: "derived", dir: step.segment, fromCategoryId: step.category.id }
        : { kind: "category", categoryId: step.category.id })),
      codeOrder,
      codeHash,
      defaultLook: encode(modal),
      heroLook: encode(hero.worn),
      rarityCurve: Array.from({ length: 101 }, (_, i) =>
        Math.round(curve[Math.min(curve.length - 1, Math.floor((i / 100) * curve.length))] * 1e3) / 1e3),
      tokens: { path: `/piggy/${config.slug}/tokens.txt`, stride, firstId, count: supply },
    };

    manifest[config.slug] = entry;
    console.log(`  default ${entry.defaultLook}  hero ${entry.heroLook}  hash ${codeHash}`);
    // Gated on reference renders, not on the collection: Piggy Gang ships none,
    // because piggy-sol-gang-images/ renders the art it replaced.
    if (args.verify && config.renders) {
      verifyRenders(built, sourceDir, args.verify, args.renders[config.slug]);
    }
  }

  fs.writeFileSync(
    path.join(ROOT, "lib", "collections.generated.ts"),
    "// GENERATED by scripts/import-assets.mjs — do not edit by hand.\n"
      + 'import type { GeneratedCollection } from "./collection-types";\n\n'
      + `export const GENERATED: Record<string, GeneratedCollection> = ${JSON.stringify(manifest, null, 2)};\n`,
  );
  console.log("\nwrote lib/collections.generated.ts\n");
}

main();
