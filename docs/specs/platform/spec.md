# Module M01 `platform` – Spec

- **Loại:** `always_on` (lõi)
- **Người làm:** Claude (theo AGENTS.md mục 1)
- **Trạng thái:** Approved by dnduy ngày 2026-10-29
- **Căn cứ:** `docs/master-plan.md` v2.0, `AGENTS.md` v2.0. Có mâu thuẫn thì sửa master plan trước, code sau.

## 1. Mục tiêu

M01 là phía Webgool vận hành nền tảng: tạo store tự phục vụ cho spa mới trong dưới 15 phút, quản lý gói cước và thuê bao, khoá/mở store, và tách DB cho khách VIP — mà không bao giờ để API nghiệp vụ chạm vào dữ liệu platform.

## 2. Quyền & bật/tắt

- Mã module: `always_on` đối với phía platform. M01 không bị tắt theo BR-08.
- Người dùng platform (Webgool) tách khỏi người dùng spa (M02). Đăng nhập platform bắt buộc 2FA. Không dùng tài khoản spa để gọi Platform API và ngược lại.

| `permission_code` | Mô tả | Vai trò mặc định có quyền | `conditions` hỗ trợ |
| --- | --- | --- | --- |
| `platform.store.create` | Tạo store mới | Quản trị Webgool | — |
| `platform.store.view` | Xem danh sách và chi tiết store | Quản trị Webgool | — |
| `platform.store.suspend` | Khoá/mở store, chuyển trạng thái thuê bao | Quản trị Webgool | — |
| `platform.plan.manage` | Tạo/sửa gói cước và `allowed_modules` | Quản trị Webgool | — |
| `platform.subscription.view` | Xem thuê bao và hoá đơn thuê bao của store | Quản trị Webgool | — |

## 3. Quy tắc nghiệp vụ

- **Mở store tự phục vụ < 15 phút (master plan §3):** spa nhập tên spa, SĐT, chọn subdomain → hệ thống tạo tenant, chi nhánh mặc định, 4 vai trò mẫu, bật các module của gói dùng thử 14 ngày, tạo tài khoản chủ spa. Sau đó spa chọn mẫu ngành, nhập phòng/giường/nhân viên (hoặc Excel), cấu hình mẫu in K80, mời nhân viên — các bước sau thuộc M02/M03/M04/M06, M01 chỉ tạo khung store và ghi nhận mã mẫu ngành đã chọn.
  - Biên 1: subdomain đã tồn tại hoặc không hợp lệ (chữ thường, chữ số, dấu gạch ngang, không bắt đầu/kết thúc bằng gạch ngang) → từ chối trước khi tạo bất kỳ bản ghi nào, không tạo tenant mồ côi.
  - Biên 2: tạo store thất bại ở bước giữa (ví dụ tạo vai trò mẫu lỗi) → toàn bộ transaction platform rollback, không để lại tenant nửa vời.
  - Biên 3: spa đăng ký 2 lần với cùng SĐT/subdomain trong lúc request đầu chưa xong → request thứ hai nhận kết quả của lần đầu hoặc lỗi trùng, không tạo 2 store (dùng `Idempotency-Key` + unique subdomain).
- **Gói cước và `tenant_modules.entitled`:** `plans.allowed_modules` là danh sách module gói đó được phép dùng. Khi store tạo mới hoặc đổi gói, M01 là bên duy nhất được ghi `tenant_modules.entitled`. Chủ spa không tự sửa `entitled`.
  - Biên: gói không cho phép `commission` nhưng chủ spa bật `commission` ở M02 → M02 chỉ ghi `enabled`, ModuleGuard vẫn chặn vì `entitled=false`.
