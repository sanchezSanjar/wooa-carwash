import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Otp, OtpSchema } from '@app/common/schemas/otp.schema';
import { RevokedToken, RevokedTokenSchema } from '@app/common/schemas/revoked-token.schema';
import { User, UserSchema } from '@app/common/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, JwtStrategy } from './jwt.strategy';
import { LoginAttempts } from './login-attempts';
import { OtpService } from './otp.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: Otp.name, schema: OtpSchema },
      { name: User.name, schema: UserSchema },
      { name: RevokedToken.name, schema: RevokedTokenSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy, JwtAuthGuard, LoginAttempts],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
