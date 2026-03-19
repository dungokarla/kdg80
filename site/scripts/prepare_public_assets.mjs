import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(siteRoot, '..');
const assetsRoot = path.join(workspaceRoot, 'assets');
const publicRoot = path.join(siteRoot, 'public');
const sharedAssetsRoot = path.join(publicRoot, 'shared-assets');
const festivalMediaPath = path.join(publicRoot, 'festival-media');
const telegramPngPath = path.join(publicRoot, 'generated', 'telegram', 'kenigevents-qr.png');

const ALLOWED_EXTENSIONS = new Set(['.webp', '.svg', '.woff2', '.otf', '.txt']);

async function removeIfExists(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyAllowedAssets(sourceDir, destinationDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await ensureDir(destinationPath);
      await copyAllowedAssets(sourcePath, destinationPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    await ensureDir(path.dirname(destinationPath));
    await fs.copyFile(sourcePath, destinationPath);
  }
}

await removeIfExists(sharedAssetsRoot);
await removeIfExists(festivalMediaPath);
await removeIfExists(telegramPngPath);
await ensureDir(sharedAssetsRoot);
await copyAllowedAssets(assetsRoot, sharedAssetsRoot);

console.log('Prepared public assets without png/jpg leakage.');
