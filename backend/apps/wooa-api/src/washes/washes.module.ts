import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Car, CarSchema } from '@app/common/schemas/car.schema';
import { Subscription, SubscriptionSchema, Wash, WashSchema } from '@app/common/schemas/subscription.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { StorageService } from './storage.service';
import { WashPhotosController } from './washes.controller';
import { WashesService } from './washes.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wash.name, schema: WashSchema },
      { name: Car.name, schema: CarSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WashPhotosController],
  providers: [WashesService, StorageService],
  exports: [StorageService],
})
export class WashesModule {}
