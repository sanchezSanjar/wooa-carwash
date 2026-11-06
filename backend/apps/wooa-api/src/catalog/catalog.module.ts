import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Extra, ExtraSchema, Tariff, TariffSchema } from '@app/common/schemas/catalog.schema';

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
