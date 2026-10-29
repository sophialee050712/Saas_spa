-- 0002_gd0_rls: bat RLS cho moi bang co tenant_id (tru bang platform tenants/plans).
-- Policy chuan: tenant_id = current_setting('app.tenant_id', false)::uuid.
-- Thieu app.tenant_id -> current_setting(..., false) bao loi, truy van dung (luat 5).
-- Bang tenants/plans KHONG co RLS: chi Platform API (role app_platform) duoc doc.
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON branches
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON settings
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON idempotency_keys
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON outbox_events
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON processed_events
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
