import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const SOURCE_URL = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/scifact.zip";
const DATA_DIR = path.resolve(process.cwd(), "data");
const ZIP_PATH = path.join(DATA_DIR, "scifact.zip");
const SCIFACT_DIR = path.join(DATA_DIR, "scifact");
const REQUIRED_FILES = {
  "corpus.jsonl": path.join(SCIFACT_DIR, "corpus.jsonl"),
  "queries.jsonl": path.join(SCIFACT_DIR, "queries.jsonl"),
  "qrels/test.tsv": path.join(SCIFACT_DIR, "qrels", "test.tsv"),
};

function sha256(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function md5(buffer: Uint8Array): string {
  return createHash("md5").update(buffer).digest("hex");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadArchive(): Promise<Uint8Array> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        throw new Error(`SciFact download failed: HTTP ${response.status} ${response.statusText}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`SciFact download attempt ${attempt}/${maxAttempts} failed; retrying shortly.`);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
  throw new Error(`SciFact download failed after ${maxAttempts} attempts: ${String(lastError)}`, { cause: lastError });
}

async function hashDatasetFiles(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const [key, filePath] of Object.entries(REQUIRED_FILES)) {
    try {
      hashes[key] = sha256(await readFile(filePath));
    } catch {
      throw new Error(`SciFact archive is missing required file: ${path.relative(DATA_DIR, filePath)}`);
    }
    console.log(`${path.relative(DATA_DIR, filePath)} SHA-256: ${hashes[key]}`);
  }
  return hashes;
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  if (await Promise.all(Object.values(REQUIRED_FILES).map(fileExists)).then((results) => results.every(Boolean))) {
    const hashes = await hashDatasetFiles();
    const manifest = {
      source: "manual download (Hugging Face mteb/scifact)",
      sha256: hashes,
    };
    await writeFile(path.join(SCIFACT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Hashed existing SciFact files and wrote manifest to ${SCIFACT_DIR}`);
    return;
  }

  let archive: Uint8Array;
  if (await fileExists(ZIP_PATH)) {
    archive = new Uint8Array(await readFile(ZIP_PATH));
    console.log(`Using existing SciFact archive: ${ZIP_PATH}`);
  } else {
    archive = await downloadArchive();
    await writeFile(ZIP_PATH, archive);
  }
  console.log(`SciFact ZIP MD5: ${md5(archive)}`);
  const entries = unzipSync(archive);

  for (const [archiveName, contents] of Object.entries(entries)) {
    const normalizedName = archiveName.replaceAll("\\", "/");
    const segments = normalizedName.split("/");
    if (
      normalizedName.startsWith("/") ||
      /^[a-z]:/i.test(normalizedName) ||
      segments.some((segment) => segment === "..")
    ) {
      throw new Error(`Unsafe path in SciFact archive: ${archiveName}`);
    }

    const outputPath = path.resolve(DATA_DIR, ...segments);
    if (outputPath !== DATA_DIR && !outputPath.startsWith(`${DATA_DIR}${path.sep}`)) {
      throw new Error(`Unsafe path in SciFact archive: ${archiveName}`);
    }
    if (normalizedName.endsWith("/")) {
      await mkdir(outputPath, { recursive: true });
    } else {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, contents);
    }
  }

  const hashes = await hashDatasetFiles();

  const manifest = {
    sourceUrl: SOURCE_URL,
    sha256: hashes,
  };
  await writeFile(path.join(SCIFACT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Downloaded and extracted SciFact to ${SCIFACT_DIR}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error("SciFact download failed:", error);
    process.exitCode = 1;
  });
}
