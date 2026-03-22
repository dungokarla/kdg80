import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { TicketArtifacts } from '../types';

type StorageConfig = {
  driver: 'local' | 's3';
  publicTicketBaseUrl: string;
  ticketsPrefix: string;
  localPublicRoot: string;
  s3Bucket: string | null;
  s3Endpoint: string | null;
  s3Region: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  s3ForcePathStyle: boolean;
};

type TicketArtifactFile = {
  key: string;
  body: Buffer | string;
  contentType: string;
  cacheControl: string;
};

export type TicketArtifactBundle = {
  publicHash: string;
  files: TicketArtifactFile[];
};

export type StoragePublisher = {
  driver: 'local' | 's3';
  publishTicketArtifacts(bundle: TicketArtifactBundle): Promise<TicketArtifacts>;
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/gu, '');
}

function createTicketUrls(baseUrl: string, ticketsPrefix: string, publicHash: string): TicketArtifacts {
  const ticketUrl = `${baseUrl}/${trimSlashes(ticketsPrefix)}/${publicHash}/`;

  return {
    ticketUrl,
    pdfUrl: `${ticketUrl}ticket.pdf`,
    icsUrl: `${ticketUrl}event.ics`,
  };
}

function createS3Publisher(config: StorageConfig): StoragePublisher {
  if (!config.s3Bucket || !config.s3Endpoint || !config.s3Region || !config.s3AccessKeyId || !config.s3SecretAccessKey) {
    throw new Error('S3 publisher requires bucket, endpoint, region and credentials.');
  }

  const client = new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint,
    forcePathStyle: config.s3ForcePathStyle,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
  });

  return {
    driver: 's3',
    async publishTicketArtifacts(bundle) {
      for (const file of bundle.files) {
        await client.send(new PutObjectCommand({
          Bucket: config.s3Bucket!,
          Key: file.key,
          Body: file.body,
          ContentType: file.contentType,
          CacheControl: file.cacheControl,
        }));
      }

      return createTicketUrls(config.publicTicketBaseUrl, config.ticketsPrefix, bundle.publicHash);
    },
  };
}

function createLocalPublisher(config: StorageConfig): StoragePublisher {
  fs.mkdirSync(config.localPublicRoot, { recursive: true });

  return {
    driver: 'local',
    async publishTicketArtifacts(bundle) {
      for (const file of bundle.files) {
        const targetPath = path.join(config.localPublicRoot, file.key);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, file.body);
      }

      return createTicketUrls(config.publicTicketBaseUrl, config.ticketsPrefix, bundle.publicHash);
    },
  };
}

export function createStoragePublisher(config: StorageConfig): StoragePublisher {
  if (config.driver === 's3') {
    return createS3Publisher(config);
  }

  return createLocalPublisher(config);
}
