// packages/db o GĐ0 KHONG tao PrismaClient. Chi export duong dan schema/migration
// de apps/api (M00 core) la noi duy nhat duoc phep khoi tao client that.
// Ly do: tranh phai chay `prisma generate` trong moi truong chua co DB that;
// khi co DB, chay `prisma generate` roi M00 se import @prisma/client.
export const PRISMA_SCHEMA_PATH = 'prisma/schema.prisma';
export const GD0_MIGRATIONS = [
  'prisma/migrations/0001_gd0_init/migration.sql',
  'prisma/migrations/0002_gd0_rls/migration.sql',
] as const;
