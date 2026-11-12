import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  DataSource,
  ImportStatus,
  PrismaClient,
  ReviewStatus,
  UserRole,
} from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const DEMO_PASSWORD = 'Demo123!ChangeMe';

const ids = {
  companyA: '10000000-0000-4000-8000-000000000001',
  companyB: '10000000-0000-4000-8000-000000000002',
  admin: '20000000-0000-4000-8000-000000000001',
  clientA: '20000000-0000-4000-8000-000000000002',
  clientB: '20000000-0000-4000-8000-000000000003',
  branchA1: '30000000-0000-4000-8000-000000000001',
  branchA2: '30000000-0000-4000-8000-000000000002',
  branchB1: '30000000-0000-4000-8000-000000000003',
  importRun: '50000000-0000-4000-8000-000000000001',
} as const;

const companies = [
  { id: ids.companyA, name: 'Северная чашка' },
  { id: ids.companyB, name: 'Городская пекарня' },
] as const;

const branches = [
  {
    id: ids.branchA1,
    companyId: ids.companyA,
    externalId: 'mock-branch-a-1',
    name: 'Северная чашка — Центр',
    address: 'г. Тестоград, ул. Центральная, 10',
  },
  {
    id: ids.branchA2,
    companyId: ids.companyA,
    externalId: 'mock-branch-a-2',
    name: 'Северная чашка — Парк',
    address: 'г. Тестоград, Парковый проспект, 4',
  },
  {
    id: ids.branchB1,
    companyId: ids.companyB,
    externalId: 'mock-branch-b-1',
    name: 'Городская пекарня — Вокзал',
    address: 'г. Тестоград, Вокзальная площадь, 2',
  },
] as const;

const reviews = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    branchId: ids.branchA1,
    rating: 5,
    text: 'Уютное место и быстрый сервис.',
    publishedAt: new Date('2026-10-04T10:15:00.000Z'),
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    branchId: ids.branchA1,
    rating: 4,
    text: 'Хороший кофе, хотелось бы больше столиков.',
    publishedAt: new Date('2026-10-12T14:30:00.000Z'),
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    branchId: ids.branchA2,
    rating: 5,
    text: 'Удобно зайти после прогулки.',
    publishedAt: new Date('2026-10-18T09:00:00.000Z'),
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    branchId: ids.branchB1,
    rating: 4,
    text: 'Свежая выпечка и вежливые сотрудники.',
    publishedAt: new Date('2026-10-09T07:45:00.000Z'),
  },
  {
    id: '40000000-0000-4000-8000-000000000005',
    branchId: ids.branchB1,
    rating: 3,
    text: 'В часы пик приходится подождать.',
    status: ReviewStatus.ARCHIVED,
    publishedAt: new Date('2026-10-23T16:20:00.000Z'),
  },
] as const;

function dateAt(day: number): Date {
  return new Date(Date.UTC(2026, 9, day));
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });

  for (const company of companies) {
    await prisma.company.upsert({
      where: { id: company.id },
      create: company,
      update: { name: company.name },
    });
  }

  const users = [
    {
      id: ids.admin,
      email: 'admin@example.test',
      role: UserRole.ADMIN,
      companyId: null,
    },
    {
      id: ids.clientA,
      email: 'client.a@example.test',
      role: UserRole.CLIENT,
      companyId: ids.companyA,
    },
    {
      id: ids.clientB,
      email: 'client.b@example.test',
      role: UserRole.CLIENT,
      companyId: ids.companyB,
    },
  ] as const;
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { role: user.role, companyId: user.companyId, passwordHash },
    });
  }

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { externalId: branch.externalId },
      create: branch,
      update: {
        companyId: branch.companyId,
        name: branch.name,
        address: branch.address,
      },
    });
  }

  for (const [branchIndex, branch] of branches.entries()) {
    for (let day = 1; day <= 30; day += 1) {
      const externalId = `${branch.externalId}:2026-10-${String(day).padStart(2, '0')}`;
      const newReviewsCount = (day + branchIndex) % 6 === 0 ? 2 : 0;
      const metric = {
        id: `60000000-0000-4000-8000-${String(branchIndex + 1).padStart(4, '0')}${String(day).padStart(8, '0')}`,
        branchId: branch.id,
        date: dateAt(day),
        views: 80 + branchIndex * 25 + day * 3,
        searches: 35 + branchIndex * 12 + day * 2,
        routeBuilds: 8 + branchIndex * 3 + (day % 9),
        calls: 3 + branchIndex + (day % 5),
        websiteClicks: 10 + branchIndex * 4 + (day % 11),
        newReviewsCount,
        averageRating:
          newReviewsCount === 0
            ? null
            : String(4 + ((day + branchIndex) % 3) * 0.25),
        source: DataSource.MOCK_PROVIDER,
        externalId,
      };
      await prisma.dailyMetric.upsert({
        where: { source_externalId: { source: metric.source, externalId } },
        create: metric,
        update: {
          branchId: metric.branchId,
          date: metric.date,
          views: metric.views,
          searches: metric.searches,
          routeBuilds: metric.routeBuilds,
          calls: metric.calls,
          websiteClicks: metric.websiteClicks,
          newReviewsCount: metric.newReviewsCount,
          averageRating: metric.averageRating,
        },
      });
    }
  }

  for (const review of reviews) {
    const status = 'status' in review ? review.status : ReviewStatus.PUBLISHED;
    await prisma.review.upsert({
      where: { id: review.id },
      create: { ...review, status },
      update: {
        branchId: review.branchId,
        rating: review.rating,
        text: review.text,
        status,
        publishedAt: review.publishedAt,
      },
    });
  }

  await prisma.importRun.upsert({
    where: { id: ids.importRun },
    create: {
      id: ids.importRun,
      source: DataSource.MOCK_PROVIDER,
      dateFrom: dateAt(1),
      dateTo: dateAt(30),
      status: ImportStatus.COMPLETED,
      createdCount: 90,
      updatedCount: 0,
      skippedCount: 0,
      warnings: [],
      triggeredById: ids.admin,
      startedAt: new Date('2026-10-31T10:00:00.000Z'),
      finishedAt: new Date('2026-10-31T10:00:02.000Z'),
    },
    update: {
      status: ImportStatus.COMPLETED,
      createdCount: 90,
      updatedCount: 0,
      skippedCount: 0,
      warnings: [],
      errorMessage: null,
      triggeredById: ids.admin,
      finishedAt: new Date('2026-10-31T10:00:02.000Z'),
    },
  });
}

main()
  .then(() =>
    console.info(
      'Seed completed: 2 companies, 3 branches, 3 users, 90 metrics, 5 reviews.',
    ),
  )
  .finally(async () => prisma.$disconnect());
