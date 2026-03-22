import { randomBytes } from 'node:crypto';

const ALPHA_NUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DIGITS = '0123456789';

export function createPublicHash() {
  return randomBytes(32).toString('base64url');
}

export function createShortTicketId() {
  let middle = '';
  for (let index = 0; index < 4; index += 1) {
    middle += ALPHA_NUM[randomInt(ALPHA_NUM.length)];
  }

  return `${DIGITS[randomInt(DIGITS.length)]}${middle}${DIGITS[randomInt(DIGITS.length)]}`;
}

function randomInt(max: number) {
  return randomBytes(1)[0] % max;
}
