import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

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

export function decryptPii(
  privateKeyPemBase64: string,
  encrypted: {
    piiCiphertext: Buffer;
    piiWrappedKey: Buffer;
    piiIv: Buffer;
    piiAlg: string;
  },
) {
  if (encrypted.piiAlg !== 'AES-256-GCM+RSA-OAEP-256') {
    throw new Error(`Unsupported PII algorithm: ${encrypted.piiAlg}`);
  }

  const privateKeyPem = Buffer.from(privateKeyPemBase64, 'base64').toString('utf-8');
  const dataKey = privateDecrypt(
    {
      key: privateKeyPem,
      oaepHash: 'sha256',
    },
    encrypted.piiWrappedKey,
  );

  const authTag = encrypted.piiCiphertext.subarray(encrypted.piiCiphertext.length - 16);
  const ciphertext = encrypted.piiCiphertext.subarray(0, encrypted.piiCiphertext.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', dataKey, encrypted.piiIv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf-8');

  return JSON.parse(plaintext) as Record<string, string>;
}
