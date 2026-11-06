import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { AuthUser, Role } from '../auth/roles';
import { CreateCarDto, UpdateCarDto } from './dto/car.dto';
import { Car, CarDocument } from '@app/common/schemas/car.schema';

export interface PublicCar {
  id: string;
  ownerId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  buildingNumber: string;
  parkingFloor: string;
  arrivesHomeAt: string;
  leavesForWorkAt: string;
}

@Injectable()
export class CarsService {
  constructor(@InjectModel(Car.name) private readonly model: Model<Car>) {}

  async listMine(user: AuthUser): Promise<PublicCar[]> {
    return this.listForOwner(user.userId);
  }

  async listForOwner(ownerId: string): Promise<PublicCar[]> {
    if (!isValidObjectId(ownerId)) return [];
    const cars = await this.model
      .find({ owner: new Types.ObjectId(ownerId) })
      .sort({ createdAt: 1 })
      .exec();
    return cars.map(CarsService.toPublic);
  }

  /** Members add their own cars; an admin can add a car for any member with ownerId. */
  async create(user: AuthUser, dto: CreateCarDto): Promise<PublicCar> {
    const { ownerId, ...data } = dto;
    if (ownerId && user.role !== Role.Admin) throw new ForbiddenException('Only admins can add cars for others');
    const owner = ownerId ?? user.userId;
    if (!isValidObjectId(owner)) throw new NotFoundException('Member not found');
    try {
      const car = await this.model.create({ ...data, owner: new Types.ObjectId(owner) });
      return CarsService.toPublic(car);
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('A car with this plate number is already registered');
      throw err;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateCarDto): Promise<PublicCar> {
    const car = await this.findAccessible(user, id);
    car.set(dto);
    try {
      return CarsService.toPublic(await car.save());
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('A car with this plate number is already registered');
      throw err;
    }
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const car = await this.findAccessible(user, id);
    await car.deleteOne();
  }

  /** The car if the user owns it (or is an admin); 404 otherwise. */
  async findAccessible(user: AuthUser, id: string): Promise<CarDocument> {
    const car = isValidObjectId(id) ? await this.model.findById(id).exec() : null;
    if (!car || (user.role !== Role.Admin && car.owner.toString() !== user.userId)) {
      throw new NotFoundException('Car not found');
    }
    return car;
  }

  static toPublic(car: CarDocument): PublicCar {
    return {
      id: car.id,
      ownerId: car.owner.toString(),
      plateNumber: car.plateNumber,
      brand: car.brand,
      model: car.model,
      color: car.color,
      buildingNumber: car.buildingNumber,
      parkingFloor: car.parkingFloor,
      arrivesHomeAt: car.arrivesHomeAt,
      leavesForWorkAt: car.leavesForWorkAt,
    };
  }
}