- **Trial 14 ngày:** store mới bắt đầu ở trạng thái `trial`, hết 14 ngày mà chưa chuyển sang gói trả phí thì chuyển theo BR-63 (xem dưới). Trial dùng cùng cơ chế `entitled` như gói trả phí, không có đường tắt riêng.
- **BR-63 — hết hạn thuê bao (mốc DRAFT, chưa chốt):** master plan v2.0 ghi mốc mặc định: chỉ đọc 30 ngày (cho xuất dữ liệu khách hàng, dịch vụ, đơn, hoa hồng ra file), sau đó khoá hẳn, xoá vĩnh viễn sau 90 ngày kể từ hết hạn. **Các mốc 30/90 ngày này chưa được dnduy chốt ở GĐ0** (xem mục 10); spec này giữ nguyên mốc của master plan làm draft, không tự chốt số khác. Chủ spa yêu cầu xoá sớm thì làm theo quy trình có xác nhận riêng (chi tiết quy trình thuộc M01 implementation, phải được dnduy duyệt cùng spec này).
  - Biên 1: tenant đang `read_only` → M00 chặn mọi ghi nghiệp vụ bằng `403 TENANT_SUSPENDED`, nhưng xuất dữ liệu vẫn cho phép theo quyền chủ spa.
  - Biên 2: tenant đã `suspended` → cả đọc nghiệp vụ và ghi đều bị chặn qua API nghiệp vụ; phía platform vẫn xem được metadata để xử lý khôi phục/xoá.
  - Biên 3: tenant thanh toán và khôi phục trong thời gian chỉ đọc → quay lại `active`, dữ liệu không mất; sau khi đã xoá vĩnh viễn thì không khôi phục.
- **Tách DB VIP qua `db_secret_ref` (không phải `db_url`):** `tenants.db_secret_ref` chỉ lưu tên khoá trong kho bí mật hoặc tên biến môi trường, không bao giờ lưu chuỗi kết nối. `ConnectionResolver` đọc secret, mở pool riêng cho DB đó. DB riêng có cùng schema và cùng RLS. Nếu `db_secret_ref` rỗng thì dùng DB chung.
  - Biên 1: secret không tồn tại hoặc sai → store đó lỗi kết nối, không fallback lặng lẽ sang DB chung (tránh đọc nhầm dữ liệu tenant khác).
  - Biên 2: migrate và sweeper phải chạy trên DB chung và mọi DB VIP đã đăng ký (`pnpm db:migrate:all`); bỏ sót một DB VIP là lỗi triển khai, phải báo.
- **Platform API tách riêng:** chỉ `PlatformPrismaService` (role `app_platform`, `BYPASSRLS`) được chạm vào 5 bảng platform. API nghiệp vụ (`app_user`/`app_worker`) không có quyền gì trên các bảng này; test vai trò DB phải chứng minh điều đó (xem mục 8).

## 4. Dữ liệu & RLS (Claude viết migration)

- Bảng sở hữu: `tenants`, `plans`, `subscriptions`, `subscription_invoices`, `platform_admins`. **Không RLS** trên các bảng này theo thiết kế master plan §5 — vì chúng là dữ liệu platform, không phải dữ liệu tenant nghiệp vụ. Bù lại, chỉ `app_platform` được quyền, và Platform API tách triển khai/xác thực.
- Không cấp quyền bảng platform cho `app_user`, `app_worker` (AGENTS.md luật 12). Không dùng `PlatformPrismaService` ngoài M01.

| Bảng | Cột chính | Ràng buộc / chỉ mục |
| --- | --- | --- |
| `tenants` | `id uuid`, `slug text`, `name text`, `phone text`, `timezone text` (mặc định `Asia/Ho_Chi_Minh`), `status text`, `db_secret_ref text NULL`, `industry_template_code text NULL`, `created_at`, `updated_at` | Unique `slug`; index `(status, created_at)`; `status` ∈ `trial`, `active`, `read_only`, `suspended` (xem BR-63, mục 10) |
| `plans` | `id uuid`, `code text`, `name text`, `allowed_modules jsonb`, `trial_days int` (mặc định 14 cho gói trial), `is_active bool` | Unique `code`; **không ghi số tiền trong spec này** (giá tính sau, xem mục 9/10) |
| `subscriptions` | `id uuid`, `tenant_id uuid` (tham chiếu `tenants`, không phải cột tenant RLS), `plan_id uuid`, `status text`, `trial_ends_at timestamptz`, `current_period_ends_at timestamptz`, `created_at`, `updated_at` | Index `(tenant_id, created_at)`; một tenant chỉ có một subscription đang hoạt động tại một thời điểm |
| `subscription_invoices` | `id uuid`, `tenant_id uuid`, `subscription_id uuid`, `period_start timestamptz`, `period_end timestamptz`, `status text`, `created_at` | Index `(tenant_id, created_at)`; đây là hoá đơn thuê bao của platform, khác bill khách hàng của spa (M11) |
| `platform_admins` | `id uuid`, `email text`, `password_hash text`, `two_factor_secret_encrypted text`, `is_active bool`, `created_at`, `updated_at` | Unique `email`; secret 2FA lưu mã hoá, không lưu dạng rõ |

