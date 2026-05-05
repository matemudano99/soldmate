# Multi-tenant hardening (shared DB)

## Current baseline

- Tenant isolation is enforced in backend services and repositories using `company_id` from JWT.
- Client payloads do not carry `company_id`.
- Core tables have composite indexes for common tenant filters.

## Optional next layer: Postgres Row-Level Security (RLS)

RLS is optional defense in depth. Keep backend tenant filters even with RLS enabled.

### 1) Add an app-level tenant setting per DB session

Set a local setting at connection/session level before queries:

- key: `app.current_company_id`
- value: tenant id from JWT

Example SQL:

```sql
SELECT set_config('app.current_company_id', '123', true);
```

### 2) Enable RLS in tenant tables

Example for `incidents`:

```sql
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;
```

### 3) Create tenant policies

```sql
CREATE POLICY incidents_tenant_isolation ON incidents
USING (company_id = current_setting('app.current_company_id', true)::bigint)
WITH CHECK (company_id = current_setting('app.current_company_id', true)::bigint);
```

Repeat for: `products`, `suppliers`, `contacts`, `calendar_events`, `sale_records`, `shift_plans`, `purchase_suggestions`, `company_settings`, and `users`.

### 4) Rollout strategy

- Start in staging with read-heavy endpoints.
- Validate CRUD flows for tenant A/B.
- Monitor query plans and policy overhead.
- Enable gradually in production table by table.

### 5) Risk notes

- Missing `set_config` per request can deny valid queries.
- Superuser/service roles can bypass RLS unless restricted.
- Keep integration tests for cross-tenant ID access (`404/403`).
