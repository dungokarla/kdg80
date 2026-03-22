import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(siteRoot, 'public');
const distRoot = path.join(siteRoot, 'dist');
const forbiddenExtensions = new Set(['.png', '.jpg', '.jpeg']);

async function collectForbiddenFiles(rootDir) {
  const matches = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
        matches.push(path.relative(siteRoot, entryPath));
      }
    }
  }

  await walk(rootDir);
  return matches.sort();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const offendingPublic = await collectForbiddenFiles(publicRoot);
const offendingDist = await collectForbiddenFiles(distRoot);
const festivalMediaExists = await pathExists(path.join(publicRoot, 'festival-media'));

const offenders = [
  ...offendingPublic.map((item) => `public:${item}`),
  ...offendingDist.map((item) => `dist:${item}`),
];

if (festivalMediaExists) {
  offenders.push('public:public/festival-media');
}

if (offenders.length) {
  console.error('Forbidden public asset formats detected:');
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log('Verified public assets: no png/jpg files in public or dist.');
