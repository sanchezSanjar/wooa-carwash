import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { today } from '@app/common/dates';
import { Invoice, InvoiceDocument, InvoiceStatus, PaymentMethod } from '@app/common/schemas/invoice.schema';
import { UserDocument } from '@app/common/schemas/user.schema';
import { AuthUser } from '../auth/roles';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

@Injectable()
export class InvoicesService {
  private readonly bank: string | null;

  constructor(
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    config: ConfigService,
  ) {
    this.bank = config.get<string>('BANK_ACCOUNT')?.trim() || null;
  }

  async listMine(user: AuthUser) {
    const docs = await this.invoices
      .find({ member: new Types.ObjectId(user.userId), status: { $ne: InvoiceStatus.Void } })
      .sort({ month: -1, plateNumber: 1 })
      .limit(48)
      .exec();
    return { bankAccount: this.bank, invoices: docs.map((d) => this.toPublic(d)) };
  }

  /** Admin: a month's bills with totals; unpaid first. */
  async list(query: { month?: string; status?: string }) {
    const month = query.month ?? today().slice(0, 7);
    if (!MONTH_RE.test(month)) throw new BadRequestException('month must be YYYY-MM');
    const filter: Record<string, unknown> = { month };
    if (query.status && Object.values(InvoiceStatus).includes(query.status as InvoiceStatus)) filter.status = query.status;
    const docs = await this.invoices.find(filter).populate('member', 'name phone apartmentName').exec();
    const all = await this.invoices.find({ month, status: { $ne: InvoiceStatus.Void } }).select('amount status').lean().exec();
    const sum = (s?: InvoiceStatus) => all.filter((i) => !s || i.status === s).reduce((t, i) => t + i.amount, 0);
    const order = { unpaid: 0, paid: 1, void: 2 } as const;
    return {
      month,
      totals: {
        billed: sum(),
        paid: sum(InvoiceStatus.Paid),
        unpaid: sum(InvoiceStatus.Unpaid),
        count: all.length,
        unpaidCount: all.filter((i) => i.status === InvoiceStatus.Unpaid).length,
      },
      invoices: docs
        .map((d) => this.toPublic(d, true))
        .sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate) || a.plateNumber.localeCompare(b.plateNumber)),
    };
  }

  /** Admin: overdue bills across all months. */
  async overdue() {
    const docs = await this.invoices
      .find({ status: InvoiceStatus.Unpaid, dueDate: { $lt: today() } })
      .sort({ dueDate: 1 })
      .populate('member', 'name phone apartmentName')
      .exec();
    return docs.map((d) => this.toPublic(d, true));
  }

  async setStatus(id: string, dto: { status: InvoiceStatus; method?: PaymentMethod; note?: string }) {
    const doc = isValidObjectId(id) ? await this.invoices.findById(id).exec() : null;
    if (!doc) throw new NotFoundException('Bill not found');
    doc.status = dto.status;
    if (dto.status === InvoiceStatus.Paid) {
      doc.paidAt = doc.paidAt ?? new Date();
      doc.method = dto.method ?? doc.method ?? PaymentMethod.BankTransfer;
    } else {
      doc.paidAt = undefined;
      doc.method = undefined;
    }
    if (dto.note !== undefined) doc.note = dto.note.trim();
    await doc.save();
    await doc.populate('member', 'name phone apartmentName');
    return this.toPublic(doc, true);
  }

  private toPublic(d: InvoiceDocument, withMember = false) {
    const member = d.member as unknown as UserDocument | Types.ObjectId;
    const populated = member && typeof member === 'object' && 'name' in member ? (member as UserDocument) : null;
    return {
      id: d.id as string,
      subscriptionId: d.subscription.toString(),
      plateNumber: d.plateNumber,
      month: d.month,
      lines: d.lines.map((l) => ({ label: l.label, amount: l.amount })),
      amount: d.amount,
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      status: d.status,
      overdue: d.status === InvoiceStatus.Unpaid && d.dueDate < today(),
      paidAt: d.paidAt?.toISOString() ?? null,
      method: d.method ?? null,
      note: d.note,
      ...(withMember && populated
        ? { member: { id: populated.id as string, name: populated.name, phone: populated.phone, apartmentName: populated.apartmentName } }
        : {}),
    };
  }
}
