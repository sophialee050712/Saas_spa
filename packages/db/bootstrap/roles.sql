-- BOOTSTRAP: CHI chay mot lan bang tai khoan quan tri DB (superuser hoac
-- tai khoan co quyen CREATE ROLE), KHONG nam trong migration ung dung,
-- KHONG chay tu app, KHONG commit mat khau that vao day.
-- Sau khi tao role, cap mat khau bang bien moi truong rieng tren may DB.
-- ADR-001: DB dung chung + FORCE RLS; 5 vai tro DB.
CREATE ROLE app_owner LOGIN;
CREATE ROLE app_user LOGIN;
CREATE ROLE app_worker LOGIN;
CREATE ROLE app_platform LOGIN BYPASSRLS;
CREATE ROLE app_sys_definer NOLOGIN BYPASSRLS;

-- app_owner: so huu bang, chay migration. KHONG superuser, KHONG BYPASSRLS
-- (FORCE RLS van chan ca owner, theo master-plan).
-- app_user / app_worker: chi DML tren bang nghiep vu; KHONG quyen tren bang
-- platform (tenants, plans, subscriptions, subscription_invoices, platform_admins).
-- Cap quyen cu the sau khi migration 0001/0002 chay xong, vi du:
--   GRANT SELECT, INSERT, UPDATE, DELETE ON branches, users, settings,
--     audit_logs, idempotency_keys, outbox_events, processed_events TO app_user;
--   GRANT SELECT, INSERT, UPDATE ON outbox_events, processed_events TO app_worker;
--   REVOKE ALL ON tenants, plans FROM app_user, app_worker;
-- app_platform: chi dung trong PlatformPrismaService (M01), sau dang nhap Webgool 2FA.
-- app_sys_definer: chi so huu ham trong schema sys (xem sql/sys-functions.sql).
