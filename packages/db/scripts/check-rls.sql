-- check-rls.sql: chay tren DB that (role app_owner) sau migration.
-- Neu co bang co cot tenant_id ma chua bat RLS/FORCE hoac thieu policy thi bao loi.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.table_name, ', ')
    INTO missing
    FROM information_schema.columns c
    JOIN pg_class cls ON cls.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = 'public'
   WHERE c.column_name = 'tenant_id'
     AND c.table_schema = 'public'
     AND (NOT cls.relrowsecurity OR NOT cls.relforcerowsecurity
       OR NOT EXISTS (
         SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.table_name
       ));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS_MISSING: %', missing;
  END IF;
END $$;
