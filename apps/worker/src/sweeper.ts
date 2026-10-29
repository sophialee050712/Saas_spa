// Sweeper GĐ0: goi sys.claim_pending_outbox qua DbClient toi thieu.
// BullMQ consumer that (hoa hong, HĐĐT, ZNS, kho, hang khach) se lam o
// cac module tuong ung, sau khi co Redis that. Worker nay chi vot event
// pending > 30s, khong xu ly nghiep vu trong GĐ0.
export interface SweeperClient {
  queryClaimPending(limit: number): Promise<Array<{ eventId: string; tenantId: string }>>;
}

export const SWEEPER_INTERVAL_MS = 60_000;
export const SWEEPER_BATCH_LIMIT = 100;

export async function sweepOnce(client: SweeperClient): Promise<number> {
  const claimed = await client.queryClaimPending(SWEEPER_BATCH_LIMIT);
  return claimed.length;
}
