import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WashService, WashServiceSchema } from './schemas/wash-service.schema.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: WashService.name, schema: WashServiceSchema }])],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
