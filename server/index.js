import app from './src/app.js';
import { env } from './src/config/env.js';
import { initUsers } from './src/data/users.js';

// Record server start time for monitoring endpoint
process._startedAt = new Date().toISOString();

async function bootstrap() {
  await initUsers();
  app.listen(env.port, () => {
    if (env.nodeEnv !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[api] enterprise middleware running on http://localhost:${env.port}`);
    }
  });
}

await bootstrap();
