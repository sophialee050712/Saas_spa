-- Ham xuyen tenant (ADR-002): SECURITY DEFINER, so huu boi app_sys_definer,
-- search_path co dinh, thu hoi PUBLIC, chi cap EXECUTE cho role can dung.
-- Moi ham lam dung mot viec, tra ve toi thieu cot.
CREATE SCHEMA IF NOT EXISTS sys AUTHORIZATION app_sys_definer;

CREATE OR REPLACE FUNCTION sys.resolve_tenant(p_slug text)
RETURNS TABLE (tenant_id uuid, timezone text, status text, db_secret_ref text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT id, timezone, status, db_secret_ref FROM public.tenants WHERE slug = p_slug
$$;
REVOKE ALL ON FUNCTION sys.resolve_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sys.resolve_tenant(text) TO app_user, app_worker;

CREATE OR REPLACE FUNCTION sys.claim_pending_outbox(p_limit int)
RETURNS TABLE (event_id uuid, tenant_id uuid)
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  UPDATE public.outbox_events o
     SET status = 'dispatching', dispatched_at = now()
   WHERE o.id IN (
     SELECT id FROM public.outbox_events
      WHERE status = 'pending' AND created_at < now() - interval '30 seconds'
      ORDER BY created_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED)
  RETURNING o.id, o.tenant_id
$$;
REVOKE ALL ON FUNCTION sys.claim_pending_outbox(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sys.claim_pending_outbox(int) TO app_worker;

CREATE OR REPLACE FUNCTION sys.requeue_stuck_outbox()
RETURNS integer
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  UPDATE public.outbox_events
     SET status = 'pending', dispatched_at = NULL
   WHERE status = 'dispatching' AND dispatched_at < now() - interval '5 minutes'
  RETURNING 1
$$;
REVOKE ALL ON FUNCTION sys.requeue_stuck_outbox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sys.requeue_stuck_outbox() TO app_worker;
