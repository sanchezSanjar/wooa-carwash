import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/common/database/database.module';
import { SmsModule } from '@app/common/sms/sms.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DaySheetsModule } from './daysheets/daysheets.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { UsersModule } from './users/users.module';
import { WashesModule } from './washes/washes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SmsModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    SubscriptionsModule,
    WashesModule,
    DaySheetsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
