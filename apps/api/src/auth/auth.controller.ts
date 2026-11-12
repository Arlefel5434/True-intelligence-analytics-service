import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, REFRESH_COOKIE_NAME } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import { clearAuthCookies, setAuthCookies } from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import { AuthProfile, type AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';

function readRefreshToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[REFRESH_COOKIE_NAME];
  return typeof token === 'string' ? token : undefined;
}

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post('login')
  @Public()
  @ApiOkResponse({ type: AuthProfile })
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthProfile> {
    const session = await this.auth.login(
      credentials.email,
      credentials.password,
    );
    setAuthCookies(response, this.config, session);
    return session.profile;
  }

  @Post('refresh')
  @Public()
  @ApiNoContentResponse()
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const session = await this.auth.refresh(readRefreshToken(request));
    if (!session) {
      clearAuthCookies(response, this.config);
      throw new UnauthorizedException();
    }
    setAuthCookies(response, this.config, session);
  }

  @Post('logout')
  @Public()
  @ApiNoContentResponse()
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshToken(request));
    clearAuthCookies(response, this.config);
  }

  @Get('me')
  @ApiOkResponse({ type: AuthProfile })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthProfile> {
    return this.auth.getProfile(user.sub);
  }
}
