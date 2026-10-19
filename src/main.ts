import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main() {
  const app = await createApp();
  await app.listen(loadEnv().PORT);
}

void main();
