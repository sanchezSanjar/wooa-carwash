import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/** One MongoDB connection setup shared by the API and the batch server (MONGODB_URI in .env). */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>('MONGODB_URI') }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
