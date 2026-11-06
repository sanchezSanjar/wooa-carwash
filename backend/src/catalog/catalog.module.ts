import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { Extra, ExtraSchema, Tariff, TariffSchema } from './schemas/catalog.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tariff.name, schema: TariffSchema },
      { name: Extra.name, schema: ExtraSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
