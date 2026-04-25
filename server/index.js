import app from './src/app.js';
import { env } from './src/config/env.js';
import { initUsers } from './src/data/users.js';

async function bootstrap() {
  await initUsers();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] enterprise middleware running on http://localhost:${env.port}`);
  });
}

bootstrap();
