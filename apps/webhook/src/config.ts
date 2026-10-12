import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const sm = new SecretsManagerClient({});
let cachedSecret: string | undefined;

export async function getWebhookSecret(): Promise<string> {
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    return process.env.GITHUB_WEBHOOK_SECRET;
  }
  if (cachedSecret !== undefined) {
    return cachedSecret;
  }

  const name = process.env.APP_SECRET_NAME;
  if (!name) {
    throw new Error('APP_SECRET_NAME is not set');
  }

  const res = await sm.send(
    new GetSecretValueCommand({ SecretId: name })
  );

  const json = JSON.parse(res.SecretString ?? '{}');

  const secret = json.GITHUB_WEBHOOK_SECRET;

  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Missing or invalid GITHUB_WEBHOOK_SECRET');
  }

  cachedSecret = secret;
  return secret;
}