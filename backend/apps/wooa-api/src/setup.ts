import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { TranslateErrorsFilter } from './i18n';
import { uploadRoot } from './washes/storage.service';

/** Shared app configuration for main.ts and e2e tests. */
export function configureApp(app: INestApplication) {
  // Behind nginx every request comes from the proxy: without this, all users share one IP address
  // and the rate limits hit everyone at once. Set TRUST_PROXY to the number of proxies in front (usually 1).
  // Never trust more than there are: clients could then fake their address with X-Forwarded-For.
  const trustProxy = trustProxySetting(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) (app as NestExpressApplication).set('trust proxy', trustProxy);

  // photos are shown by the app and website (other origins), so allow cross-origin image loads
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  (app as NestExpressApplication).useStaticAssets(uploadRoot(), { prefix: '/uploads/', maxAge: '30d', index: false });
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? true,
    exposedHeaders: ['Content-Disposition'],
  });
  app.useGlobalFilters(new TranslateErrorsFilter(app.getHttpAdapter()));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const doc = new DocumentBuilder()
    .setTitle('Wooa Carwash API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc));
}

/** TRUST_PROXY: a number of proxies (1), "loopback", or a list of proxy addresses. Empty: trust none. */
export function trustProxySetting(value?: string): number | string | undefined {
  const v = value?.trim();
  if (!v || v === 'false' || v === '0') return undefined;
  return /^\d+$/.test(v) ? Number(v) : v;
}
