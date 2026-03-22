import fs from 'node:fs';
import path from 'node:path';
import {
  getFestivalEvents,
  getEventTemporalState,
  normalizeFestivalLookup,
  type FestivalEvent,
} from './festival';

export type RouteNavItem = {
  id: string;
  title: string;
  navLabel: string;
  slug?: string;
  href: string;
  isShortcut?: boolean;
};

export type RouteMyth = {
  id: string;
  text: string;
  strength: 'A' | 'B' | 'C';
  eventTitle: string;
  routeTitle: string;
  routeSlug: string;
  routeHref: string;
  eventHref: string;
  eventLabel: string;
  speakerName: string;
  speakerRole: string;
  speakerLine: string;
  ambientImage?: string;
  priority: number;
};

export type FestivalRoute = {
  id: string;
  title: string;
  navLabel: string;
  slug: string;
  href: string;
  description: string;
  sourceEventTitles: string[];
  events: FestivalEvent[];
  myths: RouteMyth[];
  heroMyths: RouteMyth[];
};

export type RouteEventSection = {
  id: string;
  title: string;
  events: FestivalEvent[];
};

const ROOT_DIR = path.resolve(process.cwd(), '..');
const GROUPS_PATH = path.resolve(ROOT_DIR, 'Исходные данные', 'gruppirovka_lendinga_s_otdelnoy_gruppoy_public_talks.md');
const MYTHS_PATH = path.resolve(ROOT_DIR, 'Исходные данные', 'mify_festivalya_po_kategoriyam.md');
const SHORTLIST_PATH = path.resolve(ROOT_DIR, 'docs', 'hero-myth-shortlist.md');

const ROUTE_SPECS = [
  {
    id: 'settlement',
    title: 'Как область заселяли и обживали',
    navLabel: 'Заселение и обживание',
    slug: 'zaselenie-i-obzhivanie',
  },
  {
    id: 'city',
    title: 'Город, архитектура и среда',
    navLabel: 'Архитектура и среда',
    slug: 'gorod-arhitektura-sreda',
  },
  {
    id: 'sea',
    title: 'Море, природа и территория',
    navLabel: 'Море и территория',
    slug: 'more-priroda-territoriya',
  },
  {
    id: 'everyday',
    title: 'Быт, привычки и повседневная жизнь',
    navLabel: 'Быт и повседневность',
    slug: 'byt-privychki-povsednevnost',
  },
  {
    id: 'people',
    title: 'Люди, профессии и институции',
    navLabel: 'Люди и институции',
    slug: 'lyudi-professii-institucii',
  },
  {
    id: 'memory',
    title: 'Память, искусство и культурные образы',
    navLabel: 'Память и образы',
    slug: 'pamyat-iskusstvo-obrazy',
  },
] as const;

const SOURCE_TITLE_ALIASES: Record<string, string> = {
  'Открытие фестиваля «80 историй о главном»': 'Открытие фестиваля',
  'Иммерсивный спектакль «Этюды той весны»': 'Этюды той весны',
  'Выставка «Первые на косе»': 'Выставка Первые на косе',
  'Выставка историй мирной жизни самой западной точки России': 'Выставка историй мирной жизни самой западной точки России',
};

const HOMEPAGE_DIALOGUES_ITEM: RouteNavItem = {
  id: 'dialogues',
  title: 'Открытые диалоги',
  navLabel: 'Открытые диалоги',
  href: '/#dialogues',
  isShortcut: true,
};

let cachedRoutes: FestivalRoute[] | null = null;
let cachedHomepageMyths: RouteMyth[] | null = null;

function normalizeText(value: string) {
  return value.replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeSourceEventTitle(value: string) {
  const withoutMeta = value
    .replace(/\s*\[[^\]]+\]\s*$/u, '')
    .replace(/^[-–•]\s*/u, '')
    .trim();

  return SOURCE_TITLE_ALIASES[withoutMeta] ?? withoutMeta;
}

function getFestivalEventIndex(events: FestivalEvent[]) {
  const map = new Map<string, FestivalEvent>();

  for (const event of events) {
    map.set(normalizeFestivalLookup(event.title), event);
  }

  return map;
}

function parseRouteSections() {
  const source = fs.readFileSync(GROUPS_PATH, 'utf-8');
  const sections = new Map<string, { description: string; eventTitles: string[] }>();

  for (const spec of ROUTE_SPECS) {
    const pattern = new RegExp(`## ${spec.title.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\n([\\s\\S]*?)(?=\\n## )`, 'u');
    const match = source.match(pattern);
    if (!match) {
      continue;
    }

    const sectionBody = match[1].trim();
    const [descriptionPart, listPart = ''] = sectionBody.split(/\n\*\*Состав группы:\*\*\n/u);
    const description = normalizeText(descriptionPart);
    const eventTitles = listPart
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => normalizeSourceEventTitle(line.slice(2)))
      .filter(Boolean);

    sections.set(spec.title, { description, eventTitles });
  }

  return sections;
}

