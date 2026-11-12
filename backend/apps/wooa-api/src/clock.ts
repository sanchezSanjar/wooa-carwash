import { Injectable } from '@nestjs/common';

/** The current time. Tests replace it to act as if a later day had come. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
