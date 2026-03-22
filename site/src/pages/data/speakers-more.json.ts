import type { APIRoute } from 'astro';
import { getFestivalEvents, getSpeakerShowcase } from '../../lib/festival';
import { toSpeakerStripCard } from '../../lib/media';

export const prerender = true;

const HOMEPAGE_SPEAKER_LIMIT = 8;

export const GET: APIRoute = () => {
  const cards = getSpeakerShowcase(getFestivalEvents(), Number.POSITIVE_INFINITY)
    .slice(HOMEPAGE_SPEAKER_LIMIT)
    .map((entry) => toSpeakerStripCard(entry));

  return new Response(JSON.stringify({ cards }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
