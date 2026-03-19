import fs from 'node:fs';
import path from 'node:path';
import mediaManifest from '../data/media-manifest.json';
import summaryOverrides from '../data/summary-overrides.json';

type MediaManifest = {
  events: Record<string, string>;
  speakers: Record<string, string[]>;
};

const media = mediaManifest as MediaManifest;
const curatedSummaries = summaryOverrides as Record<string, string>;

type FestivalEventKind = 'dated' | 'range' | 'special';

export type RelatedFestivalEvent = {
  slug: string;
  title: string;
  formatLabel: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  address: string;
  speakerLabel: string;
  kind: FestivalEventKind;
  relationLabel: string;
};

export type SpeakerLectureLink = {
  slug: string;
  title: string;
  dateLabel: string;
};

export type FestivalDialogueParticipant = {
  name: string;
  affiliation: string;
  images: string[];
};

export type SpeakerShowcaseEntry = {
  name: string;
  affiliation: string;
  images: string[];
  anchor: string;
  appearances: number;
  weight: number;
};

export type FestivalEvent = {
  slug: string;
  title: string;
  format: string;
  formatLabel: string;
  dateLabel: string;
  monthLabel: string;
  monthAnchor: string;
  timeLabel: string;
  durationLabel: string;
  venue: string;
  address: string;
  city: string;
  speakerLabel: string;
  affiliation: string;
  showingsLabel: string;
  summary: string;
  whyGo: string;
  registrationUrl?: string;
  calendarReady: boolean;
  googleCalendarUrl?: string;
  icsUrl?: string;
  calendarNote?: string;
  image?: string;
  speakerImages: string[];
  dialogueParticipants: FestivalDialogueParticipant[];
  kind: FestivalEventKind;
  isoStart?: string;
  relatedEvent?: RelatedFestivalEvent;
  speakerLectureLinks: SpeakerLectureLink[];
};

const MONTHS: Record<string, { number: string; label: string; anchor: string }> = {
  января: { number: '01', label: 'Январь', anchor: 'january' },
  февраля: { number: '02', label: 'Февраль', anchor: 'february' },
  марта: { number: '03', label: 'Март', anchor: 'march' },
  апреля: { number: '04', label: 'Апрель', anchor: 'april' },
  мая: { number: '05', label: 'Май', anchor: 'may' },
  июня: { number: '06', label: 'Июнь', anchor: 'june' },
  июля: { number: '07', label: 'Июль', anchor: 'july' },
};

const ROOT_DIR = path.resolve(process.cwd(), '..');
const MASTER_PATH = path.resolve(ROOT_DIR, 'Исходные данные', 'festival_site_master.md');
const DEFAULT_CITY = 'Калининград';
const SPEAKER_SHOWCASE_KEYWORD_WEIGHTS: Array<{ pattern: RegExp; bonus: number }> = [
  { pattern: /доктор|д\.\s*н\./i, bonus: 3.2 },
  { pattern: /к\.\s*[а-я]\.\s*н\.|кандидат/i, bonus: 2.4 },
  { pattern: /профессор/i, bonus: 3 },
  { pattern: /президент/i, bonus: 3.1 },
  { pattern: /директор/i, bonus: 2.4 },
  { pattern: /основател/i, bonus: 1.8 },
  { pattern: /третьяковск|музей мирового океана/i, bonus: 2.2 },
  { pattern: /музей/i, bonus: 1 },
  { pattern: /архитектор/i, bonus: 1.4 },
  { pattern: /автор книги|писатель|поэт/i, bonus: 1.6 },
  { pattern: /краевед/i, bonus: 1.2 },
  { pattern: /экскурсовод/i, bonus: 0.8 },
  { pattern: /специалист/i, bonus: 1 },
  { pattern: /волонт[её]р/i, bonus: 0.5 },
];
const SPEAKER_SHOWCASE_NAME_BONUSES: Array<{ match: string; bonus: number }> = [
  { match: 'Ярцев', bonus: 3.4 },
  { match: 'Сивкова', bonus: 3.1 },
  { match: 'Попадин', bonus: 2.8 },
  { match: 'Мосиенко', bonus: 2.6 },
  { match: 'Илюшкина', bonus: 2.4 },
  { match: 'Надымова', bonus: 2.2 },
  { match: 'Конюхова', bonus: 2.1 },
  { match: 'Долотова', bonus: 1.9 },
  { match: 'Криммель', bonus: 1.8 },
  { match: 'Марковец', bonus: 1.6 },
];

