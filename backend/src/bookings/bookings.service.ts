import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  BUSINESS,
  isValidSlotStart,
  localDate,
  localDayStart,
  slotStartsForDay,
} from '../common/business-hours.js';
import { AuthUser, Role } from '../common/roles.js';
import { ServicesService } from '../services/services.service.js';
import {
  CreateBookingDto,
  ListBookingsQueryDto,
} from './dto/booking.dto.js';
import {
  ACTIVE_STATUSES,
  Booking,
  BookingDocument,
  BookingStatus,
} from './schemas/booking.schema.js';

export interface Slot {
  startsAt: string;
  available: boolean;
  remaining: number;
}

/** Allowed admin status transitions. */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

@Injectable()
export class BookingsService {
  private readonly bays: number;

  constructor(
    @InjectModel(Booking.name) private readonly model: Model<Booking>,
    private readonly services: ServicesService,
    config: ConfigService,
  ) {
    this.bays = Math.max(1, Number(config.get('BAYS') ?? 2) || 2);
  }

  async availability(date: string, serviceId: string, now = new Date()): Promise<Slot[]> {
    const service = await this.services.get(serviceId);
    let starts: Date[];
    try {
      starts = slotStartsForDay(date, service.durationMinutes);
    } catch {
      throw new BadRequestException('Invalid date');
    }
    const dayStart = localDayStart(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    const existing = await this.model
      .find({
        status: { $in: ACTIVE_STATUSES },
        startsAt: { $lt: dayEnd },
        endsAt: { $gt: dayStart },
      })
      .select('startsAt endsAt')
      .lean()
      .exec();

    const latest = this.latestBookable(now);
    return starts.map((start) => {
      const end = new Date(start.getTime() + service.durationMinutes * 60_000);
      const overlapping = existing.filter((b) => b.startsAt < end && b.endsAt > start).length;
      const remaining = Math.max(0, this.bays - overlapping);
      const inWindow = start > now && start <= latest;
      return {
        startsAt: start.toISOString(),
        available: inWindow && remaining > 0,
        remaining: inWindow ? remaining : 0,
      };
    });
  }

  async create(user: AuthUser, dto: CreateBookingDto, now = new Date()) {
    const service = await this.services.get(dto.serviceId);
    if (!service.active) throw new BadRequestException('This service is not available');

    const startsAt = new Date(dto.startsAt);
    if (!isValidSlotStart(startsAt, service.durationMinutes)) {
      throw new BadRequestException('Selected time is outside opening hours or not a valid slot');
    }
    if (startsAt <= now) throw new BadRequestException('Selected time is in the past');
    if (startsAt > this.latestBookable(now)) {
      throw new BadRequestException(
        `Bookings can be made up to ${BUSINESS.bookingWindowDays} days ahead`,
      );
    }
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    const overlapping = await this.model.countDocuments({
      status: { $in: ACTIVE_STATUSES },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    });
    if (overlapping >= this.bays) {
      throw new ConflictException('This time slot is fully booked');
    }

    const booking = await this.model.create({
      user: new Types.ObjectId(user.userId),
      service: service._id,
      serviceName: service.name,
      price: service.price,
      startsAt,
      endsAt,
      vehicle: { plate: dto.vehicle.plate, model: dto.vehicle.model },
      notes: dto.notes ?? '',
    });
    return this.toPublic(booking);
  }

  async listMine(user: AuthUser) {
    const docs = await this.model
      .find({ user: new Types.ObjectId(user.userId) })
      .sort({ startsAt: -1 })
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async listAll(query: ListBookingsQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.date) {
      let start: Date;
      try {
        start = localDayStart(query.date);
      } catch {
        throw new BadRequestException('Invalid date');
      }
      filter.startsAt = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60_000) };
    }
    const docs = await this.model
      .find(filter)
      .sort({ startsAt: 1 })
      .populate('user', 'name email phone')
      .exec();
    return docs.map((d) => this.toPublic(d));
  }

  async cancel(user: AuthUser, id: string, now = new Date()) {
    const booking = await this.find(id);
    const isAdmin = user.role === Role.Admin;
    if (!isAdmin && booking.user.toString() !== user.userId) {
      throw new NotFoundException('Booking not found');
    }
    if (!TRANSITIONS[booking.status].includes(BookingStatus.Cancelled)) {
      throw new BadRequestException(`A ${booking.status} booking cannot be cancelled`);
    }
    if (!isAdmin && booking.startsAt <= now) {
      throw new ForbiddenException('This booking has already started');
    }
    booking.status = BookingStatus.Cancelled;
    return this.toPublic(await booking.save());
  }

  async updateStatus(id: string, status: BookingStatus) {
    const booking = await this.find(id);
    if (!TRANSITIONS[booking.status].includes(status)) {
      throw new BadRequestException(`Cannot change a ${booking.status} booking to ${status}`);
    }
    booking.status = status;
    return this.toPublic(await booking.save());
  }

  private async find(id: string): Promise<BookingDocument> {
    const booking = isValidObjectId(id) ? await this.model.findById(id).exec() : null;
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private latestBookable(now: Date): Date {
    return new Date(now.getTime() + BUSINESS.bookingWindowDays * 24 * 60 * 60_000);
  }

  private toPublic(doc: BookingDocument) {
    const user = doc.user as unknown;
    const populated =
      user && typeof user === 'object' && 'email' in (user as object)
        ? (user as { _id: Types.ObjectId; name: string; email: string; phone?: string })
        : null;
    return {
      id: doc.id as string,
      userId: populated ? populated._id.toString() : doc.user.toString(),
      customer: populated
        ? { name: populated.name, email: populated.email, phone: populated.phone }
        : undefined,
      serviceId: doc.service.toString(),
      serviceName: doc.serviceName,
      price: doc.price,
      startsAt: doc.startsAt.toISOString(),
      endsAt: doc.endsAt.toISOString(),
      date: localDate(doc.startsAt),
      vehicle: { plate: doc.vehicle.plate, model: doc.vehicle.model },
      notes: doc.notes,
      status: doc.status,
    };
  }
}
