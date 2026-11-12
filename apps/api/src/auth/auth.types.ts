import type { UserRole } from '../generated/prisma/client.js';

export type AuthProfile = {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
};

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
