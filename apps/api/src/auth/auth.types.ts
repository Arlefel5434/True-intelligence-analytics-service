import type { UserRole } from '../generated/prisma/client.js';
import { ApiProperty } from '@nestjs/swagger';

export class AuthProfile {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty({ enum: ['ADMIN', 'CLIENT'] })
  role!: UserRole;
  @ApiProperty({ type: String, nullable: true })
  companyId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  companyName!: string | null;
}

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  companyId: string | null;
};

export type AuthenticatedUser = AccessTokenPayload;

export type IssuedSession = {
  profile: AuthProfile;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};