const EVENT_IMAGE_MAP: Array<{ title: string; speaker: string; manifestKeys: string[] }> = [
  {
    title: 'Советское монументальное искусство на территории Калининградской области',
    speaker: 'Мосиенко',
    manifestKeys: ['Советское монументальное искусство - Мосиенко'],
  },
  {
    title: 'Мост, который соединяет времена. Двухъярусный мост - прошлое, настоящее и будущее.',
    speaker: 'Мосиенко',
    manifestKeys: ['Мосты времени - Мосиенко'],
  },
  {
    title: 'Калининградская область -- место для поэтов',
    speaker: 'Ярцев',
    manifestKeys: ['Калининград - город поэтов - Ярцев'],
  },
  {
    title: 'Люди, которых унесли птицы (Биостанция Рыбачий в советское время)',
    speaker: 'Марковец',
    manifestKeys: ['Люди как птицы - Марковец'],
  },
  {
    title: 'История парусного спорта в Калинингадской области',
    speaker: 'Жадобко',
    manifestKeys: ['Яхты2 - Жадобко', 'Яхты1 - Жадобко'],
  },
  {
    title: 'Калининградский морской торговый порт: яркие страницы советской истории и современность.',
    speaker: 'Нижегородцева',
    manifestKeys: ['Торговый порт - Нижегородцева'],
  },
  {
    title: 'Кирха - склад - спортзал - музей. Сложный путь культовых учреждений из забвения к возрождению',
    speaker: 'Долотова',
    manifestKeys: ['Кирхи, форты - Долотова'],
  },
  {
    title: 'Архитектура советского Калининграда (1946 - 1960 годы)',
    speaker: 'Попадин',
    manifestKeys: ['Советская архитектура - Попадин'],
  },
  {
    title: 'Великие учителя. Преемственность художественных поколений.',
    speaker: 'Илюшкина',
    manifestKeys: ['Великие учителя - Илюшкина'],
  },
  {
    title: 'Виштынецкая возвышенность: как осваивали с 1945 года, современность и перспективы',
    speaker: 'Соколов',
    manifestKeys: ['Виштынец - Соколов Алексей'],
  },
  {
    title: 'Денежное обращение в послевоенный период 1945-1947',
    speaker: 'Перкусов',
    manifestKeys: ['Деньги до 1947 года - Перкусов'],
  },
  {
    title: 'История становления и развития малых городов Калининградской области на примере п. Железнодорожный',
    speaker: 'Казакова',
    manifestKeys: ['Железнодорожный развитие малых городоа - Казакова'],
  },
  {
    title: 'Космическая орбита Калининграда',
    speaker: 'Селин',
    manifestKeys: ['Космическая орбита Калининграда - Селин'],
  },
  {
    title: 'Калининград и область как кинодекорация — история съёмок художественных фильмов в регионе',
    speaker: 'Бойко',
    manifestKeys: ['Калининград в кино - Бойко'],
  },
  {
    title: 'О чём мечтали в советском Калининграде, куда стремились и куда попали',
    speaker: 'Литвинович',
    manifestKeys: ['О чём мечтали в советском Калининграде - Литвинович'],
  },
  {
    title: 'Первые на косе',
    speaker: 'Цедрик',
    manifestKeys: ['Первые на косе - Цедрик'],
  },
  {
    title: 'Советский Гусев-время созиданий',
    speaker: 'Ситникова',
    manifestKeys: ['Советский Гусев - Ситникова'],
  },
  {
    title: 'Привычки калининградцев, юмор, суеверия не только подростковые, страшилки, легенды калининградских дворов',
    speaker: 'Никитин',
    manifestKeys: ['Калининрадские суеверия и привычки - Никитин'],
  },
  {
    title: 'Восприятие новой родины переселенцами (как воспринимали Восточная Пруссия)',
    speaker: 'Левченков',
    manifestKeys: ['Восприятие новой родины - Левченков'],
  },
  {
    title: 'Право на существование: зоопарки в современном мире. Перспективы развития Калининградского зоопарка',
    speaker: 'Соколова',
    manifestKeys: ['Зоопарк - Соколова'],
  },
  {
    title: 'Ностальгический разговор',
    speaker: 'Попадин',
    manifestKeys: ['Ностальгический  разговор - Попадин'],
  },
  {
    title: 'Что таит в себе главное памятное место Калининграда, мемориал 1200 гвардейцев',
    speaker: 'Перкусов',
    manifestKeys: ['1200 гвардейцев - Перкусов'],
  },
  {
    title: 'География исследований Мирового океана калининградскими океанологами в советское время',
    speaker: 'Чечко',
    manifestKeys: ['Исследования советских океанографов - Чечко (2)'],
  },
  {
    title: 'Калининград 2125: каким может стать город через сто лет',
    speaker: 'Сарниц',
    manifestKeys: ['Калининград 2125 - Сарниц'],
  },
  {
    title: 'Голубые ладони города К. Восстановление водопроводной системы в послевоенном Калининграде',
    speaker: 'Долотова',
    manifestKeys: ['Голубые ладони Калининграда - Долотова'],
  },
  {
    title: 'Приморский (Зеленоградский) район Калининградской области в советское время на этапе становления',
    speaker: 'Ефремов',
    manifestKeys: ['Зеленоградский район - Ефремов'],
  },
  {
    title: '“Кладомания” и городской фольклор: почему мы верим в скрытые сокровища',
    speaker: 'Долотова',
    manifestKeys: ['Клады - Долотова'],
  },
  {
    title: 'История образования и развития национального парка«Куршская коса',
    speaker: 'Скребцова',
    manifestKeys: ['Образование куршской косы - Скребкова'],
  },
  {
    title: 'Рыба на каждом столе: в ресторане и дома. Праздничный стол по- калининградски',
    speaker: 'Конюхова',
    manifestKeys: ['Праздничный стол по-калининградски рыба в каждый дом - Конюхова'],
  },
  {
    title: 'Мирная жизнь самой западной точки России (Балтийской косы)',
    speaker: 'Надымова',
    manifestKeys: ['Самая западная точка России Балтийская коса - Надымова'],
  },
  {
    title: 'История Светлогорска в семейном альбоме',
    speaker: 'Быстрова',
    manifestKeys: ['Светлогорск - Быстрова'],
  },
  {
    title: 'Этюды той весны',
    speaker: 'Никитин',
    manifestKeys: ['Этюды той весны - 1', 'Этюды той весны - 2', 'Этюды той весны - 3'],
  },
  {
    title: 'Восстановление янтарного карьера и Янтарный комбинат в послевоенные годы.',
    speaker: 'Криммель',
    manifestKeys: ['Янтарный комбинат - Криммель'],
  },
  {
    title: 'Природа чемодана',
    speaker: 'Никитин',
    manifestKeys: ['Природа чемодана - Никитин'],
  },
  {
    title: 'Заводы и пароходы. Постсоветское индустриальное наследие Калининграда.',
    speaker: 'Мосиенко',
    manifestKeys: ['Индустриальное наследие - Мосиенко'],
  },
  {
    title: 'Зоопарку – быть! Зоопарк – трофей 1945 года и один из первых очагов мирной жизни в Калининграде',
    speaker: 'Левкова',
    manifestKeys: ['Зоопарку быть - Левкова'],
  },
  {
    title: 'Человек, заложивший фундамент современного Калининграда. Виктор Денисов и его эпоха.',
    speaker: 'Машинская',
    manifestKeys: ['Денисов - Машинская'],
  },
  {
    title: 'Демография первого десятилетия Калининградской области',
    speaker: 'Манкевич',
    manifestKeys: ['Демография - Манкевич'],
  },
  {
    title: 'Памятники искусства и истории в ландшафте Калининградского зоопарка',
    speaker: 'Колбанёва',
    manifestKeys: ['Скульптуры зоопарка - Колбанёва'],
  },
  {
    title: 'Зелёная память: история Ботанического сада Калининграда',
    speaker: 'Усманова',
    manifestKeys: ['Ботанический сад - Усманова'],
  },
  {
    title: 'Курсанты с крылышками, Калининградское ВАТУ, и влияние на Калининград',
    speaker: 'Перкусов',
    manifestKeys: ['КВАТУ Курсанты с крылышками - Перкусов'],
  },
  {
    title: 'Калининградское здравоохранение в период становления области: особенности, вызовы, победы и проблемы.',
    speaker: 'Манкевич',
    manifestKeys: ['Здравоохранение - Манкевич'],
  },
  {
    title: 'Влияение планировочных решений на качество жизни на примере старого и нового Калининград',
    speaker: 'Анисимов',
    manifestKeys: ['Планировочные решения - Анисимов'],
  },
];

