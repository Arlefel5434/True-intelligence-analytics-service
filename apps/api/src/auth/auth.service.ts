import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import type { AuthProfile, IssuedSession } from './auth.types.js';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$S1MZIR697Oxhp7+NIFLizQ$qLda5AS8i0cO+irXut2LPEP2E9MqtDd/BJ9V+gutae4';
const INVALID_CREDENTIALS = 'Invalid email or password';
const MAX_TRANSACTION_ATTEMPTS = 3;

type RotationResult =
  | { kind: 'success'; profile: AuthProfile; refreshExpiresAt: Date }
  | { kind: 'rejected' };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async login(email: string, password: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordValid = await argon2.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );
    if (!user || !passwordValid)
      throw new UnauthorizedException(INVALID_CREDENTIALS);

    const profile = this.toProfile(user);
    const refreshToken = this.createRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + this.config.refreshTtlSeconds * 1_000,
    );
    await this.prisma.refreshSession.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      profile,
      accessToken: await this.createAccessToken(profile),
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<IssuedSession | null> {
    if (!refreshToken) return null;

    const oldTokenHash = this.hashRefreshToken(refreshToken);
    const newRefreshToken = this.createRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRefreshToken);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.rotate(oldTokenHash, newTokenHash);
        if (result.kind === 'rejected') return null;
        return {
          profile: result.profile,
          accessToken: await this.createAccessToken(result.profile),
          refreshToken: newRefreshToken,
          refreshExpiresAt: result.refreshExpiresAt,
        };
      } catch (error) {
        if (
          !this.isSerializationConflict(error) ||
          attempt === MAX_TRANSACTION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
    return null;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<AuthProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toProfile(user);
  }

  private async rotate(
    oldTokenHash: string,
    newTokenHash: string,
  ): Promise<RotationResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const now = new Date();
        const session = await transaction.refreshSession.findUnique({
          where: { tokenHash: oldTokenHash },
          include: { user: true },
        });
        if (!session) return { kind: 'rejected' };

        if (session.revokedAt) {
          if (session.replacedById) {
            await transaction.refreshSession.updateMany({
              where: { familyId: session.familyId, revokedAt: null },
              data: { revokedAt: now },
            });
          }
          return { kind: 'rejected' };
        }

        if (session.expiresAt <= now) {
          await transaction.refreshSession.update({
            where: { id: session.id },
            data: { revokedAt: now },
          });
          return { kind: 'rejected' };
        }

        const replacementId = randomUUID();
        const revoked = await transaction.refreshSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now },
        });
        if (revoked.count !== 1) return { kind: 'rejected' };

        await transaction.refreshSession.create({
          data: {
            id: replacementId,
            userId: session.userId,
            familyId: session.familyId,
            tokenHash: newTokenHash,
            expiresAt: session.expiresAt,
          },
        });
        await transaction.refreshSession.update({
          where: { id: session.id },
          data: { replacedById: replacementId },
        });

        return {
          kind: 'success',
          profile: this.toProfile(session.user),
          refreshExpiresAt: session.expiresAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createAccessToken(profile: AuthProfile): Promise<string> {
    return this.jwt.signAsync(
      { sub: profile.id, role: profile.role, companyId: profile.companyId },
      {
        secret: this.config.accessSecret,
        algorithm: 'HS256',
        expiresIn: this.config.accessTtlSeconds,
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );
  }

  private createRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.refreshSecret)
      .update(token)
      .digest('hex');
  }

  private toProfile(user: AuthProfile): AuthProfile {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }

  private isSerializationConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }
}
