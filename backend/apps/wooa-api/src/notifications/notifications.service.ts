import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from '@app/common/schemas/notification.schema';
import type { AuthUser } from '../auth/roles';

const LIMIT = 30;

@Injectable()
export class NotificationsService {
  constructor(@InjectModel(Notification.name) private readonly model: Model<Notification>) {}

  async listMine(user: AuthUser) {
    const member = new Types.ObjectId(user.userId);
    const [items, unread] = await Promise.all([
      this.model.find({ member }).sort({ createdAt: -1 }).limit(LIMIT).exec(),
      this.model.countDocuments({ member, read: false }),
    ]);
    return { unread, items: items.map(NotificationsService.toPublic) };
  }

  async markAllRead(user: AuthUser) {
    const res = await this.model.updateMany(
      { member: new Types.ObjectId(user.userId), read: false },
      { $set: { read: true } },
    );
    return { updated: res.modifiedCount };
  }

  static toPublic(doc: NotificationDocument) {
    const createdAt = (doc as unknown as { createdAt?: Date }).createdAt;
    return {
      id: doc.id as string,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      date: doc.date,
      read: doc.read,
      createdAt: createdAt?.toISOString() ?? null,
    };
  }
}
