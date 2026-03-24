/**
 * Standalone artifact generator for visual QA.
 * Usage: npx tsx scripts/gen-test-artifacts.ts
 * Outputs to: test-results/visual-qa-<timestamp>/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StoragePublisher, TicketArtifactBundle } from '../src/lib/storage.js';
import { publishTicketArtifacts } from '../src/services/ticket-artifacts.js';

const DIR = fileURLToPath(new URL('../../test-results/visual-qa-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'), import.meta.url));

fs.mkdirSync(DIR, { recursive: true });

const CASES = [
  {
    label: 'short-title',
    eventSlug: 'razgovory-o-more',
    title: 'Разговоры о море',
    startsAt: '2026-04-16T13:00:00.000Z', // 16:00 Kaliningrad
    venueName: 'Музей Мирового океана',
    hallName: 'ОКЕАНиЯ',
    address: 'Набережная Петра Великого, 1',
  },
  {
    label: 'friedland-gate',
    eventSlug: 'sovetskoe-monumentalnoe-iskusstvo-na-territorii-kaliningradskoy-oblasti',
    title: 'Советское монументальное искусство на территории Калининградской области',
    startsAt: '2026-04-03T15:30:00.000Z', // 18:30 Kaliningrad
    venueName: 'Музей «Фридландские ворота»',
    hallName: 'Корпус Блокгауз',
    address: 'улица Дзержинского, 30, вход через музейный дворик',
  },
  {
    label: 'long-title',
    eventSlug: 'privychki-kaliningradtsev-yumor-sueveriya-ne-tolko-podrostkovye-strashilki-legendy-kaliningradskih-dvorov',
    title: 'Привычки калининградцев, юмор, суеверия не только подростковые, страшилки, легенды калининградских дворов',
    startsAt: '2026-05-14T15:30:00.000Z',
    venueName: 'Калининградская областная научная библиотека',
    hallName: 'Лекционный зал, 4 этаж',
    address: 'проспект Мира, 9/11',
  },
];

for (const c of CASES) {
  console.log(`\n=== ${c.label} ===`);
  const caseDir = path.join(DIR, c.label);
  fs.mkdirSync(caseDir, { recursive: true });

  const publisher: StoragePublisher = {
    async publishTicketArtifacts(bundle: TicketArtifactBundle) {
      for (const file of bundle.files) {
        const dest = path.join(caseDir, path.basename(file.key));
        fs.writeFileSync(dest, file.body);
        console.log('  wrote', path.relative(process.cwd(), dest));
      }
      const base = `file://${caseDir}/`;
      return {
        ticketUrl: base + 'index.html',
        pdfUrl: base + 'ticket.pdf',
        icsUrl: base + 'event.ics',
      };
    },
  };

  await publishTicketArtifacts(publisher, {
    publicHash: `qa-${c.label}-hash`,
    shortTicketId: 'QATEST',
    ticketBaseUrl: 'https://kdg80.ru',
    ticketsPrefix: 'tickets',
    fullName: 'Тестовый Пользователь',
    email: 'test@example.com',
    phone: '+79001234567',
    ...c,
  });
}

console.log('\nDone. Artifacts at:', DIR);
