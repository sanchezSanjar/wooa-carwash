import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import ExcelJS from 'exceljs';
import { Model } from 'mongoose';
import { addDays, isValidDate } from '@app/common/dates';
import { dayLabel } from '@app/common/notify';
import { washKey } from '@app/common/planner';
import { isWashDay } from '@app/common/schedule';
import { Car } from '@app/common/schemas/car.schema';
import { Subscription, SubscriptionStatus } from '@app/common/schemas/subscription.schema';
import type { AuthUser } from '../auth/roles';
import { DaySheetsService } from './daysheets.service';

export const MAX_EXPORT_DAYS = 14;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Column order of the exported workbook. Only the editable ones are read back. */
const COLUMNS = [
  { key: 'order', header: 'Order', width: 7, editable: true },
  { key: 'day', header: 'Day (YYYY-MM-DD)', width: 17, editable: true },
  { key: 'plate', header: 'Plate number', width: 14, editable: false },
  { key: 'car', header: 'Car', width: 22, editable: false },
  { key: 'apartment', header: 'Apartment', width: 20, editable: false },
  { key: 'building', header: 'Building', width: 9, editable: false },
  { key: 'floor', header: 'Floor', width: 7, editable: false },
  { key: 'parked', header: 'Parked', width: 14, editable: false },
  { key: 'plan', header: 'Plan and extras', width: 30, editable: false },
  { key: 'washer', header: 'Washer', width: 16, editable: true },
  { key: 'note', header: 'Note', width: 30, editable: true },
  { key: 'status', header: 'Status', width: 10, editable: false },
  { key: 'scheduled', header: 'Scheduled wash (do not edit)', width: 22, editable: false },
] as const;
type ColumnKey = (typeof COLUMNS)[number]['key'];

type SheetRows = Awaited<ReturnType<DaySheetsService['get']>>['rows'];

export interface ImportChange {
  type: 'order' | 'washer' | 'note' | 'moved' | 'removed' | 'added';
  plateNumber: string;
  date: string;
  detail: string;
}

export interface ImportProblem {
  sheet: string;
  row: number;
  plateNumber: string;
  message: string;
}

export interface ImportPlan {
  date: string;
  rows: { subscriptionId: string; scheduledDate: string; washerId?: string; note?: string }[];
}

/**
 * Day sheets as an Excel workbook: one tab per day. An admin edits the order, day, washer and note
 * columns and uploads it again; the preview lists every change before anything is saved.
 * Imports only change day sheets — never cars, members, plans or wash results.
 */
@Injectable()
export class DaySheetsXlsxService {
  constructor(
    private readonly sheets: DaySheetsService,
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
  ) {}

