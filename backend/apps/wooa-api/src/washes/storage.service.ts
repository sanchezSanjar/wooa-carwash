import { Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve, sep } from 'path';

/** Where uploads live on the server. Served at /uploads/<key>. */
export const uploadRoot = () => resolve(process.env.UPLOAD_DIR || 'uploads');

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

  /** Public path for a key, e.g. "/uploads/washes/…/x.jpg". */
  static url(key: string): string {
    return `/uploads/${key}`;
  }

  /** Never lets a key escape the uploads folder. */
  private pathFor(key: string): string {
    const root = uploadRoot();
    const path = normalize(join(root, key));
    if (!path.startsWith(root + sep)) throw new Error('Invalid storage key');
    return path;
  }
}