const SPEAKER_MANIFEST_KEYS = Object.keys(media.speakers);

const RELATED_EVENT_BINDINGS: Array<{
  lectureTitleMatches: string[];
  lectureSpeakerMatch: string;
  exhibitionTitleMatches: string[];
}> = [
  {
    lectureTitleMatches: ['Первые на косе'],
    lectureSpeakerMatch: 'Цедрик',
    exhibitionTitleMatches: ['Выставка Первые на косе'],
  },
  {
    lectureTitleMatches: ['Мирная жизнь самой западной точки России'],
    lectureSpeakerMatch: 'Надымова',
    exhibitionTitleMatches: [
      'Выставка историй мирной жизни самой заподной точки России',
      'Выставка историй мирной жизни самой западной точки России',
    ],
  },
];

const EXHIBITION_LOCATION_OVERRIDES: Array<{
  titleMatches: string[];
  venue: string;
}> = [
  {
    titleMatches: ['Выставка «Первые на косе»', 'Выставка Первые на косе'],
    venue: 'Лекционный зал, 4 этаж',
  },
  {
    titleMatches: [
      'Выставка историй мирной жизни самой заподной точки России',
      'Выставка историй мирной жизни самой западной точки России',
    ],
    venue: 'Лекционный зал, 4 этаж',
  },
];

let cache: FestivalEvent[] | null = null;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractField(body: string, label: string) {
  const pattern = new RegExp(`\\*\\*${escapeRegex(label)}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`);
  const match = body.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function extractFirst(body: string, labels: string[]) {
  for (const label of labels) {
    const value = extractField(body, label);
    if (value) {
      return value;
    }
  }
  return '';
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^"+|"+$/g, '')
    .trim();
}

function sanitizeListEntry(value: string) {
  return normalizeText(
    value
      .replace(/^[—–•-]+\s*/, '')
      .replace(/^\d+\s+/, '')
      .replace(/^Миф\s*№?\d+:\s*/i, '')
      .replace(/^[«"]+|[»"]+$/g, ''),
  );
}

function lowercaseFirst(value: string) {
  if (!value) {
    return '';
  }
  return `${value.slice(0, 1).toLowerCase()}${value.slice(1)}`;
}