  async export(from: string, days: number): Promise<{ filename: string; buffer: Buffer }> {
    if (!isValidDate(from)) throw new BadRequestException('Invalid start date');
    const count = Math.min(Math.max(1, Math.floor(days) || 1), MAX_EXPORT_DAYS);
    const book = new ExcelJS.Workbook();
    book.creator = 'Wooa Carwash';
    book.created = new Date();

    for (let i = 0; i < count; i++) {
      const date = addDays(from, i);
      const sheet = await this.sheets.get(date);
      const ws = book.addWorksheet(`${date} ${dayLabel(date).slice(0, 3)}`, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = COLUMNS.map((c) => ({ key: c.key, header: c.header, width: c.width }));
      const head = ws.getRow(1);
      head.font = { bold: true };
      head.eachCell((cell, n) => {
        const editable = COLUMNS[n - 1].editable;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: editable ? 'FFFFF4D6' : 'FFEDEFF2' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFB8BEC6' } } };
      });
      sheet.rows.forEach((r, index) => {
        const row = ws.addRow({
          order: index + 1,
          day: date,
          plate: r.car.plateNumber,
          car: `${r.car.color} ${r.car.brand} ${r.car.model}`,
          apartment: r.member.apartmentName,
          building: r.car.buildingNumber,
          floor: r.car.parkingFloor,
          parked: `${r.car.arrivesHomeAt} → ${r.car.leavesForWorkAt}`,
          plan: [r.tariffName, ...r.extras].join(', '),
          washer: r.washerName ?? '',
          note: r.note,
          status: r.status,
          scheduled: r.scheduledDate,
        } satisfies Record<ColumnKey, string | number>);
        row.getCell('scheduled').font = { color: { argb: 'FF8A9099' } };
      });
      ws.autoFilter = { from: 'A1', to: `M1` };
    }

    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    const to = addDays(from, count - 1);
    return { filename: `wooa-daysheet-${from}${count > 1 ? `_to_${to}` : ''}.xlsx`, buffer };
  }

  /** Reads an edited workbook and returns what it would change, without saving anything. */
  async preview(file?: { buffer: Buffer; size: number; originalname?: string }) {
    if (!file?.buffer?.length) throw new BadRequestException('Attach an .xlsx file');
    if (file.size > MAX_IMPORT_BYTES) throw new BadRequestException('The file is too large (2 MB at most)');
    const book = new ExcelJS.Workbook();
    try {
      await book.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('This is not a readable .xlsx file. Export a day sheet and edit that file.');
    }

    const problems: ImportProblem[] = [];
    const parsed: { sheet: string; row: number; order: number; day: string; plate: string; washer: string; note: string; scheduled: string }[] = [];
    const covered = new Set<string>();

    for (const ws of book.worksheets) {
      const tabDate = ws.name.slice(0, 10);
      if (!DATE_RE.test(tabDate) || !isValidDate(tabDate)) continue; // not a day tab
      covered.add(tabDate);
      const col = this.columnMap(ws);
      if (!col.plate || !col.day) {
        problems.push({ sheet: ws.name, row: 1, plateNumber: '', message: 'Missing the "Plate number" or "Day" column' });
        continue;
      }
      ws.eachRow((row, n) => {
        if (n === 1 || parsed.length >= MAX_IMPORT_ROWS) return;
        const plate = text(row.getCell(col.plate!).value).toUpperCase();
        if (!plate) return;
        const day = dateText(row.getCell(col.day!).value) || tabDate;
        const order = Number(text(col.order ? row.getCell(col.order).value : '')) || 9999;
        parsed.push({
          sheet: ws.name,
          row: n,
          order,
          day,
          plate,
          washer: col.washer ? text(row.getCell(col.washer).value) : '',
          note: col.note ? text(row.getCell(col.note).value) : '',
          scheduled: col.scheduled ? dateText(row.getCell(col.scheduled).value) : '',
        });
      });
    }
    if (covered.size === 0) throw new BadRequestException('No day tabs found. Use a file exported from the day sheet.');

    // look up cars, plans and staff
    const plates = [...new Set(parsed.map((p) => p.plate))];
    const cars = await this.cars.find({ plateNumber: { $in: plates } }).select('_id plateNumber').lean().exec();
    const carByPlate = new Map(cars.map((c) => [c.plateNumber.toUpperCase(), c]));
    const subs = await this.subs
      .find({ car: { $in: cars.map((c) => c._id) }, status: SubscriptionStatus.Active })
      .select('car schedule startDate')
      .lean()
      .exec();
    const subByCar = new Map(subs.map((s) => [s.car.toString(), s]));
    const staff = await this.sheets.staff();
    const staffByName = new Map(staff.map((s) => [s.name.trim().toLowerCase(), s]));

    // current state of every day the file touches
    const days = new Set<string>(covered);
    for (const p of parsed) if (DATE_RE.test(p.day) && isValidDate(p.day)) days.add(p.day);
    const current = new Map<string, SheetRows>();
    for (const d of [...days].sort()) current.set(d, (await this.sheets.get(d)).rows);
    const currentByKey = new Map<string, { date: string; index: number; row: SheetRows[number] }>();
    for (const [date, rows] of current) rows.forEach((row, index) => currentByKey.set(washKey(row.subscriptionId, row.scheduledDate), { date, index, row }));

    // turn file rows into planned washes
    const seen = new Set<string>();
    const placed: { day: string; order: number; seq: number; key: string; subscriptionId: string; scheduledDate: string; washerId?: string; washerName: string | null; note: string; plate: string }[] = [];
    parsed.forEach((p, seq) => {
      const problem = (message: string) => problems.push({ sheet: p.sheet, row: p.row, plateNumber: p.plate, message });
      if (!DATE_RE.test(p.day) || !isValidDate(p.day)) return problem(`"${p.day}" is not a date (use YYYY-MM-DD)`);
      const car = carByPlate.get(p.plate);
      const sub = car ? subByCar.get(car._id.toString()) : undefined;
      if (!sub) return problem('No car with an active plan has this plate; ignored');
      const scheduledDate = p.scheduled || p.day;
      if (scheduledDate < sub.startDate || !isWashDay(sub.schedule, scheduledDate)) {
        return problem(`This car has no wash scheduled on ${scheduledDate}; add it in the app instead`);
      }
      const key = washKey(sub._id, scheduledDate);
      if (seen.has(key)) return problem('The same wash appears twice; only the first row is used');
      seen.add(key);

      const was = currentByKey.get(key);
      if (was && was.row.status !== 'planned' && was.date !== p.day) {
        return problem(`Already ${was.row.status === 'done' ? 'washed' : 'skipped'}; it stays on ${dayLabel(was.date)}`);
      }
      let washerId: string | undefined;
      let washerName: string | null = null;
      if (p.washer) {
        const s = staffByName.get(p.washer.trim().toLowerCase());
        if (s) {
          washerId = s.id;
          washerName = s.name;
        } else {
          problem(`No washer called "${p.washer}"; washer left as it was`);
          washerId = was?.row.washerId ?? undefined;
          washerName = was?.row.washerName ?? null;
        }
      }
      placed.push({ day: p.day, order: p.order, seq, key, subscriptionId: sub._id.toString(), scheduledDate, washerId, washerName, note: p.note, plate: p.plate });
    });

    // build the new sheets: covered days are exactly what the file says; other days keep their rows
    const placedKeys = new Set(placed.map((p) => p.key));
    const plan: ImportPlan[] = [];
    const changes: ImportChange[] = [];
    let unchanged = 0;

    for (const date of [...days].sort()) {
      const before = current.get(date) ?? [];
      const fromFile = placed.filter((p) => p.day === date).sort((a, b) => a.order - b.order || a.seq - b.seq);
      const kept = covered.has(date) ? [] : before.filter((r) => !placedKeys.has(washKey(r.subscriptionId, r.scheduledDate)));
      // washed or skipped rows of a covered day that the file dropped stay where they are
      const locked = covered.has(date)
        ? before.filter((r) => r.status !== 'planned' && !placedKeys.has(washKey(r.subscriptionId, r.scheduledDate)))
        : [];
      const rows = [
        ...kept.map((r) => ({ subscriptionId: r.subscriptionId, scheduledDate: r.scheduledDate, washerId: r.washerId ?? undefined, note: r.note })),
        ...locked.map((r) => ({ subscriptionId: r.subscriptionId, scheduledDate: r.scheduledDate, washerId: r.washerId ?? undefined, note: r.note })),
        ...fromFile.map((p) => ({ subscriptionId: p.subscriptionId, scheduledDate: p.scheduledDate, washerId: p.washerId, note: p.note })),
      ];

      const sameAsBefore =
        rows.length === before.length &&
        rows.every((r, i) => {
          const b = before[i];
          return washKey(r.subscriptionId, r.scheduledDate) === washKey(b.subscriptionId, b.scheduledDate) && (r.washerId ?? null) === (b.washerId ?? null) && (r.note ?? '') === (b.note ?? '');
        });
      if (!sameAsBefore) plan.push({ date, rows });

      // describe the changes
      for (const r of before) {
        const key = washKey(r.subscriptionId, r.scheduledDate);
        if (r.status !== 'planned') continue;
        if (covered.has(date) && !placedKeys.has(key)) {
          changes.push({ type: 'removed', plateNumber: r.car.plateNumber, date, detail: `taken off ${dayLabel(date)}` });
        }
      }
      fromFile.forEach((p) => {
        const was = currentByKey.get(p.key);
        const newIndex = rows.findIndex((r) => washKey(r.subscriptionId, r.scheduledDate) === p.key);
        if (!was) {
          changes.push({ type: 'added', plateNumber: p.plate, date, detail: `added to ${dayLabel(date)}` });
          return;
        }
        let changed = false;
        if (was.date !== date) {
          changes.push({ type: 'moved', plateNumber: p.plate, date, detail: `moves from ${dayLabel(was.date)} to ${dayLabel(date)}` });
          changed = true;
        } else if (was.index !== newIndex) {
          changes.push({ type: 'order', plateNumber: p.plate, date, detail: `${dayLabel(date)}: moves from ${was.index + 1} to ${newIndex + 1}` });
          changed = true;
        }
        if ((was.row.washerId ?? null) !== (p.washerId ?? null)) {
          changes.push({ type: 'washer', plateNumber: p.plate, date, detail: `washer: ${was.row.washerName ?? 'nobody'} → ${p.washerName ?? 'nobody'}` });
          changed = true;
        }
        if ((was.row.note ?? '') !== p.note) {
          changes.push({ type: 'note', plateNumber: p.plate, date, detail: p.note ? `note: “${p.note}”` : 'note removed' });
          changed = true;
        }
        if (!changed) unchanged++;
      });
    }

    return {
      filename: file.originalname ?? null,
      rowsRead: parsed.length,
      days: [...days].sort(),
      unchanged,
      changes,
      problems,
      plan,
    };
  }

  /** Saves the sheets from a preview. Every row is validated again by the day sheet service. */
  async apply(admin: AuthUser, plan: ImportPlan[]) {
    if (plan.length === 0) return { saved: [] as string[] };
    if (plan.length > MAX_EXPORT_DAYS * 2) throw new BadRequestException('Too many days in one import');
    for (const day of plan) {
      if (!isValidDate(day.date)) throw new BadRequestException('Invalid date in the import');
      await this.sheets.save(admin, day.date, day.rows);
    }
    return { saved: plan.map((d) => d.date) };
  }

  private columnMap(ws: ExcelJS.Worksheet): Partial<Record<ColumnKey, number>> {
    const map: Partial<Record<ColumnKey, number>> = {};
    ws.getRow(1).eachCell((cell, n) => {
      const header = text(cell.value).toLowerCase();
      const column = COLUMNS.find((c) => header.startsWith(c.header.toLowerCase().split(' (')[0]));
      if (column && !map[column.key]) map[column.key] = n;
    });
    return map;
  }
}

/** Plain text of a cell (rich text, formulas, numbers). */
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('').trim();
    if ('result' in value) return text(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text).trim();
  }
  return String(value).trim();
}

/** A date cell (Excel date or text) as YYYY-MM-DD. */
function dateText(value: ExcelJS.CellValue): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = text(value);
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : s;
}

