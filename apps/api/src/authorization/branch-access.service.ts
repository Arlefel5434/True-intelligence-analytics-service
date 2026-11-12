import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { BranchSummary, CompanyContext } from './company-context.types.js';

const branchProjection = {
  id: true,
  companyId: true,
  externalId: true,
  name: true,
  address: true,
} as const;

@Injectable()
export class BranchAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: CompanyContext): Promise<BranchSummary[]> {
    return this.prisma.branch.findMany({
      where: { companyId: context.companyId },
      select: branchProjection,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async find(context: CompanyContext, id: string): Promise<BranchSummary> {
    const branch = await this.prisma.branch.findFirst({
      where: { id, companyId: context.companyId },
      select: branchProjection,
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