- Cột chuẩn: bảng platform không dùng cột chuẩn `tenant_id`/`branch_id` của bảng nghiệp vụ, vì chính chúng định nghĩa tenant. Mỗi bảng vẫn có `id uuid` (UUIDv7) và `created_at`/`updated_at`.
- Sổ cái bất biến: không áp dụng như bảng nghiệp vụ; `subscription_invoices` sau khi phát hành không sửa số tiền bằng `UPDATE` trực tiếp — sai sót xử lý bằng hoá đơn điều chỉnh mới (quy trình do dnduy duyệt ở bước implementation, không tự bịa trong draft này).
- Dữ liệu nhạy cảm: `db_secret_ref` không phải secret; chuỗi kết nối thật nằm trong kho bí mật/biến môi trường, không nằm trong DB, log hay response API. `two_factor_secret_encrypted` không bao giờ trả về client.

## 5. Giao tiếp liên module

- **Facade M01 cung cấp:**
  - `PlatformFacade.createStore(input)` — chạy trong transaction platform: tạo `tenants`, `subscriptions` (trial), gọi `OrgFacade.seedDefaultBranchAndRoles(tenantId)` để tạo chi nhánh mặc định + 4 vai trò mẫu, ghi `tenant_modules.entitled` theo gói trial. Trả `{ tenantId, slug, trialEndsAt }`. Thất bại ở bước nào cũng rollback toàn bộ.
  - `PlatformFacade.setEntitledModules(tenantId, moduleCodes)` — chỉ M01 gọi khi tạo/đổi gói; M02 không được gọi hàm này.
  - `PlatformFacade.changeTenantStatus(tenantId, status, reason)` — chuyển `trial`/`active`/`read_only`/`suspended`, ghi audit platform; M00 thi hành chặn ghi khi đọc/khoá.
  - `PlatformFacade.resolveVipConnection(tenantId)` — đọc `db_secret_ref`, trả pool/connection cho DB VIP (hoặc DB chung khi rỗng); không trả chuỗi kết nối ra ngoài lớp resolver.
  - `PlatformFacade.getTenantForAdmin(tenantId)` — đọc metadata tenant cho trang quản trị Webgool.
- **Facade M01 được gọi:** `OrgFacade.seedDefaultBranchAndRoles(...)` (M02, đồng bộ trong transaction tạo store); `CoreFacade` chỉ để ghi audit platform và dùng `TenantPrismaService` cho các thao tác cần tenant context (không dùng cho bảng platform).
- **Việc đồng bộ trong transaction:** tạo tenant + subscription + chi nhánh mặc định + vai trò mẫu + `entitled` là một transaction platform; đổi gói + cập nhật `entitled` là một transaction; chuyển trạng thái thuê bao là một transaction.
- **Sự kiện phát ra:** M01 không phát sự kiện nghiệp vụ vào `outbox_events` trong bản draft này. Hết hạn thuê bao, nhắc gia hạn, khôi phục/xoá được xử lý bằng job định kỳ của platform (lịch job do dnduy duyệt ở implementation), không tự thêm event type mới vào ma trận outbox của master plan.
- **Sự kiện lắng nghe:** M01 không lắng nghe sự kiện nghiệp vụ. Thay đổi từ phía spa (ví dụ chủ spa bật/tắt module ở M02) không tự đổi `entitled` ở M01.

## 6. REST API

- Platform API dùng tiền tố riêng `/platform/v1`, tách khỏi `/api/v1` nghiệp vụ. Mọi endpoint quản trị platform yêu cầu đăng nhập Webgool + 2FA. Đăng ký store tự phục vụ là endpoint công khai nhưng bị rate-limit (mức rate-limit cụ thể cần dnduy chốt, xem mục 10).

