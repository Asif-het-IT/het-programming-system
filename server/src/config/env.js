import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.API_PORT || 3001),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5174').split(',').map((x) => x.trim()),
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'replace_access_secret_in_prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'replace_refresh_secret_in_prod',
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  gasBridgeUrl: process.env.GAS_BRIDGE_URL || '',
  gasBridgeUrlLaceGayle: process.env.GAS_BRIDGE_URL_LACE_GAYLE || process.env.GAS_BRIDGE_URL || '',
  gasBridgeUrlMenMaterial: process.env.GAS_BRIDGE_URL_MEN_MATERIAL || process.env.GAS_BRIDGE_URL || '',
  gasSecretKey: process.env.GAS_SECRET_KEY || '',
  gasSecretKeyLaceGayle: process.env.GAS_SECRET_KEY_LACE_GAYLE || process.env.GAS_SECRET_KEY || '',
  gasSecretKeyMenMaterial: process.env.GAS_SECRET_KEY_MEN_MATERIAL || process.env.GAS_SECRET_KEY || '',
  gasProxyUrl: process.env.GAS_PROXY_URL || '',
  gasProxyAuthToken: process.env.GAS_PROXY_AUTH_TOKEN || '',
  gasAllowedReferrer: process.env.GAS_ALLOWED_REFERRER || '',
  cacheTtlMs: Number(process.env.API_CACHE_TTL_MS || 60_000),
  gasRetryMaxAttempts: Number(process.env.GAS_RETRY_MAX_ATTEMPTS || 3),
  gasRetryBaseDelayMs: Number(process.env.GAS_RETRY_BASE_DELAY_MS || 300),
  gasRetryMaxDelayMs: Number(process.env.GAS_RETRY_MAX_DELAY_MS || 4_000),
  gasRequestConcurrency: Number(process.env.GAS_REQUEST_CONCURRENCY || 6),
  gasRetryStatusCodes: (process.env.GAS_RETRY_STATUS_CODES || '429,500,502,503,504')
    .split(',')
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isInteger(value) && value > 0),
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY || '',
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY || '',
  webPushSubject: process.env.WEB_PUSH_SUBJECT || 'mailto:admin@example.com',
};
