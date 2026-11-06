import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { dueDateFor, invoiceLines, monthBounds, monthOf } from '@app/common/billing';
import { addDays, today } from '@app/common/dates';
import type { Lang } from '@app/common/i18n';
import { NotificationText, smsText, type NoticeText } from '@app/common/notify';
import { CarDocument } from '@app/common/schemas/car.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '@app/common/schemas/invoice.schema';
import { Notification, NotificationType } from '@app/common/schemas/notification.schema';
import { Subscription, SubscriptionStatus } from '@app/common/schemas/subscription.schema';
import { User } from '@app/common/schemas/user.schema';
import { SmsService } from '@app/common/sms/sms.service';

const DUE_SOON_DAYS = 3;
const OVERDUE_EVERY_DAYS = 7;

/**
 * Money: issues each car's monthly bill, reminds members before the due date and while unpaid.
 * Payment itself happens outside the app (bank transfer, cash); admins mark bills paid.
 * Every step is safe to run twice.
 */
@Injectable()
export class BillingJob {
  private readonly logger = new Logger('BillingJob');
  private readonly dueDay: number;
  private readonly bank?: string;

  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly sms: SmsService,
    config: ConfigService,
  ) {
    this.dueDay = Number(config.get('PAYMENT_DUE_DAY') ?? 10) || 10;
    this.bank = config.get<string>('BANK_ACCOUNT')?.trim() || undefined;
  }

  /** Creates this month's bill for every active plan that doesn't have one yet. Returns how many. */
  async issue(now = new Date()): Promise<number> {
    const date = today(now);
    const month = monthOf(date);
    const { last } = monthBounds(month);
    const subs = await this.subs
      .find({ status: SubscriptionStatus.Active, startDate: { $lte: last } })
      .populate('car', 'plateNumber')
      .exec();
    const billed = new Set(
      (await this.invoices.find({ month, subscription: { $in: subs.map((s) => s._id) } }).select('subscription').lean().exec()).map((i) =>
        i.subscription.toString(),
      ),
    );

    let created = 0;
    for (const sub of subs) {
      if (billed.has(sub.id)) continue;
      const lines = invoiceLines(sub, month);
      if (lines.length === 0) continue;
      const car = sub.car as unknown as CarDocument | null;
      const res = await this.invoices.updateOne(
        { subscription: sub._id, month },
        {
          $setOnInsert: {
            member: sub.member,
            plateNumber: car?.plateNumber ?? '',
            lines,
            amount: lines.reduce((s, l) => s + l.amount, 0),
            issueDate: date,
            dueDate: dueDateFor(month, date, this.dueDay),
            status: InvoiceStatus.Unpaid,
            note: '',
          },
        },
        { upsert: true },
      );
      if (!res.upsertedCount) continue;
      created++;
      const invoice = await this.invoices.findOne({ subscription: sub._id, month }).exec();
      if (invoice) await this.tell(invoice, NotificationType.InvoiceIssued, invoice.dueDate, (lang) => NotificationText.invoiceIssued(invoice, this.bank, lang));
    }
    return created;
  }

  /** Unpaid bills due in 3 days: one reminder each. */
  async remindDueSoon(now = new Date()): Promise<number> {
    const date = today(now);
    const bills = await this.invoices
      .find({ status: InvoiceStatus.Unpaid, dueDate: { $gte: date, $lte: addDays(date, DUE_SOON_DAYS) }, dueSoonSentAt: { $exists: false } })
      .exec();
    let sent = 0;
    for (const bill of bills) {
      const marked = await this.invoices.updateOne({ _id: bill._id, dueSoonSentAt: { $exists: false } }, { $set: { dueSoonSentAt: now } });
      if (!marked.modifiedCount) continue;
      sent++;
      await this.tell(bill, NotificationType.PaymentDue, bill.dueDate, (lang) => NotificationText.paymentDue(bill, this.bank, lang));
    }
    return sent;
  }

  /** Unpaid bills past their due date: a reminder the day after, then every 7 days. */
  async remindOverdue(now = new Date()): Promise<number> {
    const date = today(now);
    const weekAgo = new Date(now.getTime() - (OVERDUE_EVERY_DAYS - 0.5) * 86_400_000);
    const due = { status: InvoiceStatus.Unpaid, dueDate: { $lt: date } };
    const bills = await this.invoices
      .find({ ...due, $or: [{ lastOverdueSentAt: { $exists: false } }, { lastOverdueSentAt: { $lte: weekAgo } }] })
      .exec();
    let sent = 0;
    for (const bill of bills) {
      const marked = await this.invoices.updateOne(
        { _id: bill._id, ...due, $or: [{ lastOverdueSentAt: { $exists: false } }, { lastOverdueSentAt: { $lte: weekAgo } }] },
        { $set: { lastOverdueSentAt: now } },
      );
      if (!marked.modifiedCount) continue;
      sent++;
      await this.tell(bill, NotificationType.PaymentOverdue, date, (lang) => NotificationText.paymentOverdue(bill, this.bank, lang));
    }
    return sent;
  }

  /** In-app notification plus SMS. A failed SMS is logged and never stops the job. */
  private async tell(bill: InvoiceDocument, type: NotificationType, date: string, compose: (lang: Lang) => NoticeText) {
    const member = await this.users.findById(new Types.ObjectId(bill.member)).select('phone language').lean().exec();
    const text = compose(member?.language ?? 'ko');
    await this.notifications.updateOne(
      { subscription: bill.subscription, date, type },
      { $setOnInsert: { member: bill.member, ...text, read: false } },
      { upsert: true },
    );
    if (!member?.phone) return;
    try {
      await this.sms.send(member.phone, smsText(text));
    } catch (err) {
      this.logger.warn(`SMS for bill ${bill.id} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
