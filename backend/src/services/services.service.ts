import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreateWashServiceDto, UpdateWashServiceDto } from './dto/wash-service.dto.js';
import { WashService, WashServiceDocument } from './schemas/wash-service.schema.js';

const DEFAULT_SERVICES: CreateWashServiceDto[] = [
  {
    name: 'Basic Wash',
    description: 'Exterior foam wash, rinse and hand dry.',
    price: 15000,
    durationMinutes: 30,
    sortOrder: 1,
  },
  {
    name: 'Premium Wash',
    description: 'Basic wash plus interior vacuum, dashboard wipe and tire shine.',
    price: 35000,
    durationMinutes: 60,
    sortOrder: 2,
  },
  {
    name: 'Full Detailing',
    description: 'Deep interior clean, clay bar, polish and wax protection.',
    price: 120000,
    durationMinutes: 180,
    sortOrder: 3,
  },
];

export interface PublicWashService {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
}

@Injectable()
export class ServicesService implements OnModuleInit {
  constructor(
    @InjectModel(WashService.name) private readonly model: Model<WashService>,
  ) {}

  async onModuleInit() {
    if ((await this.model.estimatedDocumentCount()) === 0) {
      await this.model.insertMany(DEFAULT_SERVICES);
    }
  }

  async list(includeInactive = false): Promise<PublicWashService[]> {
    const filter = includeInactive ? {} : { active: true };
    const docs = await this.model.find(filter).sort({ sortOrder: 1, price: 1 }).exec();
    return docs.map(ServicesService.toPublic);
  }

  async get(id: string): Promise<WashServiceDocument> {
    const doc = isValidObjectId(id) ? await this.model.findById(id).exec() : null;
    if (!doc) throw new NotFoundException('Service not found');
    return doc;
  }

  async create(dto: CreateWashServiceDto): Promise<PublicWashService> {
    return ServicesService.toPublic(await this.model.create(dto));
  }

  async update(id: string, dto: UpdateWashServiceDto): Promise<PublicWashService> {
    const doc = await this.get(id);
    doc.set(dto);
    return ServicesService.toPublic(await doc.save());
  }

  static toPublic(doc: WashServiceDocument): PublicWashService {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      durationMinutes: doc.durationMinutes,
      active: doc.active,
      sortOrder: doc.sortOrder,
    };
  }
}