| Method & path | Quyền | `@RequireModule` | Idempotent | Request (Zod) | Response | Lỗi có thể trả |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /platform/v1/stores` | công khai (rate-limit) | không | có (`Idempotency-Key`) | `{ spaName, phone, slug, industryTemplateCode }` | `{ tenantId, slug, trialEndsAt }` | `409` (slug trùng), `422` (slug không hợp lệ) |
| `POST /platform/v1/admin/login` | công khai (2FA bước 2) | không | không | `{ email, password, totpCode }` | `{ accessToken }` (platform) | `401` |
| `GET /platform/v1/admin/stores?cursor=&limit=` | `platform.store.view` | không | không | query cursor, limit ≤ 100 | `{ items, nextCursor }` | `403 PERMISSION_DENIED` |
| `PATCH /platform/v1/admin/stores/:id/status` | `platform.store.suspend` | không | không | `{ status, reason }` | `{ tenantId, status }` | `403 PERMISSION_DENIED`, `422` (chuyển trạng thái không hợp lệ) |
| `PATCH /platform/v1/admin/stores/:id/plan` | `platform.plan.manage` | không | không | `{ planCode }` | `{ tenantId, planCode, entitledModules }` | `403 PERMISSION_DENIED`, `404` (plan không tồn tại) |
| `GET /platform/v1/admin/stores/:id/subscription` | `platform.subscription.view` | không | không | — | `{ subscription, invoices }` | `403 PERMISSION_DENIED` |

- Không định nghĩa cổng thu tiền thuê bao (payment gateway cho subscription) trong bản draft này — cách Webgool thu tiền spa chưa có trong master plan v2.0, xem mục 10. Không trả chuỗi kết nối, secret 2FA hay `db_secret_ref` dạng secret qua bất kỳ response nào.

## 7. Màn hình (`apps/web`)

- Thiết bị ưu tiên: laptop cho trang quản trị Webgool; form đăng ký store dùng được trên điện thoại và máy tính của chủ spa.
- Luồng chính ≤ 3 chạm (đăng ký): nhập tên spa + SĐT → chọn subdomain → bấm Tạo store (sau đó đi tiếp các bước mẫu ngành, cơ sở, in thử ở M02/M03 — không gộp vào một màn hình khổng lồ).
- 5 trạng thái (cho cả form đăng ký và trang quản trị store):
  1. Đang tải: skeleton của form/bảng store.
  2. Trống: chưa có store nào → "Chưa có store nào — tạo store đầu tiên."
  3. Có dữ liệu: bảng store có slug, trạng thái, gói, ngày hết trial.
  4. Lỗi: slug trùng/không hợp lệ phải nói rõ lý do và gợi ý slug khác; lỗi hệ thống có nút Thử lại.
  5. Không có quyền: tài khoản spa truy cập trang platform → trang từ chối, không lộ danh sách store của spa khác; tài khoản platform không có quyền vẫn thấy lý do và liên hệ quản trị.

## 8. Tiêu chí nghiệm thu (Given / When / Then)

- **[STORE] Tạo store dưới 15 phút**
  - Given: spa mới chưa có tài khoản.
  - When: gửi đăng ký hợp lệ.
  - Then: tenant, chi nhánh mặc định, 4 vai trò mẫu và `entitled` của gói trial được tạo trong một lần đăng ký; chủ spa đăng nhập được ngay bằng SĐT + mật khẩu.
- **[STORE] Slug trùng**
  - Given: slug `hoian-spa` đã tồn tại.
  - When: đăng ký slug đó lần nữa.
  - Then: `409`, không tạo thêm tenant, không tạo chi nhánh/vai trò mồ côi.
- **[ENTITLED] Gói không cho phép nhưng chủ spa bật**
  - Given: gói của spa không có `commission` trong `allowed_modules`.
  - When: chủ spa bật `commission` ở M02.
  - Then: `enabled=true` được lưu ở M02 nhưng ModuleGuard vẫn chặn vì `entitled=false` (`403 MODULE_DISABLED`).
- **[TRIAL] Hết trial chuyển chỉ đọc (mốc draft)**
  - Given: tenant hết trial 14 ngày, chưa gia hạn, mốc BR-63 đang ở trạng thái draft 30 ngày chỉ đọc.
  - When: tenant gọi API ghi nghiệp vụ.
  - Then: `403 TENANT_SUSPENDED`, nhưng chủ spa vẫn xuất được dữ liệu theo quyền.
- **[VIP] Secret sai không fallback lặng lẽ**
  - Given: tenant VIP có `db_secret_ref` trỏ tới secret không tồn tại.
  - When: API nghiệp vụ của tenant đó gọi DB.
  - Then: lỗi kết nối rõ ràng, không tự chuyển sang DB chung.
- **[ISOLATION] API nghiệp vụ không đọc được bảng platform**
  - Given: token của spa A (role `app_user`).
  - When: truy vấn trực tiếp `tenants`, `plans`, `subscriptions`, `subscription_invoices`, `platform_admins`.
  - Then: bị từ chối quyền ở cấp DB; dữ liệu platform không lộ.
- **[ISOLATION] Trang platform không lộ store khác**
  - Given: tài khoản spa A (không phải quản trị Webgool).
  - When: gọi `/platform/v1/admin/stores`.
  - Then: `403 PERMISSION_DENIED`, không trả danh sách store nào.
- **[CONCURRENCY] Hai đăng ký cùng slug song song**
  - Given: hai request đăng ký cùng slug cùng lúc.
  - When: cả hai chạy song song.
  - Then: chỉ một tạo được store, request còn lại nhận `409` hoặc kết quả trùng lặp an toàn, không tạo 2 tenant.

## 9. Ngoài phạm vi

- Không làm: giá thuê bao và cách thu tiền thuê bao (giá tính sau theo chỉ đạo — trong spec này mọi số tiền thuê bao đều là TBD, không ghi số nào); marketplace; công thức hoa hồng AST; đặt cọc/no-show reminder (không thuộc M01, và không đưa vào MVP khi chưa có quyết định — xem mục 10 của spec M07/M15 khi viết); logic booking/POS/gói/hoa hồng/báo cáo; mẫu dịch vụ chi tiết (M03); hồ sơ nhân viên và kỹ năng (M06); HĐĐT (M17) — M01 chỉ ghi nhận trạng thái, không phát hành hoá đơn.

## 10. Câu hỏi còn mở

- [ ] Giá các gói và có phí khởi tạo không — **TBD, tính sau theo chỉ đạo ngày 29/10/2026; không chốt số trong spec này.**
- [ ] Mốc BR-63 (chỉ đọc 30 ngày, khoá hẳn, xoá sau 90 ngày) có giữ nguyên không, hay đổi mốc khác? Cần dnduy chốt ở GĐ0.
- [ ] Cách Webgool thu tiền thuê bao (chuyển khoản thủ công, cổng thanh toán, hay hoá đơn thuê bao chỉ để đối soát)?
- [ ] Nhà cung cấp HĐĐT cho MVP (MISA/Viettel/VNPT/EasyInvoice) — thuộc M17, nhưng ảnh hưởng tới trường `einvoice` trong hồ sơ store nếu có.
- [ ] Tên sản phẩm, tên miền (subdomain gốc cho `*.tên-miền`), màu thương hiệu.
- [ ] Kho bí mật dùng cho `db_secret_ref` là biến môi trường, kho bí mật của VPS, hay dịch vụ vault riêng?
- [ ] Rate-limit và chống spam cho endpoint đăng ký store công khai (có cần CAPTCHA không)?
- [ ] Danh sách slug cấm (từ dự trữ như `admin`, `api`, `www`) do ai chốt?

## 11. Quyết định đã chốt ngày 2026-10-29 (Approved, bổ sung — không xóa mục 10)

- BR-63 giữ nguyên: 30 ngày chỉ đọc + xuất dữ liệu, sau đó khóa, xóa sau 90 ngày.
- JWT platform/admin tuân cùng chính sách M00: access 8 giờ, refresh 7 ngày quay vòng (admin vẫn bắt buộc 2FA khi đăng nhập).
- NestJS gắn ở M01, ESLint đầy đủ (typescript-eslint) cài ở M01.
- Tên sản phẩm, domain/subdomain gốc, giá thuê bao và cách thu tiền thuê bao: vẫn TBD; code không hard-code giá, không hard-code tên thương hiệu cuối.
