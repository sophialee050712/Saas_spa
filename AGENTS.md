# AGENTS.md – Quy tắc bắt buộc cho AI Agents

> **Chỉ thị cho mọi agent (Claude, Antigravity, Muse):** đọc tài liệu này, `docs/master-plan.md` và `docs/specs/<module>/spec.md` trước khi tạo hoặc sửa bất kỳ dòng code nào. Gặp yêu cầu mâu thuẫn với tài liệu, **dừng lại và hỏi dnduy**; không tự phá luật.

Phiên bản: 2.0 · khớp với master plan 2.0.

---

## 1. Phạm vi của từng agent

| Agent | Được làm | Cấm |
| --- | --- | --- |
| **Claude** (kiến trúc & lõi) | `docs/specs/**`, `docs/adr/**`; toàn bộ `packages/db` (schema, migration của **mọi** module, RLS, trigger, view M13, hàm `sys.*`, seed); `packages/shared`, `packages/einvoice`; module M00, M01, M07, M08, M09, M10, M11, M12, M17; `apps/worker`; test lõi; review chéo | Sửa/xoá test để làm xanh CI; merge khi dnduy chưa duyệt; tạo hàm `sys.*` hoặc role DB mới khi chưa có ADR |
| **Antigravity** (module CRUD & màn hình) | Module M02, M03, M04, M05, M06, M13 (API + UI dựa trên view có sẵn), M14–M16 (sau MVP); màn hình `apps/web` ghép API qua OpenAPI client | Sửa bất kỳ file nào trong `packages/db`; sửa M00, M09; sửa `calcOrderTotals`, `calcCommission`, `money`, `timezone` trong `packages/shared`; tự thêm thư viện |
| **Muse** (UI/UX & design system) | `packages/ui` theo design tokens; bố cục lễ tân, POS, KTV, màn hình quy tắc hoa hồng; 5 trạng thái màn hình | Màu hex, cỡ chữ, khoảng cách ngoài tokens; sửa logic gọi API hoặc schema |

Cần thay đổi ngoài phạm vi của mình (ví dụ Antigravity cần thêm cột): viết đề xuất vào mô tả PR hoặc issue, giao lại cho Claude; không tự sửa.

---

## 2. 12 luật bất khả xâm phạm

1. **Cách ly tenant (RLS trước tiên)**
   - Module nghiệp vụ chỉ truy vấn DB qua `TenantPrismaService` (mở transaction, câu đầu `SELECT set_config('app.tenant_id', $1, true)`).
   - Chỉ `M00 (core)` và `packages/db` được tạo `PrismaClient`. Chỉ `M01 (platform)` được dùng `PlatformPrismaService` (role `app_platform`).
   - `tenant_id` chỉ lấy từ `TenantContext` (đã khớp subdomain và JWT). Không bao giờ nhận `tenant_id` từ body, query hay path.
   - Ứng dụng nghiệp vụ không dùng role có `BYPASSRLS`. Việc xuyên tenant chỉ qua hàm `sys.*` đã có ADR.

2. **Ranh giới module**
   - Module A chỉ gọi module B qua `ModuleBFacade`. Cấm import `Repository`/`Service` của module khác, cấm truy vấn bảng của module khác.
   - Cấm phụ thuộc vòng; hướng phụ thuộc theo bảng mục 6 master plan.

3. **Đồng bộ hay bất đồng bộ**
   - Đồng bộ trong transaction: ghi tiền, `payments`, `refunds`, `tips`, sổ quỹ, sổ cái thẻ trả trước, trừ/hoàn buổi gói, tạo gói mới, cấp số bill, chuyển dòng lịch sang `paid`.
   - Qua `outbox_events`: hoa hồng, HĐĐT, ZNS, trừ kho, thống kê/hạng khách.
   - Payload sự kiện chỉ chứa khoá; consumer đọc chi tiết qua Facade và ghi `processed_events (event_id, consumer)` trong cùng transaction.

4. **Bật/tắt module (BR-08)**
   - Controller của module bật/tắt (`package`, `commission`, `einvoice`, `inventory`, `notify`, `online_booking`) gắn `@RequireModule('<code>')`.
   - Consumer kiểm tra `OrgFacade.isModuleActive(tenantId, code)` trước khi xử lý; tắt thì đánh dấu `skipped`.
   - Frontend dùng `<ModuleGate>` hoặc `useModuleEnabled()`.

