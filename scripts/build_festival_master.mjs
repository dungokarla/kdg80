import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/workspaces/kdg80';
const SOURCE_V3 = path.join(ROOT, 'Исходные данные', 'festival_site_master_actual_v3.md');
const SOURCE_V4 = path.join(ROOT, 'Исходные данные', 'festival_site_master_actual_v4.md');
const OUTPUT = path.join(ROOT, 'Исходные данные', 'festival_site_master.md');

const TITLE_ALIASES_V4_TO_V3 = new Map([
  ['Открытие фестиваля «80 историй о главном»', 'Открытие фестиваля'],
  ['Калининградская область — вдохновение для писателей', 'Калининградская область -- место для поэтов'],
  ['Привычки калининградцев / Ты настоящий калининградец, если... / Калининградцы глазами гостей', 'Привычки Калининградцев / Ты настоящик Калининградец, если / Калининградцы глазами гостей'],
  ['История парусного спорта в Калининградской области', 'История парусного спорта в Калинингадской области'],
  ['Влияние планировочных решений на качество жизни на примере старого и нового Калининграда', 'Влияение планировочных решений на качество жизни на примере старого и нового Калининград'],
  ['История образования и развития национального парка «Куршская коса»', 'История образования и развития национального парка«Куршская коса»'],
  ['Иммерсивный спектакль «Этюды той весны»', '«Этюды той весны»'],
  ['10 июня 2026 — Передвижная выставка на мольбертах «Первые на косе»', 'Выставка «Первые на косе»'],
  ['25 июня 2026 — Выставка историй мирной жизни самой западной точки России', 'Выставка историй мирной жизни самой заподной точки России'],
]);

const TEMPLATE_SUMMARY_PREFIXES = [
  'лекция, которая помогает увидеть тему',
  'лекция о теме',
  'открытый разговор о теме',
  'разговор, который помогает увидеть тему',
  'возможность войти в тему',
  'выставка, которая возвращает теме',
  'спокойный, но цепкий способ войти в тему',
];

const TEMPLATE_WHYGO_PREFIXES = [
  'это способ увидеть за темой',
  'это шанс услышать не одну заготовленную позицию',
  'это хорошая точка входа во весь фестиваль',
];

const GENERIC_QUESTION_MARKERS = [
  'почему тема',
  'какие люди, решения и обстоятельства',
  'что из этого прошлого продолжает влиять',
];

const GENERIC_MYTH_MARKERS = [
  'это частная тема',
  'по этому сюжету всё давно известно',
  'этот разговор касается только прошлого',
];

function normalizeText(value) {
  return (value ?? '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^"+|"+$/g, '')
    .trim();
}

function normalizeLookup(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[«»“”"'`]/g, '')
    .replace(/[—–-]/g, ' ')
    .replace(/[.:,;!?()]/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholder(value) {
  const lookup = normalizeLookup(value);
  return !lookup
    || lookup.includes('нет цитаты')
    || lookup.includes('нет данных')
    || lookup === 'уточняется';
}

function isTemplateSummary(value) {
  const lookup = normalizeLookup(value);
  return TEMPLATE_SUMMARY_PREFIXES.some((prefix) => lookup.startsWith(normalizeLookup(prefix)));
}

function isTemplateWhyGo(value) {
  const lookup = normalizeLookup(value);
  return TEMPLATE_WHYGO_PREFIXES.some((prefix) => lookup.startsWith(normalizeLookup(prefix)));
}

function listItemCount(value) {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .length;
}

function isGenericQuestions(value) {
  const lookup = normalizeLookup(value);
  return GENERIC_QUESTION_MARKERS.every((marker) => lookup.includes(normalizeLookup(marker)));
}

function isGenericMyths(value) {
  const lookup = normalizeLookup(value);
  return GENERIC_MYTH_MARKERS.every((marker) => lookup.includes(normalizeLookup(marker)));
}

function extractField(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[^*]+:\\*\\*|$)`);
  const match = body.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function replaceField(body, labels, value, preferredLabel = labels[0]) {
  const formatted = formatField(preferredLabel, value);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*[\\s\\S]*?(?=\\n\\*\\*[^*]+:\\*\\*|$)`);
    if (pattern.test(body)) {
      return body.replace(pattern, formatted);
    }
  }

  return `${body.trim()}\n\n${formatted}`;
}

function formatField(label, value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return `**${label}:** _Нет данных._`;
  }

  const singleLine = !trimmed.includes('\n') && !trimmed.startsWith('>') && !trimmed.startsWith('-');
  return singleLine
    ? `**${label}:** ${trimmed}`
    : `**${label}:**\n${trimmed}`;
}

