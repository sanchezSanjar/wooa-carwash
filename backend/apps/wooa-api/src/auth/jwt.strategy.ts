import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, type TokenPayload } from './auth.service';
import type { AuthUser } from './roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Looks the member up on every request, so role changes and blocks apply at once. */
  validate(payload: TokenPayload): Promise<AuthUser> {
    return this.auth.validate(payload);
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