5. **Phân quyền động & PIN (BR-09, BR-13, BR-61)**
   - Cấm `if (user.role === '...')`. Kiểm tra qua `@CheckAbility('<permission_code>')` và `AbilityService` (nằm ở M00).
   - Vượt ngưỡng `conditions` → `DomainError('PIN_OVERRIDE_REQUIRED')`; frontend tự bật `PinDialog`.
   - PIN băm argon2id; sai 5 lần khoá 15 phút.

6. **Tiền (BR-10, BR-11)**
   - DB: `bigint` đồng. TypeScript: `number` nguyên, chuyển từ Prisma qua `toVnd()`. Tỷ lệ: số nguyên basis points. Cấm float cho tiền và tỷ lệ.
   - Tổng đơn chỉ tính bằng `calcOrderTotals()`; nhân/chia tỷ lệ chỉ qua `mulDivRound()` trong `packages/shared/money`.

7. **Sổ cái bất biến (BR-14, BR-23, BR-33, BR-37)**
   - Cấm `DELETE` và cấm `UPDATE` cột tiền/số lượng trên: `orders` (khi `paid`), `order_items` của đơn `paid`, `payments`, `refunds`, `tips`, `prepaid_card_ledger`, `customer_package_usages`, `cash_transactions`, `commissions`, `stock_movements`, `invoices`.
   - Sửa sai = `INSERT` dòng đối ứng.
   - Ghi sổ có số dư (thẻ, gói) phải khoá dòng chủ bằng `SELECT ... FOR UPDATE` trước khi kiểm tra số dư.

8. **Hoa hồng (BR-30..37)**
   - Quy tắc là dữ liệu có cấu trúc (biểu mẫu); không có chuỗi công thức. Cấm `eval()`, `new Function()`, cấm tự viết bộ phân tích biểu thức.
   - Chọn quy tắc bằng `resolveCommissionRule()`, tính bằng `calcCommission()` trong `packages/shared/commission`. Không viết lại logic này ở nơi khác.
   - Mỗi dòng `commissions` lưu `rule_snapshot` đầy đủ.

9. **Bill nội bộ độc lập với HĐĐT (BR-40, BR-44)**
   - M08 gọi đồng bộ `ReceiptFacade.issueReceipt()` để lấy số bill trong transaction đóng đơn.
   - M08 và M11 không import gì từ M17. M17 nghe `ORDER_PAID`, gọi adapter, rồi `ReceiptFacade.attachEInvoiceMetadata()`.

10. **Múi giờ**
    - Cấm `new Date().setHours(...)`, cấm `DATE(created_at)` trong SQL để lọc theo ngày.
    - Lọc ngày: `getTenantDayRange(dateStr, tenant.timezone)` → `{ startUtc, endUtc }`. Hiển thị: `formatTenantDateTime()`.

11. **Idempotency**
    - Endpoint ghi tiền, buổi gói, chốt ca, HĐĐT: `@Idempotent()`; client gửi header `Idempotency-Key` (UUID).

12. **Cơ sở dữ liệu & migration**
    - Cấm `prisma db push` ở mọi môi trường. Migration tạo bằng `prisma migrate dev --create-only`, SQL tay (RLS, policy, trigger, exclusion, view, `sys.*`) nằm trong cùng file migration.
    - Mọi bảng có `tenant_id`: `ENABLE` + `FORCE ROW LEVEL SECURITY` + policy `tenant_isolation`.
    - Cấm cột `GENERATED` dùng biểu thức không immutable (ví dụ `timestamptz + interval`): dùng trigger.
    - View tạo với `WITH (security_invoker = true)`. Cấm materialized view cho dữ liệu tenant.
    - Không cấp quyền bảng platform (`tenants`, `plans`, `subscriptions`, `subscription_invoices`, `platform_admins`) cho `app_user`, `app_worker`.
    - Migration phải chạy được trên DB đã có dữ liệu (thêm cột NOT NULL thì có default hoặc backfill).

---

## 3. Cấu trúc một module backend