function splitChunks(source) {
  const [head, tail = ''] = source.split('## Подтверждённая программа');
  const chunks = tail
    .split('\n## ')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => (index === 0 ? chunk.replace(/^##\s*/, '') : chunk));

  return { head: head.trimEnd(), chunks };
}

function parseChunk(chunk) {
  const lines = chunk.split('\n');
  const heading = lines[0]?.trim() ?? '';
  const body = lines.slice(1).join('\n').trim();
  const title = heading.includes(' — ')
    ? heading.split(' — ').slice(1).join(' — ').trim().replace(/\s*:\s*$/, '')
    : heading.trim().replace(/\s*:\s*$/, '');

  return {
    raw: chunk.trim(),
    heading,
    body,
    title,
    fields: {
      format: extractField(body, 'Формат'),
      duration: extractField(body, 'Длительность') || extractField(body, 'Ориентировочная длительность'),
      date: extractField(body, 'Дата') || extractField(body, 'Период проведения'),
      time: extractField(body, 'Время') || extractField(body, 'Время посещения'),
      venue: extractField(body, 'Площадка'),
      address: extractField(body, 'Короткий адрес'),
      speaker:
        extractField(body, 'Спикер')
        || extractField(body, 'Участники')
        || extractField(body, 'Партнёр / источник материалов')
        || extractField(body, 'Рабочая привязка в таблице')
        || extractField(body, 'Связка в рабочем файле'),
      summary:
        extractField(body, 'Описание для сайта')
        || extractField(body, 'Короткое описание для афиши — версия 1')
        || extractField(body, 'Основа для описания')
        || extractField(body, 'Основа для описания / полезная фактура из таблицы'),
      baseDescription:
        extractField(body, 'Основа для описания / полезная фактура из таблицы')
        || extractField(body, 'Основа для описания'),
      whyGo:
        extractField(body, 'Цитата спикера: зачем идти именно на это событие')
        || extractField(body, 'Цитата: зачем идти именно на это событие')
        || extractField(body, 'Зачем идти на эту лекцию')
        || extractField(body, 'Зачем идти на это событие')
        || extractField(body, 'Зачем посетить выставку')
        || extractField(body, 'Зачем идти на спектакль'),
      festivalWhy:
        extractField(body, 'Цитата: зачем идти на фестиваль')
        || extractField(body, 'Зачем идти на фестиваль'),
      questions:
        extractField(body, '3 вопроса, на которые отвечает событие')
        || extractField(body, '3 вопроса, на которые отвечает лекция')
        || extractField(body, '3 вопроса, на которые отвечает выставка')
        || extractField(body, '3 вопроса, на которые отвечает спектакль'),
      myths:
        extractField(body, '3 мифа и заблуждения, с которыми работает событие')
        || extractField(body, '3 мифа и заблуждения, с которыми работает лекция')
        || extractField(body, '3 заблуждения, с которыми работает лекция')
        || extractField(body, '3 заблуждения, с которыми работает выставка')
        || extractField(body, '3 заблуждения, с которыми работает спектакль'),
      status: extractField(body, 'Статус'),
      showings: extractField(body, 'Количество показов'),
    },
  };
}

function chooseSummary(v3Chunk, v4Chunk) {
  const v3Value = v3Chunk?.fields.summary ?? '';
  const v4Value = v4Chunk.fields.summary ?? '';

  if (!v4Value) {
    return v3Value;
  }
  if (isPlaceholder(v4Value)) {
    return v3Value || v4Value;
  }
  if (!v3Value) {
    return v4Value;
  }
  if (isTemplateSummary(v3Value)) {
    return v4Value;
  }
  return v3Value;
}

function chooseWhyGo(v3Chunk, v4Chunk) {
  const v3Value = v3Chunk?.fields.whyGo ?? '';
  const v4Value = v4Chunk.fields.whyGo ?? '';

  if (v3Value && !isPlaceholder(v3Value)) {
    return v3Value;
  }
  return v4Value;
}

function chooseFestivalWhy(v3Chunk, v4Chunk) {
  const v3Value = v3Chunk?.fields.festivalWhy ?? '';
  const v4Value = v4Chunk.fields.festivalWhy ?? '';

  if (v3Value && !isPlaceholder(v3Value)) {
    return v3Value;
  }
  return v4Value;
}

function chooseListValue(v3Value, v4Value) {
  if (v3Value && !isPlaceholder(v3Value)) {
    return v3Value;
  }
  return v4Value;
}

function chooseBaseDescription(v3Chunk, v4Chunk) {
  const v3Value = v3Chunk?.fields.baseDescription ?? '';
  const v4Value = v4Chunk.fields.baseDescription ?? '';
  if (!v4Value || isPlaceholder(v4Value)) {
    return v3Value || v4Value;
  }
  return v4Value;
}

function findV3Chunk(v4Chunk, v3ByTitle) {
  const direct = v3ByTitle.get(normalizeLookup(v4Chunk.title));
  if (direct) {
    return direct;
  }

  const aliased = TITLE_ALIASES_V4_TO_V3.get(v4Chunk.title);
  if (!aliased) {
    return undefined;
  }
  return v3ByTitle.get(normalizeLookup(aliased));
}

function isSkippableHeading(heading) {
  const lookup = normalizeLookup(heading);
  return lookup === 'что еще полезно завести на сайте и в cms'
    || lookup === 'что еще пригодится для сайта и программы'
    || lookup === 'спецсобытие с датой tba';
}

function mergeChunk(v3Chunk, v4Chunk) {
  let heading = v4Chunk.heading;
  let body = v4Chunk.body;

  const mergedSummary = chooseSummary(v3Chunk, v4Chunk);
  const mergedWhyGo = chooseWhyGo(v3Chunk, v4Chunk);
  const mergedFestivalWhy = chooseFestivalWhy(v3Chunk, v4Chunk);
  const mergedQuestions = chooseListValue(v3Chunk?.fields.questions ?? '', v4Chunk.fields.questions ?? '');
  const mergedMyths = chooseListValue(v3Chunk?.fields.myths ?? '', v4Chunk.fields.myths ?? '');
  const mergedBaseDescription = chooseBaseDescription(v3Chunk, v4Chunk);

  body = replaceField(body, ['Описание для сайта', 'Короткое описание для афиши — версия 1'], mergedSummary, 'Описание для сайта');
  body = replaceField(body, ['Основа для описания / полезная фактура из таблицы', 'Основа для описания'], mergedBaseDescription, 'Основа для описания / полезная фактура из таблицы');
  body = replaceField(body, ['Цитата спикера: зачем идти именно на это событие', 'Цитата: зачем идти именно на это событие', 'Зачем идти на это событие', 'Зачем идти на эту лекцию', 'Зачем посетить выставку', 'Зачем идти на спектакль'], mergedWhyGo, 'Зачем идти на это событие');
  body = replaceField(body, ['Цитата: зачем идти на фестиваль', 'Зачем идти на фестиваль'], mergedFestivalWhy, 'Зачем идти на фестиваль');
  body = replaceField(body, ['3 вопроса, на которые отвечает событие', '3 вопроса, на которые отвечает лекция', '3 вопроса, на которые отвечает выставка', '3 вопроса, на которые отвечает спектакль'], mergedQuestions, '3 вопроса, на которые отвечает событие');
  body = replaceField(body, ['3 мифа и заблуждения, с которыми работает событие', '3 мифа и заблуждения, с которыми работает лекция', '3 заблуждения, с которыми работает лекция', '3 заблуждения, с которыми работает выставка', '3 заблуждения, с которыми работает спектакль'], mergedMyths, '3 мифа и заблуждения, с которыми работает событие');

  if (normalizeLookup(v4Chunk.title) === normalizeLookup('Иммерсивный спектакль «Этюды той весны»')) {
    heading = 'Спецсобытие — Иммерсивный спектакль «Этюды той весны»';
    body = replaceField(body, ['Ориентировочная длительность'], extractField(body, 'Ориентировочная длительность') || v3Chunk?.fields.duration || 'уточняется', 'Длительность');
    body = replaceField(body, ['Статус'], extractField(body, 'Статус') || 'Даты будут объявлены дополнительно', 'Статус');
    body = replaceField(body, ['Связка в рабочем файле'], extractField(body, 'Связка в рабочем файле') || v3Chunk?.fields.speaker || '', 'Связка в рабочем файле');
  }

  return `## ${heading}\n\n${body.trim()}`;
}

function buildMaster() {
  const sourceV3 = fs.readFileSync(SOURCE_V3, 'utf8');
  const sourceV4 = fs.readFileSync(SOURCE_V4, 'utf8');

  const { head: headV4, chunks: chunksV4 } = splitChunks(sourceV4);
  const { chunks: chunksV3 } = splitChunks(sourceV3);

  const parsedV3 = chunksV3.map(parseChunk);
  const parsedV4 = chunksV4.map(parseChunk);
  const v3ByTitle = new Map(parsedV3.map((chunk) => [normalizeLookup(chunk.title), chunk]));

  const header = [
    '# Фестиваль «80 историй о главном» — мастер-файл для сайта',
    '',
    '_Базовый редактируемый мастер-файл для сайта. Собран из `v3` и `v4`: в основе `v4`, а содержательные `whyGo` и часть редакционных блоков сохранены из `v3`, когда в `v4` есть деградация или заглушки._',
    '',
    headV4
      .split('\n')
      .slice(2)
      .join('\n')
      .trim(),
    '',
    '## Подтверждённая программа',
  ].join('\n');

  const program = parsedV4
    .filter((chunk) => !isSkippableHeading(chunk.heading))
    .map((chunk) => mergeChunk(findV3Chunk(chunk, v3ByTitle), chunk))
    .join('\n\n');

  fs.writeFileSync(OUTPUT, `${header}\n\n${program}\n`, 'utf8');
}

buildMaster();
