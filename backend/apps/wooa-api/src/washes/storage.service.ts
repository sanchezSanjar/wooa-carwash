import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';

/** Where uploads live on the server. Served only through signed links (see UploadsController). */
export const uploadRoot = () => resolve(process.env.UPLOAD_DIR || 'uploads');

const HOUR = 3600;

/** Key for photo links, derived from JWT_SECRET so there is no extra setting to manage. */
const linkKey = () => createHmac('sha256', process.env.JWT_SECRET ?? '').update('photo-links').digest();
const sign = (key: string, exp: number) => createHmac('sha256', linkKey()).update(`${key}:${exp}`).digest('base64url');

/** Files on the server's disk (keep the folder outside the code so rebuilds don't wipe it). */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (err: any) {
      if (err?.code !== 'ENOENT') this.logger.warn(`Could not delete ${key}: ${err?.message}`);
    }
  }

  /**
   * A link to a photo that works for 1 to 2 hours, e.g. "/uploads/washes/…/x.jpg?exp=…&sig=…".
   * Only members allowed to see the wash get it (from the wash detail). The link stays the same
   * for a whole hour, so the app can cache the image.
   */
  static url(key: string, now = Date.now()): string {
    const exp = (Math.floor(now / 1000 / HOUR) + 2) * HOUR;
    return `/uploads/${key}?exp=${exp}&sig=${sign(key, exp)}`;
  }

  /** True when a link was made by url() and has not expired. */
  static verify(key: string, exp: string | undefined, sig: string | undefined, now = Date.now()): boolean {
    const expires = Number(exp);
    if (!sig || !Number.isInteger(expires) || expires * 1000 < now) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(sign(key, expires));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Never lets a key escape the uploads folder. */
  pathFor(key: string): string {
    const root = uploadRoot();
    const path = normalize(join(root, key));
    if (!path.startsWith(root + sep)) throw new Error('Invalid storage key');
    return path;
  }
}
