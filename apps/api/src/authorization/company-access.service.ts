import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type {
  CompanyContext,
  CompanySummary,
} from './company-context.types.js';

const companyProjection = { id: true, name: true } as const;

@Injectable()
export class CompanyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(context: CompanyContext): Promise<CompanySummary> {
    const company = await this.prisma.company.findUnique({
      where: { id: context.companyId },
      select: companyProjection,
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async listForAdmin(): Promise<CompanySummary[]> {
    return this.prisma.company.findMany({
      select: companyProjection,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}
