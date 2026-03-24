const FULL_NAME_ALLOWED = /^[A-Za-zА-Яа-яЁё' -]+$/u;
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.plus',
  'yopmail.com',
  'dispostable.com',
]);

export function normalizeFullName(value: string) {
  const normalized = value.trim().replace(/\s+/gu, ' ');

  if (!normalized) {
    throw new Error('Укажите имя и фамилию полностью.');
  }

  if (normalized.length > 120) {
    throw new Error('ФИО слишком длинное.');
  }

  if (!FULL_NAME_ALLOWED.test(normalized)) {
    throw new Error('Укажите имя и фамилию полностью.');
  }

  const parts = normalized
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error('Укажите имя и фамилию полностью.');
  }

  for (const part of parts) {
    const lettersOnly = part.replace(/[-']/gu, '');
    if (lettersOnly.length < 2) {
      throw new Error('Укажите имя и фамилию полностью.');
    }
  }

  return normalized;
}

export function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    throw new Error('Укажите email.');
  }

  if (normalized.length > 254) {
    throw new Error('Email слишком длинный.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
  if (!emailPattern.test(normalized)) {
    throw new Error('Проверьте email: адрес выглядит некорректно.');
  }

  const domain = normalized.split('@')[1] ?? '';
  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new Error('Используйте постоянный email. Адреса временной почты для регистрации не подходят.');
  }

  return normalized;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D+/gu, '');

  if (digits.length !== 11 || !/^[78]\d{10}$/u.test(digits)) {
    throw new Error('Введите российский номер в формате +7XXXXXXXXXX.');
  }

  return `+7${digits.slice(1)}`;
}
