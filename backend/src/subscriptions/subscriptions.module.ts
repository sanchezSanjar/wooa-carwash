import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarsController } from '../cars/cars.controller.js';
import { CarsModule } from '../cars/cars.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import {
  Subscription,
  SubscriptionSchema,
  Wash,
  WashSchema,
} from './schemas/subscription.schema.js';
import { SubscriptionsController, WashesController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
    ]),
    CarsModule,
    CatalogModule,
  ],
  controllers: [CarsController, SubscriptionsController, WashesController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