function capitalizeFirst(value: string) {
  if (!value) {
    return '';
  }
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function joinNatural(items: string[]) {
  if (!items.length) {
    return '';
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} и ${items[1]}`;
  }
  return `${items.slice(0, -1).join(', ')} и ${items.at(-1)}`;
}

function extractListItems(body: string, label: string) {
  return extractField(body, label)
    .split('\n')
    .map((line) => sanitizeListEntry(line))
    .filter(Boolean);
}

function startsWithTemplateLead(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.startsWith('лекция, которая помогает увидеть тему')
    || normalized.startsWith('лекция о теме')
    || normalized.startsWith('открытый разговор о теме');
}

function isGenericQuestionSet(items: string[]) {
  if (items.length < 3) {
    return false;
  }

  const [first, second, third] = items.map((item) => item.toLowerCase());
  return first.includes('почему') && second.includes('какие люди') && third.includes('что из этого прошлого');
}

function isGenericMythSet(items: string[]) {
  if (items.length < 3) {
    return false;
  }

  const normalized = items.map((item) => item.toLowerCase());
  return normalized[0].includes('частная тема')
    && normalized[1].includes('всё давно известно')
    && normalized[2].includes('касается только прошлого');
}

function toSentence(value: string) {
  const cleaned = normalizeText(value).replace(/[;:]+$/g, '').trim();
  if (!cleaned) {
    return '';
  }
  return /[.!?…]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function normalizeQuestionFragment(value: string) {
  return sanitizeListEntry(value)
    .replace(/^Клады\s*[-–—]\s*как\s+пополнение\s+музейных\s+экспозиций/i, 'как находки пополняют музейные экспозиции')
    .replace(/^Клады\s*[-–—]\s*как\b/i, 'как клады')
    .replace(/^Изучение\s+истории\s+края,\s*посредством\s+поиска\s+кладов/i, 'что поиск кладов рассказывает об истории края')
    .replace(/^Почему\s+город\s+Балтийск\s+часть\s+Балтийской\s+косы/i, 'почему Балтийск и Балтийская коса неразделимы')
    .replace(/^Почему\s+все\s+последние\s+80\s+лет\s+Балтийская\s+коса\s+является\s+территорией\s+мужества\s+и\s+силы\s+духа/i, 'почему Балтийская коса все последние 80 лет остаётся территорией мужества и силы духа')
    .replace(/^Как\s+связана\s+мирная\s+жизнь\s+запада\s+России\s+с\s+Морской\s+Авиацией\s+и\s+ВМФ/i, 'как мирная жизнь западной точки России связана с морской авиацией и ВМФ')
    .replace(/[;:.?]+$/g, '')
    .trim();
}

function normalizeMythFragment(value: string) {
  return sanitizeListEntry(value)
    .split(/Опровержение:/i)[0]
    .replace(/^\d+\s*/g, '')
    .replace(/^Миф\s*№?\d+[:\s-]*/i, '')
    .replace(/^Заблуждение(?:\s+в\s+том)?[:\s]*/i, '')
    .replace(/^Многие\s+думают,\s*что\s*/i, '')
    .replace(/^Утверждение\s*/i, '')
    .replace(/^,\s*/i, '')
    .replace(/^что\s+/i, '')
    .replace(/[;:.]+$/g, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+-\s+/g, ' ')
    .trim();
}

function composeAngleSummary(questionItems: string[], misconceptionItems: string[]) {
  const questionText = isGenericQuestionSet(questionItems)
    ? 'почему этот сюжет важен для региона, кто и что его сформировало и как он продолжает влиять на Калининградскую область сегодня'
    : joinNatural(
        questionItems
          .slice(0, 3)
          .map((item) => lowercaseFirst(normalizeQuestionFragment(item)))
          .filter(Boolean),
      );

  const hasMyths = misconceptionItems.some((item) => normalizeMythFragment(item));
  const questionSentence = questionText ? `${capitalizeFirst(questionText)}?` : '';
  const mythSentence = hasMyths
    ? isGenericMythSet(misconceptionItems)
      ? 'Лекция возвращает этот сюжет из области штампов к живой истории региона и показывает, почему он касается не только специалистов.'
      : 'Лекция разбирает самые живучие мифы вокруг этой темы и переводит разговор из области штампов к фактам, людям и месту.'
    : '';

  if (questionSentence && mythSentence) {
    return `${questionSentence} ${mythSentence}`;
  }

  if (questionSentence) {
    return questionSentence;
  }

  if (mythSentence) {
    return mythSentence;
  }

  return '';
}

function trimLead(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  const sentences = normalized.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const lead = sentences.slice(0, 2).join(' ');
  return lead.length > 220 ? `${lead.slice(0, 217).trim()}...` : lead;
}

function composeEventSummary(title: string, body: string, formatRaw: string) {
  const summaryOverride = Object.entries(curatedSummaries)
    .find(([key]) => normalizeLookup(key) === normalizeLookup(title))?.[1];
  if (summaryOverride) {
    return normalizeText(summaryOverride);
  }

  const siteDescription = normalizeText(extractField(body, 'Описание для сайта'));
  const shortDescription = normalizeText(
    extractField(body, 'Короткое описание для афиши — версия 1') ||
    extractField(body, 'Короткое описание для афиши — версия 2'),
  );
  const baseDescription = normalizeText(
    extractField(body, 'Основа для описания / полезная фактура из таблицы')
    || extractField(body, 'Основа для описания'),
  );
  const questionItems = [
    '3 вопроса, на которые отвечает событие',
    '3 вопроса, на которые отвечает лекция',
    '3 вопроса, на которые отвечает выставка',
    '3 вопроса, на которые отвечает спектакль',
  ]
    .map((label) => extractListItems(body, label))
    .find((items) => items.length) ?? [];
  const misconceptionItems = [
    '3 мифа и заблуждения, с которыми работает событие',
    '3 мифа и заблуждения, с которыми работает лекция',
    '3 заблуждения, с которыми работает лекция',
    '3 заблуждения, с которыми работает выставка',
    '3 заблуждения, с которыми работает спектакль',
  ]
    .map((label) => extractListItems(body, label))
    .find((items) => items.length) ?? [];
  const pieces: string[] = [];
  const angleSummary = composeAngleSummary(questionItems, misconceptionItems);
  const prefersShortDescription = normalizeLookup(formatRaw).includes(normalizeLookup('Иммерсивный спектакль'));

  if (siteDescription && !startsWithTemplateLead(siteDescription)) {
    pieces.push(toSentence(trimLead(siteDescription)));
  } else if (prefersShortDescription && shortDescription && !startsWithTemplateLead(shortDescription)) {
    pieces.push(toSentence(trimLead(shortDescription)));
  } else if (baseDescription && !startsWithTemplateLead(baseDescription)) {
    pieces.push(toSentence(trimLead(baseDescription)));
  } else if (shortDescription && !startsWithTemplateLead(shortDescription)) {
    pieces.push(toSentence(trimLead(shortDescription)));
  }

  if (angleSummary) {
    pieces.push(angleSummary);
  }

  const composed = normalizeText(pieces.join(' '));
  if (composed) {
    return composed;
  }

  return normalizeText(
    siteDescription ||
    extractField(body, 'Короткое описание для афиши — версия 1') ||
    extractField(body, 'Короткое описание для афиши — версия 2') ||
    baseDescription ||
    (formatRaw.toLowerCase().includes('лекц') ? angleSummary : ''),
  );
}

function transliterate(input: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
    ь: '', э: 'e', ю: 'yu', я: 'ya',
  };

  return input
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeLookup(value: string) {
  return transliterate(value).toLowerCase();
}

function tokenizeLookup(value: string) {
  return normalizeLookup(value)
    .split('-')
    .filter((token) => token.length > 2);
}

function toSlug(title: string) {
  return transliterate(title) || 'sobytiye';
}

function parseDurationMinutes(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('длительный') || normalized.includes('уточ')) {
    return null;
  }

  const hours = normalized.match(/(\d+)\s*час/);
  const minutes = normalized.match(/(\d+)\s*мин/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0) || null;
}

function parseExactDate(dateLabel: string, timeLabel: string) {
  if (!dateLabel || !timeLabel || timeLabel.includes('уточ') || timeLabel.includes('объяв')) {
    return null;
  }

  const dateMatch = dateLabel.match(/(\d{1,2})\s+([а-я]+)\s+2026/i);
  const timeMatch = timeLabel.match(/(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const monthInfo = MONTHS[dateMatch[2].toLowerCase()];
  if (!monthInfo) {
    return null;
  }

  const day = dateMatch[1].padStart(2, '0');
  const hour = timeMatch[1].padStart(2, '0');
  const minute = timeMatch[2];

  return {
    isoStart: `2026-${monthInfo.number}-${day}T${hour}:${minute}:00`,
    monthLabel: monthInfo.label,
    monthAnchor: monthInfo.anchor,
  };
}

function parseRangeStart(heading: string) {
  const match = heading.match(/(?:с\s+)?(\d{1,2})\s+([а-я]+)(?:\s+по|\s*-\s*)(\d{1,2})?\s*([а-я]+)?\s+2026/i);
  if (!match) {
    return null;
  }

  const monthInfo = MONTHS[match[2].toLowerCase()];
  if (!monthInfo) {
    return null;
  }

  const day = match[1].padStart(2, '0');
  return {
    isoStart: `2026-${monthInfo.number}-${day}T00:00:00`,
    monthLabel: monthInfo.label,
    monthAnchor: monthInfo.anchor,
  };
}

function parseHeaderTitle(heading: string) {
  const stripWrappedQuotes = (value: string) => {
    if ((value.startsWith('«') && value.endsWith('»')) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.slice(1, -1).trim();
    }
    return value;
  };

  if (heading.includes(' — ')) {
    const rawTitle = heading.split(' — ').slice(1).join(' — ').trim().replace(/\s*:\s*$/, '');
    return stripWrappedQuotes(rawTitle);
  }
  return stripWrappedQuotes(heading.trim().replace(/\s*:\s*$/, ''));
}

function isProgramHeading(heading: string, body: string) {
  if (heading.startsWith('Спецсобытие')) {
    return true;
  }

  if (/^(?:с\s+)?\d{1,2}\s+[а-я]+(?:\s*(?:-|—|–|по)\s*\d{1,2}\s+[а-я]+)?\s+2026\s+—\s+/i.test(heading)) {
    return true;
  }

  return /(?:\*\*Формат:\*\*\s*Иммерсивный спектакль)/i.test(body);
}

function normalizeFormatName(raw: string) {
  return raw
    .replace('Паблик-ток', 'Открытый диалог')
    .replace('паблик-ток', 'Открытый диалог')
    .replace('Открытие фестиваля + паблик-ток', 'Открытие фестиваля');
}

function pickBestManifestKey(value: string, keys: string[], minimumScore: number) {
  const queryTokens = new Set(tokenizeLookup(value));
  if (!queryTokens.size) {
    return undefined;
  }

  let bestKey: string | undefined;
  let bestScore = 0;

  for (const key of keys) {
    const keyTokens = tokenizeLookup(key);
    const overlap = keyTokens.filter((token) => queryTokens.has(token)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestKey = key;
    }
  }

  return bestScore >= minimumScore ? bestKey : undefined;
}

function assignImage(title: string, speakerValue: string) {
  const titleLookup = normalizeLookup(title);
  const speakerLookup = normalizeLookup(speakerValue);
  const match = EVENT_IMAGE_MAP.find((entry) => (
    titleLookup === normalizeLookup(entry.title)
    && speakerLookup.includes(normalizeLookup(entry.speaker))
  ));

  if (!match) {
    return undefined;
  }

  const selectedKey = match.manifestKeys.find((key) => media.events[key]);
  return selectedKey ? media.events[selectedKey] : undefined;
}

function assignSpeakerImages(speakerValue: string) {
  const manifestKey = pickBestManifestKey(speakerValue, SPEAKER_MANIFEST_KEYS, 2);
  return manifestKey ? media.speakers[manifestKey] ?? [] : [];
}

function normalizeSpeakerLabel(value: string) {
  const cleaned = normalizeText(value).replace(/^[—–-]+\s*/, '').trim();
  return cleaned;
}

function splitSpeakerSegments(raw: string) {
  return normalizeText(raw)
    .replace(/^[—–-]+\s*/, '')
    .split(/\s+[—-]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function isLikelyPersonSegment(value: string) {
  if (!value || value.includes(',') || /\d/.test(value)) {
    return false;
  }

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    return false;
  }

  return words.every((word) => /^[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё-]+$/.test(word));
}

function takeAffiliationFromTail(segments: string[]) {
  if (!segments.length) {
    return '';
  }

  let startIndex = 0;
  if (isLikelyPersonSegment(segments[0])) {
    startIndex = segments.findIndex((segment) => !isLikelyPersonSegment(segment));
    if (startIndex === -1) {
      return '';
    }
  }

  const affiliationParts: string[] = [];
  for (const segment of segments.slice(startIndex)) {
    if (isLikelyPersonSegment(segment)) {
      break;
    }
    affiliationParts.push(segment);
  }

  return affiliationParts.join(' — ').trim();
}

function splitSpeakerData(raw: string) {
  if (!raw) {
    return { speakerLabel: '', affiliation: '' };
  }

  const segments = splitSpeakerSegments(raw);
  const primarySegment = segments.find((segment) => isLikelyPersonSegment(segment)) ?? segments[0] ?? normalizeText(raw);
  const primaryIndex = Math.max(segments.indexOf(primarySegment), 0);
  const tail = segments.slice(primaryIndex + 1);

  return {
    speakerLabel: normalizeSpeakerLabel(primarySegment),
    affiliation: takeAffiliationFromTail(tail),
  };
}

function extractDialogueParticipants(raw: string) {
  if (!raw) {
    return [];
  }

  const sourceLines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const seededParticipants = sourceLines.some((line) => /^[—–•-]/.test(line))
    ? sourceLines.map((line) => splitSpeakerData(line.replace(/^[—–•-]+\s*/, '')))
    : splitSpeakerSegments(raw).map((segment) => splitSpeakerData(segment));

  const seen = new Set<string>();
  const participants: FestivalDialogueParticipant[] = [];

  for (const seededParticipant of seededParticipants) {
    const seededName = seededParticipant.speakerLabel;
    if (!seededName) {
      continue;
    }

    const signature = normalizeLookup(seededName);
    if (!signature || seen.has(signature)) {
      continue;
    }

    const images = assignSpeakerImages(seededName);
    const looksLikeName = seededName
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => /^[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё-]+$/.test(word));

    if (!images.length && !looksLikeName) {
      continue;
    }

    seen.add(signature);
    participants.push({
      name: seededName,
      affiliation: seededParticipant.affiliation,
      images,
    });
  }

  return participants;
}

function getSpeakerShowcaseWeight(speaker: Pick<SpeakerShowcaseEntry, 'name' | 'affiliation' | 'appearances'>) {
  const affiliation = speaker.affiliation.toLowerCase();
  const appearanceBonus = Math.max(0, speaker.appearances - 1) * 1.35;
  const affiliationBonus = SPEAKER_SHOWCASE_KEYWORD_WEIGHTS.reduce(
    (total, entry) => total + (entry.pattern.test(affiliation) ? entry.bonus : 0),
    0,
  );
  const nameBonus = SPEAKER_SHOWCASE_NAME_BONUSES.reduce(
    (total, entry) => total + (speaker.name.includes(entry.match) ? entry.bonus : 0),
    0,
  );

  return Number((1 + appearanceBonus + affiliationBonus + nameBonus).toFixed(3));
}

function toUtcDate(isoStart: string, durationMinutes: number) {
  const start = new Date(isoStart);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const utcShiftMs = 2 * 60 * 60 * 1000;
  return {
    start: new Date(start.getTime() - utcShiftMs),
    end: new Date(end.getTime() - utcShiftMs),
  };
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function createCalendarLinks(event: {
  title: string;
  slug: string;
  summary: string;
  venue: string;
  address: string;
  isoStart?: string;
  durationMinutes: number | null;
}) {
  if (!event.isoStart || !event.durationMinutes) {
    return { ready: false, note: 'Календарь появится после уточнения времени.' };
  }

  const utc = toUtcDate(event.isoStart, event.durationMinutes);
  const dateRange = `${formatIcsDate(utc.start)}/${formatIcsDate(utc.end)}`;
  const details = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.summary,
    location: `${event.venue}, ${event.address}, ${DEFAULT_CITY}`,
    ctz: 'Europe/Kaliningrad',
    dates: dateRange,
  });

  return {
    ready: true,
    googleUrl: `https://calendar.google.com/calendar/render?${details.toString()}`,
    icsUrl: `/calendar/${event.slug}.ics`,
  };
}

