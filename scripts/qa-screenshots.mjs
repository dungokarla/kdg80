/**
 * Playwright visual QA: screenshots of generated HTML tickets + modal.
 * Run from repo root:
 *   node scripts/qa-screenshots.mjs
 *   node scripts/qa-screenshots.mjs test-results/visual-qa-2026-03-23T11-41-55
 */
import pkg from '/workspaces/kdg80/site/node_modules/playwright/index.js';
const { chromium } = pkg;
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function resolveArtifactsDir() {
  const explicitArg = process.argv[2];
  if (explicitArg) {
    return path.resolve(ROOT, explicitArg);
  }

  const testResultsRoot = path.join(ROOT, 'test-results');
  const candidate = fs.readdirSync(testResultsRoot)
    .filter((entry) => entry.startsWith('visual-qa-'))
    .map((entry) => ({
      entry,
      fullPath: path.join(testResultsRoot, entry),
      mtimeMs: fs.statSync(path.join(testResultsRoot, entry)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];

  if (!candidate) {
    throw new Error('No visual-qa-* directory found in test-results. Pass the artifacts directory explicitly.');
  }

  return candidate.fullPath;
}

const ARTIFACTS_DIR = resolveArtifactsDir();
const OUT_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function shot(page, name, width = 1280, height = 800) {
  await page.setViewportSize({ width, height });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
  console.log('  screenshot:', name);
}

// --- HTML Ticket screenshots ---
for (const caseId of ['short-title', 'friedland-gate', 'long-title']) {
  const htmlPath = path.join(ARTIFACTS_DIR, caseId, 'index.html');
  const url = `file://${htmlPath}`;

  const page = await browser.newPage();
  await page.goto(url);

  await shot(page, `html-${caseId}-desktop.png`, 1280, 900);
  await shot(page, `html-${caseId}-mobile.png`, 390, 844);

  await page.close();
}

// --- Registration modal (site dev server must NOT be required; use static dist) ---
// Take modal screenshot from the built site's schedule page if available.
const siteDist = path.join(ROOT, 'site', 'dist');
const schedulePath = path.join(siteDist, 'programma', 'index.html');

if (fs.existsSync(schedulePath)) {
  const modalPage = await browser.newPage();
  await modalPage.goto(`file://${schedulePath}`);
  await modalPage.setViewportSize({ width: 1280, height: 900 });
  await modalPage.waitForLoadState('load');
  await modalPage.screenshot({ path: path.join(OUT_DIR, 'schedule-desktop.png'), fullPage: false });
  console.log('  screenshot: schedule-desktop.png');

  // Mobile sheet
  await modalPage.setViewportSize({ width: 390, height: 844 });
  await modalPage.screenshot({ path: path.join(OUT_DIR, 'schedule-mobile.png'), fullPage: false });
  console.log('  screenshot: schedule-mobile.png');

  await modalPage.close();
}

await browser.close();
console.log('\nScreenshots saved to:', OUT_DIR);
