# GĐ0 — Nền móng (LOCAL ONLY, chưa đẩy GitHub)

Trạng thái: scaffold GĐ0 đã tạo local trong `~/workspace/saas-spa`.
Tài liệu gốc vẫn là `docs/master-plan.md` v2.0 và `AGENTS.md` v2.0. File này
không sửa spec hay master-plan, chỉ ghi lại GĐ0 đã làm gì.

## Đã làm

- Monorepo pnpm workspace: `apps/web`, `apps/api`, `apps/worker`,
  `packages/db`, `packages/shared`, `packages/ui`, `packages/einvoice`.
- Docker Compose local cho Postgres 16 + Redis (định nghĩa file, chưa chạy
  được trong VM này vì không có Docker — xem "Chưa làm" bên dưới).
- `packages/db`: Prisma schema GĐ0 (tenants, plans, branches, users,
  settings, audit_logs, idempotency_keys, outbox_events, processed_events),
  migration 0001 (bảng) + 0002 (RLS), bootstrap roles, hàm `sys.*`,
  policy RLS mẫu, script kiểm tra RLS offline (`check-rls.mjs`) và bản SQL
  cho DB thật (`check-rls.sql`).
- M00 core tối thiểu trong `apps/api`: `TenantPrismaService` (transaction,
  câu đầu `SELECT set_config('app.tenant_id', $1, true)`),
  `TenantMatchGuard` dạng hàm `assertTenantMatch` (lệch → 403
  `TENANT_MISMATCH`), auth SĐT + mật khẩu (hash scrypt, xem lưu ý bên dưới),
  `AbilityGuard`/`ModuleGuard` dạng stub đúng interface, `DomainError`
  với toàn bộ mã trong AGENTS.md mục 4, và server health `/health`.
- `packages/shared`: `formatVnd`, `formatTenantDateTime`,
  `getTenantDayRange` (mặc định Asia/Ho_Chi_Minh), money helpers
  (`toVnd`/`toBigint`/`mulDivRound`/`roundToThousand`), Zod schema
  tenant/auth. Chưa có `calcOrderTotals`/`calcCommission` — thuộc M08/M12.
- `apps/web`: trang tổng quan tối thiểu dùng `packages/ui` + `packages/shared`,
  route `/api/health`.
- Config: script `typecheck`/`lint`/`test`, ESLint thay bằng script kiểm tra
  cấm `any`/`@ts-ignore` (xem "Chưa làm"), Prettier, `.env.example`
  không chứa secret thật.

## Chưa làm và vì sao

- **Chưa chạy Postgres/Redis thật:** VM này không có Docker, `psql`,
  `redis-cli`. Vì vậy chưa chạy `prisma migrate`, chưa chạy integration
  test với Postgres thật, chưa kiểm chứng `check-rls.sql` trên DB thật.
  Chỉ kiểm chứng được script RLS offline bằng file migration.
- **Chưa có NestJS runtime:** `apps/api` GĐ0 là TypeScript thuần +
  server health Node thuần, chưa dùng decorator Nest (`@nestjs/*` chưa
  cài). Cấu trúc module vẫn theo AGENTS.md mục 3 (controller/service/
  facade tách riêng ở các bước sau). Cần dnduy quyết: giữ hướng này rồi
  gắn Nest ở M01, hay cài Nest ngay ở GĐ0 (xem "Cần dnduy quyết").
- **Chưa có BullMQ thật:** `apps/worker` chỉ có sweeper skeleton
  (`sys.claim_pending_outbox`), chưa có consumer BullMQ cho hoa hồng/
  HĐĐT/ZNS/kho. Consumer thuộc về từng module sau.
- **Chưa có ESLint thật:** thay bằng script `scripts/check-no-any.mjs`
  (quét `any` và `@ts-ignore`) vì cài đầy đủ bộ typescript-eslint sẽ
  kéo thêm nhiều dependency; script này đủ cho cổng chặn GĐ0 nhưng không
  thay thế ESLint hoàn chỉnh. Cần dnduy quyết có cài ESLint đầy đủ không.