function parseMythsByEvent() {
  const source = fs.readFileSync(MYTHS_PATH, 'utf-8');
  const lines = source.split('\n');
  const myths = new Map<string, Array<{ text: string; strength: 'A' | 'B' | 'C' }>>();
  let currentEventTitle = '';
  let currentStrength: 'A' | 'B' | 'C' = 'B';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      currentEventTitle = normalizeSourceEventTitle(trimmed.slice(4));
      continue;
    }

    const strengthMatch = trimmed.match(/^\d+\.\s+\*\*(A|B|C)\*\*/u);
    if (strengthMatch) {
      currentStrength = strengthMatch[1] as 'A' | 'B' | 'C';
      continue;
    }

    if (!currentEventTitle) {
      continue;
    }

    const finalMatch = trimmed.match(/^-+\s+Итоговая:\s*(.+)$/u);
    if (!finalMatch) {
      continue;
    }

    const text = normalizeText(finalMatch[1]);
    if (!text) {
      continue;
    }

    const current = myths.get(currentEventTitle) ?? [];
    current.push({ text, strength: currentStrength });
    myths.set(currentEventTitle, current);
  }

  return myths;
}

function parseHomepageShortlistPriority() {
  const source = fs.readFileSync(SHORTLIST_PATH, 'utf-8');
  const priorities = new Map<string, number>();
  const rows = source.split('\n').filter((line) => line.startsWith('|'));

  for (const row of rows) {
    if (!/\|\s*\d+\s*\|/u.test(row)) {
      continue;
    }

    const columns = row.split('|').map((value) => value.trim());
    const priority = Number(columns[1]);
    const mythText = normalizeText(columns[2] ?? '');
    if (!priority || !mythText) {
      continue;
    }

    priorities.set(normalizeFestivalLookup(mythText), priority);
  }

  return priorities;
}

function createSpeakerLine(event: FestivalEvent, _mythText: string) {
  const role = event.heroRole || event.affiliation;
  const speaker = event.speakerLabel || 'спикер фестиваля';
  const rolePart = role ? `${speaker}, ${role}` : speaker;
  return `— это заблуждение разбирает ${rolePart} на событии «${event.title}».`;
}

function createProvisionalZooExcursion(events: FestivalEvent[]) {
  const zooLecture = events.find((event) =>
    normalizeFestivalLookup(event.title) === normalizeFestivalLookup('Право на существование: зоопарки в современном мире. Перспективы развития Калининградского зоопарка'),
  );

  if (!zooLecture) {
    return null;
  }

  return {
    ...zooLecture,
    slug: 'premera-novoy-tematicheskoy-ekskursii-po-kaliningradskomu-zooparku',
    title: 'Премьера новой тематической экскурсии по Калининградскому зоопарку',
    format: 'Экскурсия',
    formatLabel: 'Экскурсия',
    dateLabel: 'Дата будет объявлена',
    monthLabel: 'Скоро',
    monthAnchor: 'soon',
    timeLabel: 'Время будет объявлено',
    durationLabel: 'Продолжительность уточняется',
    summary: 'Премьера новой тематической экскурсии по зоопарку, которая лучше раскроет, что появилось в зоопарке в советское время, познакомит с историей зоопарка того периода и покажет вживую, как менялся зоопарк после немецкой эпохи.',
    whyGo: 'Экскурсия задумывается как весёлая и полная необычных зоопарковых историй прогулка по советскому слою Калининградского зоопарка.',
    registrationUrl: undefined,
    calendarReady: false,
    googleCalendarUrl: undefined,
    icsUrl: undefined,
    calendarNote: 'Дата экскурсии будет объявлена позже.',
    kind: 'special' as const,
    isoStart: undefined,
    showingsLabel: 'Премьера экскурсии, дата уточняется',
    speakerLectureLinks: [],
  } satisfies FestivalEvent;
}

