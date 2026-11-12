import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UserRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CompanyContext } from './company-context.types.js';

@Injectable()
export class CompanyContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    user: AuthenticatedUser,
    rawCompanyId: string | string[] | undefined,
  ): Promise<CompanyContext> {
    if (user.role === UserRole.CLIENT) {
      if (rawCompanyId !== undefined) {
        throw new BadRequestException(
          'Clients must not provide the X-Company-Id header',
        );
      }
      if (!user.companyId) throw new UnauthorizedException();
      return { userId: user.sub, role: user.role, companyId: user.companyId };
    }

    if (user.role !== UserRole.ADMIN) throw new UnauthorizedException();
    const companyId = this.parseAdminCompanyId(rawCompanyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return { userId: user.sub, role: user.role, companyId: company.id };
  }

  private parseAdminCompanyId(
    rawCompanyId: string | string[] | undefined,
  ): string {
    if (rawCompanyId === undefined) {
      throw new BadRequestException('X-Company-Id header is required');
    }
    if (
      Array.isArray(rawCompanyId) ||
      rawCompanyId.length === 0 ||
      rawCompanyId !== rawCompanyId.trim() ||
      rawCompanyId.includes(',') ||
      !isUUID(rawCompanyId)
    ) {
      throw new BadRequestException('X-Company-Id must be a single UUID');
    }
    return rawCompanyId;
  }
}
