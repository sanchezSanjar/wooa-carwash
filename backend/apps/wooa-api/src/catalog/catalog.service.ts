import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateExtraDto, CreateTariffDto, UpdateExtraDto, UpdateTariffDto } from './dto/catalog.dto';
import { Extra, ExtraDocument, Tariff, TariffDocument } from '@app/common/schemas/catalog.schema';

const DEFAULT_TARIFFS: CreateTariffDto[] = [
  {
    name: 'Basic',
    description: 'Every other week on the day you choose (e.g. 1st and 3rd Monday).',
    washesPerMonth: 2,
    price: 40000,
    sortOrder: 1,
  },
  {
    name: 'Standard',
    description: 'Once a week on the day you choose (e.g. every Tuesday).',
    washesPerMonth: 4,
    price: 70000,
    sortOrder: 2,
  },
  {
    name: 'Premium',
    description: 'Two days in weeks 1 & 3 and one day in weeks 2 & 4.',
    washesPerMonth: 6,
    price: 100000,
    sortOrder: 3,
  },
];

const DEFAULT_EXTRAS: CreateExtraDto[] = [
  { name: 'Interior vacuuming', description: 'Seats, mats and trunk.', price: 5000, sortOrder: 1 },
  { name: 'Perfume change', description: 'Fresh car perfume refill.', price: 3000, sortOrder: 2 },
  { name: 'Anti-rain polish', description: 'Water-repellent glass coating.', price: 7000, sortOrder: 3 },
  { name: 'Tire shine', description: 'Tire cleaning and dressing.', price: 3000, sortOrder: 4 },
];

export interface PublicTariff {
  id: string;
  name: string;
  description: string;
  washesPerMonth: number;
  price: number;
  active: boolean;
  sortOrder: number;
}

export type PublicExtra = Omit<PublicTariff, 'washesPerMonth'>;

@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(
    @InjectModel(Tariff.name) private readonly tariffs: Model<Tariff>,
    @InjectModel(Extra.name) private readonly extras: Model<Extra>,
  ) {}

  async onModuleInit() {
    if ((await this.tariffs.estimatedDocumentCount()) === 0) await this.tariffs.insertMany(DEFAULT_TARIFFS);
    if ((await this.extras.estimatedDocumentCount()) === 0) await this.extras.insertMany(DEFAULT_EXTRAS);
  }

  async listTariffs(includeInactive = false) {
    const docs = await this.tariffs
      .find(includeInactive ? {} : { active: true })
      .sort({ sortOrder: 1, washesPerMonth: 1 })
      .exec();
    return docs.map(CatalogService.tariff);
  }

  async listExtras(includeInactive = false) {
    const docs = await this.extras
      .find(includeInactive ? {} : { active: true })
      .sort({ sortOrder: 1, price: 1 })
      .exec();
    return docs.map(CatalogService.extra);
  }

  async getTariff(id: string): Promise<TariffDocument> {
    const doc = isValidObjectId(id) ? await this.tariffs.findById(id).exec() : null;
    if (!doc) throw new NotFoundException('Tariff not found');
    return doc;
  }

  /** Active extras matching every id, or a 404 naming the problem. */
  async getActiveExtras(ids: string[]): Promise<ExtraDocument[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const docs = unique.every(isValidObjectId)
      ? await this.extras.find({ _id: { $in: unique }, active: true }).exec()
      : [];
    if (docs.length !== unique.length) throw new NotFoundException('One of the extra services is not available');
    return docs;
  }

  async createTariff(dto: CreateTariffDto) {
    return CatalogService.tariff(await this.tariffs.create(dto));
  }

  async updateTariff(id: string, dto: UpdateTariffDto) {
    const doc = await this.getTariff(id);
    doc.set(dto);
    return CatalogService.tariff(await doc.save());
  }

  async createExtra(dto: CreateExtraDto) {
    return CatalogService.extra(await this.extras.create(dto));
  }

  async updateExtra(id: string, dto: UpdateExtraDto) {
    const doc = isValidObjectId(id) ? await this.extras.findById(id).exec() : null;
    if (!doc) throw new NotFoundException('Extra service not found');
    doc.set(dto);
    return CatalogService.extra(await doc.save());
  }

  static tariff(doc: TariffDocument): PublicTariff {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      washesPerMonth: doc.washesPerMonth,
      price: doc.price,
      active: doc.active,
      sortOrder: doc.sortOrder,
    };
  }

  static extra(doc: ExtraDocument): PublicExtra {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      active: doc.active,
      sortOrder: doc.sortOrder,
    };
  }
}
