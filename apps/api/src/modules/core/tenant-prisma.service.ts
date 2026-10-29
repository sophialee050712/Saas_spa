import type { TenantContext } from './tenant-context.js';

// Giao dien toi thieu cua client DB ma TenantPrismaService can.
// Khi co Prisma that, M00 se cung cap mot adapter co $transaction, $executeRaw
// va $queryRaw tuong ung; module nghiep vu KHONG import PrismaClient truc tiep.
export interface DbClient {
  $executeRaw(query: string, ...params: unknown[]): Promise<number>;
  $queryRaw(query: string, ...params: unknown[]): Promise<unknown>;
  $transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
}

export const SET_TENANT_SQL = "SELECT set_config('app.tenant_id', $1, true)";

// TenantPrismaService: moi request chay trong 1 transaction, cau dau tien
// luon la set_config app.tenant_id (tham so true = chi song trong transaction,
// an toan voi PgBouncer transaction pooling). RLS la lop chan cuoi.
export class TenantPrismaService {
  constructor(private readonly client: DbClient) {}

  async withTenant<T>(ctx: TenantContext, fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$executeRaw(SET_TENANT_SQL, ctx.tenantId);
      return fn(tx);
    });
  }
}