```text
apps/api/src/modules/<module-name>/
  <module-name>.module.ts           # chỉ export <ModuleName>Facade
  <module-name>.controller.ts       # Zod, @RequireModule, @CheckAbility, @Idempotent; gọi service
  <module-name>.service.ts          # nghiệp vụ, máy trạng thái, gọi Facade module khác
  <module-name>.facade.ts           # cổng công khai duy nhất cho module khác
  <module-name>.repository.ts       # truy vấn qua TenantPrismaService
  consumers/                        # (nếu có) xử lý outbox event, chạy trong apps/worker
  domain/                           # hàm thuần, quy tắc trạng thái, mã lỗi riêng
  __tests__/
    <module-name>.service.spec.ts          # unit test theo BR-xx
    <module-name>.api.e2e-spec.ts          # API với Postgres thật
    <module-name>.isolation.e2e-spec.ts    # cách ly spa A / spa B
```

---

## 4. Mã lỗi `DomainError`

Service ném `new DomainError(code, metadata)`; không ném `BadRequestException` với chuỗi tiếng Việt tự viết. Thông điệp hiển thị do frontend tra theo mã trong i18n.

| Mã | HTTP | Khi nào |
| --- | --- | --- |
| `TENANT_MISMATCH` | 403 | Subdomain và JWT không khớp |
| `TENANT_SUSPENDED` | 403 | Store bị khoá hoặc đang chỉ đọc (BR-63) và thao tác là ghi |
| `MODULE_DISABLED` | 403 | Module không `entitled` hoặc chưa `enabled` (BR-08) |
| `PERMISSION_DENIED` | 403 | Không có `permission_code` |
| `PIN_OVERRIDE_REQUIRED` | 403 | Vượt ngưỡng `conditions` (BR-09, BR-13) |
| `PIN_LOCKED` | 423 | PIN bị khoá tạm (BR-61) |
| `BOOKING_SLOT_TAKEN` | 409 | Trùng KTV/giường, bắt từ lỗi `23P01` (BR-01) |
| `BED_UNDER_MAINTENANCE` | 409 | Giường đang bảo trì (BR-52) |
| `INVALID_STATUS_TRANSITION` | 422 | Chuyển trạng thái lịch sai chiều (BR-03) |
| `CASH_SESSION_REQUIRED` | 422 | Chưa mở ca (BR-15) |
| `ORDER_PAYMENT_MISMATCH` | 422 | Tổng phương thức khác tổng đơn (BR-12) |
| `ORDER_IMMUTABLE` | 422 | Sửa/xoá đơn đã thanh toán (BR-14) |
| `PACKAGE_EXPIRED_OR_EMPTY` | 422 | Gói hết hạn hoặc hết buổi (BR-22) |
| `PREPAID_INSUFFICIENT_BALANCE` | 422 | Thẻ trả trước không đủ (BR-23) |
| `COMMISSION_RULE_INVALID` | 422 | Quy tắc hoa hồng thiếu trường, sai tổ hợp (ví dụ `PACKAGE_SESSION_VALUE` cho phạm vi sản phẩm), tỷ lệ ngoài 0–10.000 bp |
| `IDEMPOTENCY_CONFLICT` | 409 | Cùng `Idempotency-Key` nhưng nội dung request khác |

---

## 5. Khi nào phải dừng và hỏi dnduy

- Cần thêm/sửa bảng, cột, role DB, hàm `sys.*`, hoặc thêm thư viện mới.
- Cho rằng một test hoặc một mục spec sai: báo lý do và đề xuất; **không** tự sửa test hay spec.
- Spec im lặng về một trường hợp biên ảnh hưởng tiền, quyền hoặc dữ liệu khách.
- Một yêu cầu trong prompt trái với tài liệu này hoặc master plan.

---

## 6. Tự kiểm tra trước khi báo hoàn thành

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm depcruise` đều xanh; không `any`, không `@ts-ignore`, không `console.log`.
2. Bảng mới có `tenant_id` đã có `ENABLE` + `FORCE ROW LEVEL SECURITY` + policy; script kiểm tra RLS xanh.
3. Migration chạy được trên DB có dữ liệu mẫu (`pnpm db:migrate` sau `pnpm db:seed`).
4. Mỗi BR-xx được giao có unit test, tên test chứa `[BR-xx]`.
5. Endpoint mới có test cách ly tenant (spa A thao tác ID spa B → `404`/`403`, dữ liệu spa B không đổi).
6. Thao tác có khoá dòng có test 2 request song song.
7. Màn hình: đủ 5 trạng thái, chỉ dùng `packages/ui`, đã kiểm ở 360px và 1024px.
8. Không file nào quá 300 dòng, không hàm nào quá 50 dòng.
9. Mô tả PR liệt kê: BR-xx đã xử lý, file migration (nếu có), điểm cần dnduy quyết.
