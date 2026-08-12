#!/usr/bin/env node
/**
 * Publishes the official minted renders to object storage, so the wallet picker
 * can show a piggy as it was minted.
 *
 *   node scripts/upload-renders.mjs \
 *     --source <piggy-image-composer> \
 *     --bucket s3://my-bucket/renders \
 *     [--endpoint-url https://<account>.r2.cloudflarestorage.com] \
 *     [--only piggy-sol-gang] [--stage <dir>] [--dry-run]
 *
 * Why this exists: every token's metadata points its image at
 * shdw-drive.genesysgo.net, and that host no longer resolves. GenesysGo's
 * Shadow Drive is gone, so these local files are plausibly the only surviving
 * copy of the official art — treat the sources as irreplaceable.
 *
 * Layout written to the bucket, matching NEXT_PUBLIC_RENDER_BASE_URL:
 *   <base>/<slug>/<mint>.png
 *
 * Nothing is uploaded until every file has been checked against the collection
 * metadata, and the transfer itself is `aws s3 sync`, which skips objects that
 * are already there — so an interrupted run is resumed by re-running it.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const COLLECTIONS = [
  { slug: "piggy-sol-gang", meta: "piggy-sol-gang.json", images: "piggy-sol-gang-images" },
  { slug: "piggy-girl-gang", meta: "piggy-girl-gang.json", images: "piggy-girl-gang-images" },
];

function fail(message) {
  console.error(`\n  ERROR  ${message}\n`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function parseArgs(argv) {
  const args = { source: null, bucket: null, endpoint: null, only: null, stage: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--source") args.source = argv[++i];
    else if (argv[i] === "--bucket") args.bucket = argv[++i];
    else if (argv[i] === "--endpoint-url") args.endpoint = argv[++i];
    else if (argv[i] === "--only") args.only = argv[++i];
    else if (argv[i] === "--stage") args.stage = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else fail(`unknown argument ${argv[i]}`);
  }
  return args;
}

const mintsOf = (sourceDir, config) =>
  new Set(
    JSON.parse(fs.readFileSync(path.join(sourceDir, config.meta), "utf8"))
      .result.data.items.map((item) => item.mint),
  );

/**
 * The renders, as a directory of `<mint>.png`.
 *
 * Girl Gang's are already extracted. Sol Gang's are not: the 10,000 files on
 * disk are zero-byte placeholders and the real ones live only inside the zip,
 * so that collection is unpacked into a staging directory first.
 */
function resolveRenders(sourceDir, config, staging) {
  const dir = path.join(sourceDir, config.images);
  const usable = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((file) => file.endsWith(".png")
        && fs.statSync(path.join(dir, file)).size > 0)
    : [];

  const zip = path.join(sourceDir, `${config.images}.zip`);
  if (usable.length > 0 || !fs.existsSync(zip)) return { dir, files: usable };

  const stage = path.join(staging(), config.slug);
  fs.mkdirSync(stage, { recursive: true });
  console.log(`  extracting ${path.basename(zip)} → ${stage}`);
  // -j flattens the archive's top-level dir; -x drops the __MACOSX resource
  // forks, which are not renders. -n keeps an interrupted extraction resumable.
  execFileSync("unzip", ["-n", "-j", "-q", zip, `${config.images}/*.png`, "-x", "__MACOSX/*", "-d", stage], {
    stdio: "inherit",
  });
  return {
    dir: stage,
    files: fs.readdirSync(stage).filter((file) => file.endsWith(".png") && !file.startsWith("._")),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  assert(args.source, "pass --source <path-to-piggy-image-composer>");
  assert(args.bucket || args.dryRun, "pass --bucket s3://… (or --dry-run to check only)");
  const sourceDir = path.resolve(args.source);
  assert(fs.existsSync(sourceDir), `no such directory: ${sourceDir}`);

  // Only materialised if a collection actually needs unpacking, so a run that
  // touches Girl Gang alone leaves nothing behind.
  let stageRoot = args.stage ? path.resolve(args.stage) : null;
  const staging = () => (stageRoot ??= fs.mkdtempSync(path.join(os.tmpdir(), "piggy-renders-")));

  for (const config of COLLECTIONS) {
    if (args.only && args.only !== config.slug) continue;
    console.log(`\n${config.slug}`);

    const known = mintsOf(sourceDir, config);
    const { dir, files } = resolveRenders(sourceDir, config, staging);
    assert(files.length > 0, `${config.slug}: no renders found in ${dir}`);

    // Every render must be a token of this collection, and every token should
    // have one. Uploading 3 GB of mislabelled files is not worth discovering
    // afterwards.
    const seen = new Set();
    for (const file of files) {
      const mint = file.slice(0, -4);
      assert(known.has(mint), `${config.slug}: ${file} is not a mint of this collection`);
      seen.add(mint);
    }
    const missing = [...known].filter((mint) => !seen.has(mint));
    const bytes = files.reduce((total, file) => total + fs.statSync(path.join(dir, file)).size, 0);
    console.log(`  ${files.length} renders, ${(bytes / 1024 ** 3).toFixed(2)} GiB, ${missing.length} tokens without art`);
    if (missing.length > 0) console.log(`    first missing: ${missing.slice(0, 3).join(", ")}`);

    if (args.dryRun) {
      console.log(`  dry run — would sync ${dir} → ${args.bucket ?? "<bucket>"}/${config.slug}/`);
      continue;
    }

    // `s3 sync` skips what is already uploaded, so re-running resumes.
    const target = `${args.bucket.replace(/\/$/, "")}/${config.slug}/`;
    const flags = ["s3", "sync", dir, target, "--only-show-errors", "--content-type", "image/png"];
    if (args.endpoint) flags.push("--endpoint-url", args.endpoint);
    console.log(`  aws ${flags.join(" ")}`);
    execFileSync("aws", flags, { stdio: "inherit" });
    console.log(`  uploaded ${files.length} renders`);
  }

  if (!args.stage && stageRoot) {
    console.log(`\nstaging kept at ${stageRoot} — delete it when the upload is confirmed\n`);
  }
}

main();
