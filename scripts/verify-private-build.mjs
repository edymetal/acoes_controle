import { readdir } from "node:fs/promises";
import path from "node:path";

const BUILD_DIRECTORY = path.resolve("dist");
const FORBIDDEN_DATA_FILES = new Set([
  "portfolio.json",
  "fiis.json",
  "crypto.json",
  "fixed-income.json",
  "evolution.json",
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    if (entry.isFile()) files.push(entryPath);
  }

  return files;
}

const publishedFiles = await listFiles(BUILD_DIRECTORY);
const exposedDataFiles = publishedFiles.filter((filePath) =>
  FORBIDDEN_DATA_FILES.has(path.basename(filePath)),
);

if (exposedDataFiles.length > 0) {
  const relativePaths = exposedDataFiles
    .map((filePath) => path.relative(BUILD_DIRECTORY, filePath))
    .join(", ");
  throw new Error(`O build contém datasets financeiros públicos: ${relativePaths}`);
}

console.log("Privacidade verificada: nenhum dataset financeiro foi incluído no build.");