function buildRoutes() {
  const events = getFestivalEvents();
  const eventIndex = getFestivalEventIndex(events);
  const routeSections = parseRouteSections();
  const mythsByEvent = parseMythsByEvent();
  const shortlistPriority = parseHomepageShortlistPriority();
  const provisionalZooExcursion = createProvisionalZooExcursion(events);

  const routes = ROUTE_SPECS.map((spec) => {
    const section = routeSections.get(spec.title);
    const collectedEvents: FestivalEvent[] = [];

    for (const eventTitle of section?.eventTitles ?? []) {
      const lookup = normalizeFestivalLookup(eventTitle);
      if (eventTitle === 'Премьера новой тематической экскурсии по Калининградскому зоопарку' && provisionalZooExcursion) {
        collectedEvents.push(provisionalZooExcursion);
        continue;
      }

      const event = eventIndex.get(lookup);
      if (event) {
        collectedEvents.push(event);
      }
    }

    const myths = collectedEvents.flatMap((event) =>
      (mythsByEvent.get(event.title) ?? []).map((myth, index) => ({
        id: `${spec.slug}-${event.slug}-${index + 1}`,
        text: myth.text,
        strength: myth.strength,
        eventTitle: event.title,
        routeTitle: spec.title,
        routeSlug: spec.slug,
        routeHref: `/${spec.slug}/`,
        eventHref: `#event-${event.slug}`,
        eventLabel: event.title,
        speakerName: event.speakerLabel,
        speakerRole: event.heroRole || event.affiliation || '',
        speakerLine: createSpeakerLine(event, myth.text),
        ambientImage: event.image,
        priority: shortlistPriority.get(normalizeFestivalLookup(myth.text)) ?? 100 + index,
      } satisfies RouteMyth)),
    );

    const mythsByPriority = [...myths].sort((left, right) =>
      left.priority - right.priority
      || left.eventTitle.localeCompare(right.eventTitle, 'ru'));
    const heroMyths = mythsByPriority
      .filter((myth) => myth.strength !== 'C')
      .slice(0, Math.max(3, Math.min(6, mythsByPriority.length)));

    return {
      id: spec.id,
      title: spec.title,
      navLabel: spec.navLabel,
      slug: spec.slug,
      href: `/${spec.slug}/`,
      description: section?.description ?? '',
      sourceEventTitles: section?.eventTitles ?? [],
      events: collectedEvents,
      myths,
      heroMyths,
    } satisfies FestivalRoute;
  });

  cachedHomepageMyths = routes
    .flatMap((route) => route.myths)
    .filter((myth) => myth.priority < 100)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 18);

  return routes;
}

export function getFestivalRoutes() {
  if (!cachedRoutes) {
    cachedRoutes = buildRoutes();
  }

  return cachedRoutes;
}

export function getFestivalRouteBySlug(slug: string) {
  return getFestivalRoutes().find((route) => route.slug === slug);
}

export function getRouteNavItems() {
  const routes = getFestivalRoutes();
  return [
    ...routes.map((route) => ({
      id: route.id,
      title: route.title,
      navLabel: route.navLabel,
      slug: route.slug,
      href: route.href,
    })),
    HOMEPAGE_DIALOGUES_ITEM,
  ] satisfies RouteNavItem[];
}

export function getHomepageHeroMyths() {
  if (!cachedHomepageMyths) {
    getFestivalRoutes();
  }

  return cachedHomepageMyths ?? [];
}

export function getRouteTemporalGroups(route: FestivalRoute, now = new Date()) {
  const upcoming: FestivalEvent[] = [];
  const past: FestivalEvent[] = [];

  for (const event of route.events) {
    const state = getEventTemporalState(event, now);
    if (state === 'past') {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }

  return { upcoming, past };
}

function sortRouteEvents(events: FestivalEvent[]) {
  return [...events].sort((left, right) => {
    if (left.kind === 'special' && right.kind !== 'special') {
      return -1;
    }
    if (left.kind !== 'special' && right.kind === 'special') {
      return 1;
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

const ROUTE_SECTION_RULES: Array<{ id: string; title: string; match: (event: FestivalEvent) => boolean }> = [
  {
    id: 'opening',
    title: 'Открытие фестиваля',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Открытие фестиваля')),
  },
  {
    id: 'immersive',
    title: 'Иммерсивный спектакль',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Иммерсивный спектакль')),
  },
  {
    id: 'exhibitions',
    title: 'Выставки',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Выставка')),
  },
  {
    id: 'excursions',
    title: 'Экскурсия',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Экскурсия')),
  },
  {
    id: 'dialogues',
    title: 'Открытые диалоги',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Открытый диалог')),
  },
  {
    id: 'lectures',
    title: 'Лекции',
    match: (event) => normalizeFestivalLookup(event.formatLabel).includes(normalizeFestivalLookup('Лекция')),
  },
];

export function getRouteEventSections(events: FestivalEvent[]) {
  const remaining = [...events];
  const sections: RouteEventSection[] = [];

  for (const rule of ROUTE_SECTION_RULES) {
    const matched = remaining.filter(rule.match);
    if (!matched.length) {
      continue;
    }

    sections.push({
      id: rule.id,
      title: rule.title,
      events: sortRouteEvents(matched),
    });

    for (const event of matched) {
      const index = remaining.findIndex((candidate) => candidate.slug === event.slug);
      if (index >= 0) {
        remaining.splice(index, 1);
      }
    }
  }

  if (remaining.length) {
    sections.push({
      id: 'other',
      title: 'Другие события',
      events: sortRouteEvents(remaining),
    });
  }

  return sections;
}

export function getSmartProgramHref(events: FestivalEvent[], isHome = false, now = new Date()) {
  const datedEvents = [...events]
    .filter((event) => event.kind !== 'special' && event.isoStart)
    .sort((left, right) => (left.isoStart ?? '').localeCompare(right.isoStart ?? ''));

  const currentOrUpcoming = datedEvents.find((event) => getEventTemporalState(event, now) !== 'past');
  const fallbackEvent = currentOrUpcoming ?? datedEvents[0];
  const anchor = fallbackEvent ? `#month-${fallbackEvent.monthAnchor}` : '#program';
  return isHome ? anchor : `/${anchor}`;
}
