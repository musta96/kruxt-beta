#!/usr/bin/env node
import { readdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeNodeModules = args.has("--include-node-modules");

const cacheNames = new Set([
  ".expo",
  ".expo-shared",
  ".next",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist"
]);

if (includeNodeModules) {
  cacheNames.add("node_modules");
}

const exactPaths = ["supabase/.temp"];

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function dirSize(targetPath) {
  let total = 0;
  const entries = await readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);

    try {
      if (entry.isDirectory()) {
        total += await dirSize(entryPath);
      } else {
        total += (await stat(entryPath)).size;
      }
    } catch {
      // The cache may change while we inspect it. Skip unstable entries.
    }
  }

  return total;
}

async function workspaceRoots() {
  const roots = [rootDir];

  for (const folder of ["apps", "packages"]) {
    const folderPath = path.join(rootDir, folder);

    if (!(await exists(folderPath))) {
      continue;
    }

    const entries = await readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        roots.push(path.join(folderPath, entry.name));
      }
    }
  }

  return roots;
}

async function main() {
  const candidates = [];

  for (const workspaceRoot of await workspaceRoots()) {
    for (const cacheName of cacheNames) {
      const targetPath = path.join(workspaceRoot, cacheName);

      if (await exists(targetPath)) {
        candidates.push(targetPath);
      }
    }
  }

  for (const relativePath of exactPaths) {
    const targetPath = path.join(rootDir, relativePath);

    if (await exists(targetPath)) {
      candidates.push(targetPath);
    }
  }

  if (candidates.length === 0) {
    console.log("No local caches found.");
    return;
  }

  let totalBytes = 0;
  const measured = [];

  for (const targetPath of candidates) {
    const size = await dirSize(targetPath);
    totalBytes += size;
    measured.push({ targetPath, size });
  }

  const mode = dryRun ? "Would remove" : "Removing";
  console.log(`${mode} ${measured.length} local cache path(s), about ${formatBytes(totalBytes)}.`);

  for (const item of measured) {
    console.log(`- ${path.relative(rootDir, item.targetPath)} (${formatBytes(item.size)})`);

    if (!dryRun) {
      await rm(item.targetPath, { recursive: true, force: true });
    }
  }

  if (!includeNodeModules) {
    console.log("Tip: run with --include-node-modules when you want to reclaim dependency folders too.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
