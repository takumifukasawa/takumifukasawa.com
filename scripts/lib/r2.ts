// R2 over its S3 API, signed with aws4fetch. Credentials come from .env (see .env.example / docs/setup.md).
import { readFileSync } from 'node:fs';
import { AwsClient } from 'aws4fetch';

export type R2 = { client: AwsClient; base: string };

const REQUIRED = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

// Throws with the fix when .env is missing or incomplete (every machine needs its own .env).
export const createR2 = (envPath: string): R2 => {
  try {
    process.loadEnvFile(envPath);
  } catch {
    throw new Error(
      '.env not found. .env is not in git, so every machine needs its own:\n' +
        '  cp .env.example .env   and fill in the values (where they come from: the top of .env.example, docs/setup.md)',
    );
  }
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`.env is missing ${missing.join(', ')}. Fill them in (see .env.example).`);
  }
  const env = process.env as Record<(typeof REQUIRED)[number], string>;
  return {
    client: new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' }),
    base: `${env.R2_ENDPOINT.replace(/\/$/, '')}/${env.R2_BUCKET}`,
  };
};

const url = (r2: R2, key: string) => `${r2.base}/${key.split('/').map(encodeURIComponent).join('/')}`;

export const objectExists = async (r2: R2, key: string): Promise<boolean> => {
  const res = await r2.client.fetch(url(r2, key), { method: 'HEAD' });
  if (res.status === 404) return false;
  if (res.ok) return true;
  throw new Error(`R2 HEAD ${key}: ${res.status} ${res.statusText}. Check the token in .env (Object Read & Write on the bucket).`);
};

// Keys are immutable (decision 0001), so the object is cached forever.
export const putObject = async (r2: R2, key: string, file: string, contentType: string) => {
  const res = await r2.client.fetch(url(r2, key), {
    method: 'PUT',
    body: readFileSync(file),
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${res.statusText}\n${await res.text()}`);
};
