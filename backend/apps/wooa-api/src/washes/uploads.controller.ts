import { Controller, Get, NotFoundException, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { StorageService } from './storage.service';

/**
 * Wash photos. A link only works with the signature the API put on it (StorageService.url),
 * so photos are not public: a member gets links only for washes of their own cars.
 */
@ApiExcludeController()
@SkipThrottle() // a wash page loads up to 20 photos at once
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  async file(
    @Param('key') rawKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    // the same answer for a bad link and a missing file: nothing to learn by guessing
    const notFound = new NotFoundException('Photo not found');
    if (!StorageService.verify(key, exp, sig)) throw notFound;
    let path: string;
    try {
      path = this.storage.pathFor(key);
      if (!(await stat(path)).isFile()) throw notFound;
    } catch {
      throw notFound;
    }
    res.set({ 'Cache-Control': 'private, max-age=3600' });
    return new StreamableFile(createReadStream(path), { type: 'image/jpeg' });
  }
}
