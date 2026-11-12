import { z } from 'zod';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const providerRecordSchema = z
  .object({
    externalId: z.string().min(1),
    externalBranchId: z.string().min(1).max(128),
    date: z.string().regex(datePattern),
    views: z.number().int().nonnegative(),
    searches: z.number().int().nonnegative(),
    websiteClicks: z.number().int().nonnegative(),
    calls: z.number().int().nonnegative(),
    routeBuilds: z.number().int().nonnegative(),
    newReviewsCount: z.number().int().nonnegative(),
    averageRating: z.number().min(1).max(5).nullable(),
  })
  .refine(
    (record) =>
      (record.newReviewsCount === 0 && record.averageRating === null) ||
      (record.newReviewsCount > 0 && record.averageRating !== null),
    { message: 'averageRating is inconsistent with newReviewsCount' },
  );

export const providerPageSchema = z.object({
  items: z.array(providerRecordSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative().max(1_000),
  }),
});

export type ProviderRecord = z.infer<typeof providerRecordSchema>;
export type ProviderPage = z.infer<typeof providerPageSchema>;
