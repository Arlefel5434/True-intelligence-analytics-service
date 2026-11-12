# ADR 0002: Company context and scoped data access

## Status

Accepted

## Context

Clients must never access another company's data, including through forged path,
query, body, or header values. Administrators need to work with one explicitly
selected company at a time. Applying authorization after loading a resource can
leak whether another company's resource exists.

## Decision

- Every endpoint requires a valid access JWT unless it is explicitly marked
  `@Public()`.
- Role checks are declared with `@Roles()` or `@AdminOnly()`.
- Company-scoped endpoints are marked `@CompanyScoped()` and receive one
  immutable `CompanyContext` per request.
- A client context always comes from the signed JWT and rejects any
  `X-Company-Id` header. An administrator must send one existing company UUID in
  `X-Company-Id` on each scoped request.
- Data-access services accept `CompanyContext` and include `companyId` in the
  Prisma query itself. A missing and a foreign resource return the same `404`.
- PostgreSQL row-level security is deferred. The MVP uses centralized,
  application-level scoped queries because request-local RLS context is harder
  to guarantee safely with pooled connections.

## Consequences

Controllers do not choose or copy tenant filters. New scoped access paths must
use the shared context and services. The application must retain integration
tests that attempt cross-company access. RLS can be reconsidered if the service
grows beyond one controlled application access layer.
