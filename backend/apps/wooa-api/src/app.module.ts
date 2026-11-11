import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '@app/common/database/database.module';
import { SmsModule } from '@app/common/sms/sms.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DaySheetsModule } from './daysheets/daysheets.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { WashesModule } from './washes/washes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Per IP address. Behind nginx, set TRUST_PROXY so the real address is used (see setup.ts).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      errorMessage: 'Too many requests. Try again in a minute.',
    }),
    DatabaseModule,
    SmsModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    SubscriptionsModule,
    WashesModule,
    DaySheetsModule,
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
