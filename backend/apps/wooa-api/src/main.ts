import { NestFactory } from '@nestjs/core';
import { assertSafeForProduction } from '@app/common/env-check';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  assertSafeForProduction('api');
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