function sortEvents(events: FestivalEvent[]) {
  return events.sort((left, right) => {
    if (left.kind === 'special' && right.kind !== 'special') {
      return 1;
    }
    if (left.kind !== 'special' && right.kind === 'special') {
      return -1;
    }
    if (left.isoStart && right.isoStart) {
      return left.isoStart.localeCompare(right.isoStart);
    }
    if (left.isoStart) {
      return -1;
    }
    if (right.isoStart) {
      return 1;
    }
    return left.title.localeCompare(right.title, 'ru');
  });
}

function isLectureFormat(formatLabel: string) {
  return normalizeLookup(formatLabel).includes(normalizeLookup('Лекция'));
}

function includesAnyNormalized(value: string, patterns: string[]) {
  const lookup = normalizeLookup(value);
  return patterns.some((pattern) => lookup.includes(normalizeLookup(pattern)));
}

function toRelatedEvent(event: FestivalEvent, relationLabel: string): RelatedFestivalEvent {
  return {
    slug: event.slug,
    title: event.title,
    formatLabel: event.formatLabel,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    venue: event.venue,
    address: event.address,
    speakerLabel: event.speakerLabel,
    kind: event.kind,
    relationLabel,
  };
}

function toSpeakerLectureLink(event: FestivalEvent): SpeakerLectureLink {
  return {
    slug: event.slug,
    title: event.title,
    dateLabel: event.dateLabel,
  };
}

