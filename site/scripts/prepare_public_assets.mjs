import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(siteRoot, '..');
const assetsRoot = path.join(workspaceRoot, 'assets');
const sourceDataRoot = path.join(workspaceRoot, 'Исходные данные');
const publicRoot = path.join(siteRoot, 'public');
const sharedAssetsRoot = path.join(publicRoot, 'shared-assets');
const festivalMediaPath = path.join(publicRoot, 'festival-media');
const telegramPngPath = path.join(publicRoot, 'generated', 'telegram', 'kenigevents-qr.png');

const ALLOWED_EXTENSIONS = new Set(['.webp', '.svg', '.woff2', '.otf', '.txt']);
const EXTRA_SHARED_ASSETS = [
  {
    sourcePath: path.join(sourceDataRoot, 'znanie main.svg'),
    destinationPath: path.join(sharedAssetsRoot, 'logo-znanie-main.svg'),
  },
  {
    sourcePath: path.join(sourceDataRoot, 'Festival logo.svg'),
    destinationPath: path.join(sharedAssetsRoot, 'logo-znanie-festival.svg'),
  },
];

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

async function copyExtraAssets(items) {
  for (const item of items) {
    try {
      await ensureDir(path.dirname(item.destinationPath));
      await fs.copyFile(item.sourcePath, item.destinationPath);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }
}

await removeIfExists(sharedAssetsRoot);
await removeIfExists(festivalMediaPath);
await removeIfExists(telegramPngPath);
await ensureDir(sharedAssetsRoot);
await copyAllowedAssets(assetsRoot, sharedAssetsRoot);
await copyExtraAssets(EXTRA_SHARED_ASSETS);

console.log('Prepared public assets without png/jpg leakage.');
