import dotenv from 'dotenv';

dotenv.config({ path: 'server/.env' });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.API_PORT || 3001),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5174').split(',').map((x) => x.trim()),
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
};