function applyExhibitionLocationOverride(title: string, kind: FestivalEventKind, venue: string) {
  if (kind !== 'range') {
    return venue;
  }

  const override = EXHIBITION_LOCATION_OVERRIDES.find((entry) => includesAnyNormalized(title, entry.titleMatches));
  return override?.venue ?? venue;
}

function attachRelatedEvents(events: FestivalEvent[]) {
  for (const binding of RELATED_EVENT_BINDINGS) {
    const lecture = events.find((event) =>
      event.kind !== 'range'
      && includesAnyNormalized(event.title, binding.lectureTitleMatches)
      && normalizeLookup(event.speakerLabel).includes(normalizeLookup(binding.lectureSpeakerMatch)));

    const exhibition = events.find((event) =>
      event.kind === 'range'
      && includesAnyNormalized(event.title, binding.exhibitionTitleMatches));

    if (!lecture || !exhibition) {
      continue;
    }

    lecture.relatedEvent = toRelatedEvent(exhibition, 'Связано с выставкой');
    exhibition.relatedEvent = toRelatedEvent(lecture, 'Связано с лекцией');
  }

  const lectureEvents = events.filter((event) => event.kind !== 'range' && isLectureFormat(event.formatLabel) && event.speakerLabel);

  for (const event of lectureEvents) {
    event.speakerLectureLinks = lectureEvents
      .filter((candidate) => candidate.slug !== event.slug && candidate.speakerLabel === event.speakerLabel)
      .sort((left, right) => {
        if (left.isoStart && right.isoStart) {
          return left.isoStart.localeCompare(right.isoStart);
        }
        if (left.isoStart) {
          return -1;
        }
        if (right.isoStart) {
          return 1;
        }
        return left.title.localeCompare(right.title, 'ru');
      })
      .slice(0, 2)
      .map(toSpeakerLectureLink);
  }

  return events;
}

