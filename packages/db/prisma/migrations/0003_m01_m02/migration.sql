-- 0003_m01_m02: M01 platform + M02 org (Approved 2026-10-29).
-- Khong sua migration 0001/0002. Chay duoc tren DB da co du lieu:
-- cot moi NOT NULL deu co DEFAULT, bang moi tao IF NOT EXISTS.
-- Bang platform (tenants/plans/subscriptions/subscription_invoices/platform_admins)
-- KHONG RLS: chi role app_platform duoc quyen. Moi bang co tenant_id khac deu
-- ENABLE + FORCE RLS + policy tenant_isolation.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry_template_code text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days int NOT NULL DEFAULT 14;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT 'main';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_failed_count int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_failed_count int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS branches_tenant_code_unique ON branches (tenant_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  plan_id uuid NOT NULL REFERENCES plans(id), status text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz, current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_tenant_created ON subscriptions (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id),
  period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_invoices_tenant_created ON subscription_invoices (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS platform_admins (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  two_factor_secret_encrypted text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id uuid NOT NULL REFERENCES tenants(id), module_code text NOT NULL,
  entitled boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, module_code)
);
CREATE INDEX IF NOT EXISTS tenant_modules_tenant_module ON tenant_modules (tenant_id, module_code);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL, name text NOT NULL, is_system boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS roles_tenant_code ON roles (tenant_id, code);

CREATE TABLE IF NOT EXISTS permissions (
  code text PRIMARY KEY, module_code text NOT NULL, description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS permissions_module ON permissions (module_code);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id), permission_code text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}', tenant_id uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (role_id, permission_code)
);
CREATE INDEX IF NOT EXISTS role_permissions_tenant_role ON role_permissions (tenant_id, role_id);

CREATE TABLE IF NOT EXISTS user_branch_roles (
  user_id uuid NOT NULL REFERENCES users(id), branch_id uuid NOT NULL REFERENCES branches(id),
  role_id uuid NOT NULL REFERENCES roles(id), tenant_id uuid NOT NULL REFERENCES tenants(id),
  PRIMARY KEY (tenant_id, user_id, branch_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_branch_roles_tenant_user ON user_branch_roles (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS user_branch_roles_tenant_branch ON user_branch_roles (tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  tenant_id uuid REFERENCES tenants(id), expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_tenant ON refresh_tokens (tenant_id);

-- RLS cho moi bang co tenant_id moi (permissions khong co tenant_id, khong RLS).
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_modules
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_permissions
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_branch_roles
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON refresh_tokens
  USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
-- Luu y: refresh_tokens co tenant_id NULL cho platform admin thi policy tren
-- se chan (current_setting tra uuid khac NULL); token platform khong luu o day
-- trong M01 (platform refresh chi luu trong memory cua service, xem bao cao).
