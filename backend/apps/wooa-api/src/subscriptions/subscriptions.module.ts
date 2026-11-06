import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarsController } from '../cars/cars.controller';
import { CarsModule } from '../cars/cars.module';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  Subscription,
  SubscriptionSchema,
  Wash,
  WashSchema,
} from '@app/common/schemas/subscription.schema';
import { SubscriptionsController, WashesController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
    ]),
    CarsModule,
    CatalogModule,
    NotificationsModule,
  ],
  controllers: [CarsController, SubscriptionsController, WashesController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