function parseSections() {
  const source = fs.readFileSync(MASTER_PATH, 'utf-8');
  const programText = source.split('## Подтверждённая программа')[1] ?? source;

  const chunks = programText
    .split('\n## ')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => (index === 0 ? chunk.replace(/^##\s*/, '') : chunk));

  const events: FestivalEvent[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    const heading = lines[0]?.trim();
    const body = lines.slice(1).join('\n').trim();

    if (!heading || !body || !isProgramHeading(heading, body)) {
      continue;
    }

    const title = parseHeaderTitle(heading);
    const slug = toSlug(title);
    const formatRaw = extractField(body, 'Формат') || 'Событие';
    const formatLabel = normalizeFormatName(formatRaw);
    const durationLabel = extractField(body, 'Длительность') || extractField(body, 'Ориентировочная длительность') || '1 час';
    const summary = composeEventSummary(title, body, formatRaw);
    const whyGo = normalizeText(
      extractFirst(body, [
        'Зачем идти на эту лекцию',
        'Зачем идти на это событие',
        'Зачем посетить выставку',
        'Зачем идти на фестиваль',
        'Зачем идти на спектакль',
      ]),
    );
    const rawVenue = extractField(body, 'Площадка') || 'Площадка уточняется';
    const address = extractField(body, 'Короткий адрес') || 'Адрес уточняется';
    const showingsLabel = extractField(body, 'Количество показов');
    const speakerRaw = (
      extractField(body, 'Спикер') ||
      extractField(body, 'Участники') ||
      extractField(body, 'Партнёр / источник материалов') ||
      extractField(body, 'Рабочая привязка в таблице')
    ).trim();
    const speakerData = splitSpeakerData(speakerRaw);
    const dialogueParticipants = formatLabel.includes('Открытый диалог')
      ? extractDialogueParticipants(speakerRaw)
      : [];
    const dateLabel = extractField(body, 'Дата') || extractField(body, 'Период проведения') || 'Дата будет объявлена';
    const timeLabel = extractField(body, 'Время') || extractField(body, 'Время посещения') || 'Время будет объявлено';
    const kind: FestivalEvent['kind'] = heading.startsWith('Спецсобытие')
      ? 'special'
      : formatRaw.includes('Выставка') || body.includes('**Период проведения:**')
        ? 'range'
        : 'dated';
    const venue = applyExhibitionLocationOverride(title, kind, rawVenue);

    const exactDate = parseExactDate(dateLabel, timeLabel);
    const rangeDate = kind === 'range' ? parseRangeStart(heading) : null;
    const monthInfo = exactDate || rangeDate || { monthLabel: 'Скоро', monthAnchor: 'soon' };
    const durationMinutes = parseDurationMinutes(durationLabel);
    const calendar = createCalendarLinks({
      title,
      slug,
      summary: summary || whyGo,
      venue,
      address,
      isoStart: exactDate?.isoStart,
      durationMinutes,
    });

    events.push({
      slug,
      title,
      format: formatRaw,
      formatLabel,
      dateLabel,
      monthLabel: monthInfo.monthLabel,
      monthAnchor: monthInfo.monthAnchor,
      timeLabel,
      durationLabel,
      venue,
      address,
      city: DEFAULT_CITY,
      speakerLabel: kind === 'special' ? '' : speakerData.speakerLabel,
      affiliation: kind === 'special' ? '' : speakerData.affiliation,
      showingsLabel,
      summary,
      whyGo,
      registrationUrl: kind === 'special' ? undefined : `https://example.com/register?event=${slug}`,
      calendarReady: kind === 'special' ? false : calendar.ready,
      googleCalendarUrl: kind === 'special' ? undefined : calendar.googleUrl,
      icsUrl: kind === 'special' ? undefined : calendar.icsUrl,
      calendarNote: kind === 'special' ? 'Дата спектакля будет объявлена позже.' : calendar.note,
      image: assignImage(title, speakerData.speakerLabel),
      speakerImages: kind === 'special' ? [] : assignSpeakerImages(speakerData.speakerLabel),
      dialogueParticipants,
      kind,
      isoStart: exactDate?.isoStart ?? rangeDate?.isoStart,
      speakerLectureLinks: [],
    });
  }

  return sortEvents(attachRelatedEvents(events));
}

export function getFestivalEvents() {
  if (!cache) {
    cache = parseSections();
  }
  return cache;
}

export function getMonthGroups(events: FestivalEvent[]) {
  const groups = new Map<string, { label: string; anchor: string; events: FestivalEvent[] }>();

  for (const event of events) {
    const key = event.monthAnchor;
    const current = groups.get(key);
    if (current) {
      current.events.push(event);
    } else {
      groups.set(key, {
        label: event.monthLabel,
        anchor: event.monthAnchor,
        events: [event],
      });
    }
  }

  return Array.from(groups.values());
}

export function getSpeakerShowcase(events: FestivalEvent[], limit = 8) {
  const bySpeaker = new Map<string, Omit<SpeakerShowcaseEntry, 'weight'>>();

  function upsertSpeaker(speaker: {
    name: string;
    affiliation: string;
    images: string[];
    anchor: string;
  }) {
    if (!speaker.name || !speaker.images.length) {
      return;
    }

    const existing = bySpeaker.get(speaker.name);

    if (existing) {
      existing.appearances += 1;
      if (!existing.affiliation || speaker.affiliation.length > existing.affiliation.length) {
        existing.affiliation = speaker.affiliation;
      }
      if (!existing.images.length && speaker.images.length) {
        existing.images = speaker.images;
      }
      return;
    }

    bySpeaker.set(speaker.name, {
      name: speaker.name,
      affiliation: speaker.affiliation,
      images: speaker.images,
      anchor: speaker.anchor,
      appearances: 1,
    });
  }

  for (const event of events) {
    if (event.speakerLabel && event.speakerImages.length) {
      upsertSpeaker({
        name: event.speakerLabel,
        affiliation: event.affiliation,
        images: event.speakerImages,
        anchor: `event-${event.slug}`,
      });
    }

    for (const participant of event.dialogueParticipants) {
      upsertSpeaker({
        name: participant.name,
        affiliation: participant.affiliation,
        images: participant.images,
        anchor: `event-${event.slug}`,
      });
    }
  }

  return Array.from(bySpeaker.values())
    .map((speaker) => ({
      ...speaker,
      weight: getSpeakerShowcaseWeight(speaker),
    }))
    .sort((left, right) =>
      right.weight - left.weight
      || right.appearances - left.appearances
      || left.name.localeCompare(right.name, 'ru'))
    .slice(0, limit);
}

export function getHookQuotes(events: FestivalEvent[]) {
  return events
    .filter((event) => event.whyGo)
    .slice(0, 3)
    .map((event) => ({
      quote: event.whyGo,
      title: event.title,
      anchor: `event-${event.slug}`,
    }));
}

export function getOpenDialogues(events: FestivalEvent[]) {
  return events.filter((event) => event.formatLabel.includes('Открытый диалог'));
}

export function buildIcs(event: FestivalEvent) {
  if (!event.isoStart) {
    return '';
  }

  const durationMinutes = parseDurationMinutes(event.durationLabel);
  if (!durationMinutes) {
    return '';
  }

  const utc = toUtcDate(event.isoStart, durationMinutes);
  const stamp = formatIcsDate(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//80 историй о главном//Festival Calendar//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.slug}@80istoriy.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsDate(utc.start)}`,
    `DTEND:${formatIcsDate(utc.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.whyGo || event.summary)}`,
    `LOCATION:${escapeIcs(`${event.venue}, ${event.address}, ${event.city}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
