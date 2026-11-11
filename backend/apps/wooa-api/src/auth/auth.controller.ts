import { Body, Controller, Get, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Lang } from '@app/common/i18n';
import { ReqLang } from '../i18n';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RequestOtpDto, ResetPasswordDto, VerifyOtpDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt.strategy';
import { OtpService } from './otp.service';
import { CurrentUser } from './roles';
import type { AuthUser } from './roles';

/**
 * Sign-up:  POST /auth/otp/request {phone, purpose: signup} → SMS → /auth/otp/verify (signupToken) → /auth/register
 * Reset:    POST /auth/otp/request {phone, purpose: reset} → SMS → /auth/otp/verify (resetToken) → /auth/reset-password
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string, @ReqLang() lang: Lang) {
    return { message: await this.otp.request(dto.phone, dto.purpose, ip ?? 'unknown', lang) };
  }

  @Post('otp/verify')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.otp.verify(dto.phone, dto.purpose, dto.code);
  }

  @Post('register')
  register(@Body() dto: RegisterDto, @ReqLang() lang: Lang) {
    return this.auth.register(dto, lang);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
