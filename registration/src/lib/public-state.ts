import type { PublicEventCtaState, RegistrationPublicState } from '../types';

type EventStateRow = {
  starts_at: string;
  ends_at: string;
  capacity: number;
  seats_taken: number;
  registration_public_state: RegistrationPublicState;
};

export function derivePublicState(row: EventStateRow, now = new Date()): PublicEventCtaState {
  const nowMs = now.getTime();
  const startsAtMs = new Date(row.starts_at).getTime();
  const endsAtMs = new Date(row.ends_at).getTime();

  if (!Number.isNaN(startsAtMs) && nowMs >= startsAtMs) {
    return 'past';
  }

  if (!Number.isNaN(endsAtMs) && nowMs >= endsAtMs) {
    return 'past';
  }

  if (row.seats_taken >= row.capacity) {
    return 'sold_out';
  }

  if (row.registration_public_state === 'open') {
    return 'registration_open';
  }

  if (row.registration_public_state === 'closed') {
    return 'registration_closed';
  }

  return 'registration_soon';
}

export function getCtaCopy(publicState: PublicEventCtaState) {
  switch (publicState) {
    case 'registration_open':
      return {
        ctaLabel: 'Регистрация',
      };
    case 'registration_soon':
      return {
        ctaLabel: 'Регистрация скоро откроется',
        ctaNotice: 'Регистрация на мероприятие скоро откроется.',
      };
    case 'registration_closed':
      return {
        ctaLabel: 'Регистрация закрыта',
        ctaNotice: 'Регистрация на это событие сейчас закрыта.',
      };
    case 'sold_out':
      return {
        ctaLabel: 'Мест нет',
        ctaNotice: 'Свободные места закончились.',
      };
    case 'past':
    default:
      return {
        ctaLabel: 'Событие прошло',
        ctaNotice: 'Событие уже прошло.',
      };
  }
}