- **Chưa có Turborepo runtime:** có `turbo.json` nhưng script root chạy
  bằng `pnpm -r` để không phụ thuộc binary turbo trong VM này.
- **Chưa có `prisma generate`:** `packages/db` không tạo PrismaClient ở
  GĐ0 để tránh phụ thuộc DB thật; M00 sẽ là nơi duy nhất tạo client
  khi có DB (theo AGENTS.md luật 1).
- **Chưa có code booking/POS/gói/hoa hồng/báo cáo:** đó là GĐ2–GĐ4,
  sau khi spec từng module được duyệt.

## Cách chạy local (trên máy có Docker + Node 22 + pnpm 10)

```bash
cd ~/workspace/saas-spa
cp .env.example .env.local   # rồi điền secret thật của riêng bạn, không commit
docker compose up -d postgres redis
pnpm install
pnpm --filter @spa-saas/db check-rls
pnpm typecheck
pnpm test
pnpm --filter @spa-saas/web dev      # http://localhost:3000
pnpm --filter @spa-saas/api dev      # http://localhost:3001/health
```

Trên máy có DB thật, sau khi chạy bootstrap roles (bằng tài khoản quản trị
DB, không chạy từ app) thì chạy migration bằng `prisma migrate deploy`
(không dùng `prisma db push` ở bất kỳ môi trường nào).

## Cần dnduy quyết

1. Hash mật khẩu/PIN: GĐ0 dùng scrypt (Node built-in) để không thêm
   dependency; BR-61 ghi argon2id cho PIN. Quyết: giữ scrypt, hay đổi
   sang argon2id ngay (thêm dependency `argon2`) trước M01?
2. NestJS: gắn Nest runtime ngay ở GĐ0 hay giữ server health thuần
   rồi gắn Nest khi làm M01?
3. ESLint đầy đủ (typescript-eslint) có cài ngay không, hay giữ script
   kiểm tra `any` hiện tại cho tới khi có CI thật?
4. Vai trò agent: theo AGENTS.md v2.0, Muse chỉ làm UI, Claude làm lõi/
   db/shared. Scaffold GĐ0 này được làm theo lệnh trực tiếp của parent
   agent (giao toàn bộ việc), vượt phân vai đó. Cần dnduy xác nhận phân
   vai này cho các bước tiếp theo, hoặc sửa AGENTS.md.
5. Thư viện mới đã thêm (lý do ghi rõ): `zod` (validate, theo master-plan),
   `vitest` (unit test), `next`/`react` (web PWA), `typescript`,
   `prettier`, `prisma` (schema/migration, chưa generate client).
   Không thêm thư viện nào khác ngoài danh sách này.

## Bước tiếp theo

Viết và duyệt spec M00 (core), M01 (platform), M02 (org) theo mẫu
`docs/specs/_template/spec-and-prompts.md`, rồi mới code M01/M02.
Không code booking/POS trước khi spec được duyệt.

## Cập nhật M01/M02 (2026-10-29, Approved)

- NestJS đã gắn ở M01 (apps/api chạy Nest, route /health giữ nguyên, trả stage M01).
- Auth đã đổi sang argon2id cho cả mật khẩu và PIN; JWT access 8h, refresh 7 ngày quay vòng; AuthGuard xác thực chữ ký JWT_SECRET rồi mới TenantMatchGuard.
- Schema/migration mới: packages/db migration 0003_m01_m02 (không sửa 0001/0002), RLS offline 12/12 bảng có tenant_id.
- Giới hạn quan trọng: apps/api hiện dùng in-memory store (apps/api/src/store.ts) thay cho Prisma repository vì VM không có Postgres thật; migration 0003 chưa chạy trên DB thật, chưa prisma generate. Khi có DB thật, thay store bằng Prisma adapter, giữ nguyên interface service.
