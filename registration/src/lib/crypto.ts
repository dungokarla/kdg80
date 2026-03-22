import { createCipheriv, createHmac, publicEncrypt, randomBytes } from 'node:crypto';

export function computeFingerprint(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function encryptPii(publicKeyPemBase64: string, payload: Record<string, string>) {
  const publicKeyPem = Buffer.from(publicKeyPemBase64, 'base64').toString('utf-8');
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const wrappedKey = publicEncrypt(
    {
      key: publicKeyPem,
      oaepHash: 'sha256',
    },
    dataKey,
  );

  return {
    piiCiphertext: ciphertext,
    piiWrappedKey: wrappedKey,
    piiIv: iv,
    piiAlg: 'AES-256-GCM+RSA-OAEP-256',
  };
}
