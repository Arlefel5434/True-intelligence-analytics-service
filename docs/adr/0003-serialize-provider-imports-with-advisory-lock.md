# Serialize provider imports with a PostgreSQL advisory lock

Imports for one external source are intentionally serialized with a PostgreSQL advisory lock held by a dedicated connection. This works across API replicas without keeping a long Prisma transaction open; the MVP rejects a concurrent run immediately instead of implementing the more complex overlapping-date-range coordination.
