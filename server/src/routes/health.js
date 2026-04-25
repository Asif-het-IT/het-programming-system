import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'enterprise-middleware-api',
    ts: new Date().toISOString(),
    gas: {
      contractRoutes: ['records', 'dashboard', 'product-names', 'save-entry'],
      workerProxyConfigured: Boolean(env.gasProxyUrl?.startsWith('http')),
      bridgeConfigured: Boolean(env.gasBridgeUrl?.startsWith('http')),
      bridgeConfiguredByDatabase: {
        laceGayle: Boolean(env.gasBridgeUrlLaceGayle?.startsWith('http')),
        menMaterial: Boolean(env.gasBridgeUrlMenMaterial?.startsWith('http')),
      },
      secretConfigured: Boolean(env.gasSecretKey && !env.gasSecretKey.startsWith('REPLACE_')),
      secretConfiguredByDatabase: {
        laceGayle: Boolean(env.gasSecretKeyLaceGayle),
        menMaterial: Boolean(env.gasSecretKeyMenMaterial),
      },
      allowedReferrerConfigured: Boolean(env.gasAllowedReferrer?.startsWith('http')),
    },
  });
});

export default router;
