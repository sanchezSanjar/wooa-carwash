import { NestFactory } from '@nestjs/core';
import { assertSafeForProduction } from '@app/common/env-check';
import { BatchModule } from './batch.module';

async function bootstrap() {
  assertSafeForProduction('batch');
  const app = await NestFactory.create(BatchModule);
  // Only a health check is served; keep this port private (not exposed through nginx).
  await app.listen(process.env.PORT_BATCH ?? 3002, '127.0.0.1');
}
void bootstrap();
