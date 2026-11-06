import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CarsService } from './cars.service.js';
import { Car, CarSchema } from './schemas/car.schema.js';

/** Car storage. The HTTP controller lives in SubscriptionsModule (it checks subscriptions). */
@Module({
  imports: [MongooseModule.forFeature([{ name: Car.name, schema: CarSchema }])],
  providers: [CarsService],
  exports: [CarsService, MongooseModule],
})
export class CarsModule {}
