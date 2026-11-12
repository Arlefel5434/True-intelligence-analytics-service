import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccessTokenStrategy } from './access-token.strategy.js';
import { AUTH_CONFIG } from './auth.constants.js';
import { readAuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OriginGuard } from './origin.guard.js';

@Module({
  imports: [
    JwtModule.register({}),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: readAuthConfig },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    AuthService,
    AccessTokenStrategy,
  ],
  exports: [AUTH_CONFIG],
})
export class AuthModule {}
