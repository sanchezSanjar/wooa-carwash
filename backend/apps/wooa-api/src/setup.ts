import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { uploadRoot } from './washes/storage.service';

/** Shared app configuration for main.ts and e2e tests. */
export function configureApp(app: INestApplication) {
  // photos are shown by the app and website (other origins), so allow cross-origin image loads
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  (app as NestExpressApplication).useStaticAssets(uploadRoot(), { prefix: '/uploads/', maxAge: '30d', index: false });
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? true,
  });
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
