# Module M02 `org` – Spec

- **Loại:** `always_on` (lõi)
- **Người làm:** Spec: Claude; Implementation: Antigravity (theo AGENTS.md mục 1)
- **Trạng thái:** Approved by dnduy ngày 2026-10-29
- **Căn cứ:** `docs/master-plan.md` v2.0, `AGENTS.md` v2.0. Có mâu thuẫn thì sửa master plan trước, code sau.

## 1. Mục tiêu

M02 là tổ chức của một spa: chi nhánh, người dùng, vai trò và điều kiện phân quyền, bật/tắt module theo gói, và cài đặt spa — để chủ spa tự vận hành store của mình mà không cần Webgool can thiệp vào dữ liệu nghiệp vụ.

## 2. Quyền & bật/tắt

- Mã module: `always_on`. M02 không bị tắt theo BR-08; chính M02 lưu trạng thái bật/tắt của các module khác.
- Logic kiểm tra quyền nằm ở M00 (`AbilityService`/`AbilityGuard`); M02 chỉ lưu dữ liệu vai trò, quyền và `conditions`. M02 không tự viết lại logic kiểm tra quyền ở controller của mình ngoài việc gọi guard.
- Chỉ vai trò `owner` được bật/tắt module, sửa phân quyền và gói cước (gói cước về mặt `entitled` thuộc M01; ở đây `owner` chỉ sửa `enabled`).

| `permission_code` | Mô tả | Vai trò mặc định có quyền | `conditions` hỗ trợ |
| --- | --- | --- | --- |
| `org.branch.view` / `org.branch.manage` | Xem / tạo-sửa chi nhánh | Xem: mọi vai trò trong chi nhánh; Quản lý: chi nhánh hiện tại | `data_scope` |
| `org.user.view` / `org.user.manage` | Xem / tạo-sửa người dùng, gán vai trò theo chi nhánh | Xem: Chủ spa, Quản lý; Quản lý: chi nhánh hiện tại | `data_scope` |
| `org.role.view` / `org.role.manage` | Xem / tạo-sửa vai trò và `conditions` | Chỉ Chủ spa sửa; Quản lý chỉ xem | — |
| `org.module.toggle` | Bật/tắt module mở rộng | Chỉ Chủ spa | — |
| `org.settings.view` / `org.settings.manage` | Xem / sửa cài đặt spa | Xem: Chủ spa, Quản lý; Sửa: Chủ spa (Quản lý sửa một số cài đặt vận hành do chủ spa cho phép — danh sách cụ thể xem mục 6) | — |
| `org.user.invite` | Mời nhân viên qua link/Zalo | Chủ spa, Quản lý (chi nhánh hiện tại) | `data_scope` |

- 4 vai trò mẫu (seed khi M01 tạo store, qua `OrgFacade.seedDefaultBranchAndRoles`): `owner` (Chủ spa), `manager` (Quản lý), `receptionist` (Lễ tân/Thu ngân), `ktv` (KTV). Một tenant luôn có ít nhất một `owner`; không được xoá owner cuối cùng, không được hạ quyền owner cuối cùng.

## 3. Quy tắc nghiệp vụ

- **BR-08 — bật/tắt module:** module mở rộng chỉ hoạt động khi `entitled AND enabled`. `entitled` do M01 ghi khi tạo/đổi gói; `enabled` do chủ spa ghi ở M02. Tắt module chỉ ẩn giao diện và ngừng xử lý sự kiện mới; không xoá dữ liệu lịch sử. Sự kiện phát ra khi module tắt được consumer đánh dấu `skipped`, không xử lý bù khi bật lại.
  - Biên 1: `entitled=true`, `enabled=false` → API module đó `403 MODULE_DISABLED`, giao diện ẩn tính năng.
  - Biên 2: module đang bật, chủ spa tắt giữa ngày → các lịch/đơn đã tạo trước đó vẫn xem được (dữ liệu cũ không xoá); chỉ thao tác mới bị chặn.
  - Biên 3: module `package`, `commission`, `einvoice`, `inventory`, `notify`, `online_booking` là toggleable; module lõi (`core`, `platform`, `org`, `catalog`, `facility`, `customer`, `staff`, `booking`, `sales`, `cashier`, `receipt`, `report`) không có dòng `tenant_modules` để tắt.
- **BR-09 — phân quyền động và vượt ngưỡng:** mọi thao tác kiểm tra qua `permission_code` + `conditions`, không kiểm tra tên vai trò trực tiếp. Vượt ngưỡng → M00 trả `403 PIN_OVERRIDE_REQUIRED` (chi tiết PIN ở spec M00).
  - `mask_customer_phone` (boolean): lễ tân chỉ thấy SĐT che giữa (`0935***434`) khi bật; chủ spa/quản lý thấy đầy đủ; KTV không thấy SĐT khách (trừ trường hợp M05 quy định riêng cho lịch của mình — thuộc spec M05, không tự mở rộng ở đây).
  - `data_scope`: `all_branches` (chủ spa) | `current_branch` (quản lý, lễ tân) | `own_only` (KTV chỉ xem lịch/hoa hồng của mình).
  - `max_discount_percent` (số nguyên %): chủ spa 100, quản lý tối đa 50, lễ tân tối đa 10 (mặc định theo master plan §3; chủ spa chỉnh được). Vượt → PIN (BR-13, thuộc M08, M00 thi hành).
  - `max_refund_amount` (bigint VND, tùy chọn): vượt → PIN. Master plan không cho số mặc định cho giới hạn này, nên spec này không đặt số mặc định; chủ spa đặt số hoặc để trống (trống = lễ tân không được hoàn, quản lý hoàn cần PIN không giới hạn số — cần dnduy xác nhận ở mục 10).
  - Biên: một người dùng có vai trò khác nhau ở từng chi nhánh (`user_branch_roles`); quyền được tính theo chi nhánh của request hiện tại, không cộng dồn quyền của mọi chi nhánh.
- **Mời nhân viên qua link/Zalo:** chủ spa/quản lý tạo người dùng ở trạng thái chờ kích hoạt, hệ thống sinh link mời một lần (token chỉ lưu dạng băm, xem mục 4). Nhân viên mở link, đặt mật khẩu, đặt PIN riêng, kích hoạt tài khoản. Link hết hạn thì chủ spa/quản lý gửi lại link mới; link cũ vô hiệu.
  - Biên 1: link đã dùng rồi → không kích hoạt lần hai.
  - Biên 2: SĐT đã tồn tại trong cùng tenant → từ chối tạo người dùng trùng, không tạo tài khoản thứ hai.
  - Biên 3: người được mời thuộc chi nhánh A nhưng đăng nhập ở chi nhánh B → chỉ có quyền ở A, không tự có quyền ở B.
- **Đăng nhập:** nhân viên đăng nhập bằng SĐT + mật khẩu (M00 xác thực). PIN là mã riêng để duyệt vượt ngưỡng, không phải mật khẩu đăng nhập và không thay thế mật khẩu. Đổi PIN phải xác thực lại bằng mật khẩu hoặc PIN cũ (quy trình chi tiết do dnduy duyệt ở implementation; spec này chỉ chốt nguyên tắc, không tự bịa luồng khôi phục).
- **Cài đặt spa (mặc định cho Hội An, phục vụ khách du lịch):** ngôn ngữ giao diện mặc định `vi`; múi giờ mặc định `Asia/Ho_Chi_Minh`; ngôn ngữ bill mặc định song ngữ Việt–Anh (việc render bill thuộc M11, M02 chỉ lưu cài đặt). Catalog song ngữ và trang đặt lịch đa ngôn ngữ thuộc M03/M16, không thuộc M02; M02 chỉ lưu ngôn ngữ/múi giờ mặc định để các module đó dùng. Giá thuê bao không lưu ở M02 (thuộc M01, TBD).

## 4. Dữ liệu & RLS (Claude viết migration)

- Bảng sở hữu: `branches`, `tenant_modules`, `users`, `roles`, `permissions`, `role_permissions`, `user_branch_roles`, `settings`. M02 không sở hữu `staff_profiles`/`staff_levels`/`staff_skills` (M06) — hồ sơ KTV liên kết tới `users` qua `user_id`, không gộp vào M02.
- Cột chuẩn mọi bảng nghiệp vụ: `id uuid` (UUIDv7), `tenant_id uuid`, `branch_id uuid` (nếu thuộc chi nhánh), `created_at`, `updated_at`, `created_by`, `updated_by`. `settings` là key–value theo tenant, vẫn có `tenant_id`.

| Bảng | Cột chính (ngoài cột chuẩn) | Ràng buộc / chỉ mục |
| --- | --- | --- |
| `branches` | `code text`, `name text`, `address text`, `phone text`, `is_default bool` | Unique `(tenant_id, code)`; index `(tenant_id, is_default)`; một tenant chỉ có một chi nhánh mặc định |
| `tenant_modules` | `module_code text`, `entitled bool` (M01 ghi), `enabled bool` (chủ spa ghi) | Unique `(tenant_id, module_code)`; index `(tenant_id, module_code)`; chỉ chứa module toggleable |
| `users` | `phone text`, `full_name text`, `password_hash text`, `pin_hash text NULL` (argon2id, theo M00/BR-61), `pin_failed_count int`, `pin_locked_until timestamptz NULL`, `status text` (`pending`/`active`/`locked`/`disabled`), `invite_token_hash text NULL`, `invite_expires_at timestamptz NULL` | Unique `(tenant_id, phone)`; index `(tenant_id, phone)`, `(tenant_id, status)`; không lưu mật khẩu/PIN dạng rõ |
| `roles` | `code text`, `name text`, `is_system bool` (4 vai trò mẫu là system, không xoá) | Unique `(tenant_id, code)`; index `(tenant_id, code)` |
| `permissions` | `code text`, `module_code text`, `description text` | Unique `code` (mã quyền dùng chung mọi tenant, nhưng gán theo tenant qua `role_permissions`); index `(module_code)` |
| `role_permissions` | `role_id uuid`, `permission_id uuid`, `conditions jsonb` | Unique `(role_id, permission_id)`; index `(tenant_id, role_id)` — `tenant_id` có trên bảng này để RLS và tra cứu bắt đầu bằng `tenant_id` |
| `user_branch_roles` | `user_id uuid`, `branch_id uuid`, `role_id uuid` | Unique `(tenant_id, user_id, branch_id, role_id)`; index `(tenant_id, user_id)`, `(tenant_id, branch_id)` |
| `settings` | `key text`, `value jsonb` | Unique `(tenant_id, key)`; index `(tenant_id, key)` |

- Các key `settings` trong draft này (không tự thêm key ngoài danh sách nếu chưa có quyết định): `spa.language` (mặc định `vi`), `spa.timezone` (mặc định `Asia/Ho_Chi_Minh`), `spa.bill_language` (mặc định `vi-en`), `spa.bill_logo_url`, `spa.bill_address`, `spa.tax_id`, `spa.vietqr_account`, `spa.google_maps_review_url`. Các key khác phải được thêm vào spec này trước khi code.
- DDL mẫu (áp dụng cho mọi bảng có `tenant_id` của M02):
  ```sql
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
  ```
- Sổ cái bất biến: M02 không sở hữu bảng sổ cái tài chính. `role_permissions` và `tenant_modules` thay đổi phải ghi `audit_logs` qua M00 (đổi quyền, đổi module là thao tác nhạy cảm), nhưng bản thân các bảng này vẫn sửa được (không phải sổ cái bất biến theo luật 7).
- Dữ liệu nhạy cảm: SĐT, mật khẩu băm, PIN băm, token mời băm — không trả về client, không ghi log. Khi `mask_customer_phone` bật, việc che SĐT khách thuộc M05 khi trả dữ liệu khách; M02 chỉ lưu điều kiện, không tự che ở đây.

## 5. Giao tiếp liên module

- **Facade M02 cung cấp:**
  - `OrgFacade.seedDefaultBranchAndRoles(tenantId)` — tạo chi nhánh mặc định + 4 vai trò mẫu + quyền mặc định; chỉ M01 gọi trong transaction tạo store.
  - `OrgFacade.isModuleActive(tenantId, moduleCode)` — trả `entitled AND enabled` (module lõi trả `true`); M00 `ModuleGuard` và các consumer gọi hàm này trước khi xử lý.
  - `OrgFacade.getUserRolesInBranch(tenantId, userId, branchId)` — trả danh sách vai trò + `conditions` gộp cho chi nhánh đó; M00 `AbilityService` dùng qua interface.
  - `OrgFacade.getTenantSettings(tenantId)` — trả map `settings` cho module khác (ngôn ngữ, múi giờ, thông tin bill).
  - `OrgFacade.createInvite(tenantId, branchId, roleId, phone)` — tạo user `pending` + token mời băm; trả link mời (token dạng rõ chỉ trả một lần lúc tạo, không lưu lại).
- **Facade M02 được gọi:** `CoreFacade` (audit, TenantPrismaService, PIN — PIN xác thực thuộc M00, M02 không tự kiểm tra PIN); không gọi Facade nghiệp vụ khác trong M02.
- **Việc đồng bộ trong transaction:** tạo/sửa vai trò + `role_permissions` là một transaction (kèm audit); bật/tắt module là một transaction (kèm audit); tạo user + gán vai trò theo chi nhánh là một transaction; đổi cài đặt spa là một transaction.
- **Sự kiện phát ra:** M02 không phát sự kiện nghiệp vụ vào `outbox_events` trong bản draft này. Thay đổi module/quyền không cần consumer bất đồng bộ; các request sau đó tự đọc trạng thái mới qua `isModuleActive`/quyền.
- **Sự kiện lắng nghe:** M02 không lắng nghe sự kiện nghiệp vụ. Thay đổi gói ở M01 (đổi `entitled`) được M02 đọc trực tiếp từ `tenant_modules` khi kiểm tra, không qua event.

## 6. REST API (`/api/v1/...`)

| Method & path | Quyền | `@RequireModule` | Idempotent | Request (Zod) | Response | Lỗi có thể trả |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/v1/branches` / `POST /api/v1/branches` | `org.branch.view` / `org.branch.manage` | không | POST: có | `{ code, name, address, phone }` | `BranchDto` / danh sách | `403 PERMISSION_DENIED`, `409` (code trùng) |
| `GET /api/v1/users` / `POST /api/v1/users` | `org.user.view` / `org.user.manage` | không | POST: có | `{ phone, fullName, branchId, roleId }` | `UserDto` (không trả hash/token) | `403 PERMISSION_DENIED`, `409` (SĐT trùng) |
| `POST /api/v1/users/:id/invite` | `org.user.invite` | không | có | `{ channel: 'link' \| 'zalo' }` | `{ inviteExpiresAt }` (không trả lại token sau lần tạo đầu) | `403 PERMISSION_DENIED` |
| `POST /api/v1/invites/accept` | công khai bằng token mời | không | không | `{ token, password, pin }` | `{ userId }` | `401` (token sai/hết hạn/đã dùng) |
| `GET /api/v1/roles` / `POST /api/v1/roles` | `org.role.view` / `org.role.manage` | không | POST: có | `{ code, name, permissions: [{ permissionCode, conditions }] }` | `RoleDto` | `403 PERMISSION_DENIED` |
| `PATCH /api/v1/roles/:id/permissions` | `org.role.manage` | không | có | `{ permissions: [{ permissionCode, conditions }] }` | `RoleDto` | `403 PERMISSION_DENIED` (chỉ owner) |
| `GET /api/v1/tenant-modules` / `PATCH /api/v1/tenant-modules/:code` | xem: mọi vai trò có quyền; sửa: `org.module.toggle` | không | PATCH: có | `{ enabled: boolean }` | `TenantModuleDto` | `403 MODULE_DISABLED` không áp dụng ở đây; `403 PERMISSION_DENIED` nếu không phải owner; `422` nếu module là lõi |
| `GET /api/v1/settings` / `PATCH /api/v1/settings` | `org.settings.view` / `org.settings.manage` | không | PATCH: có | `{ settings: { key: value } }` (chỉ key trong danh sách mục 4) | `SettingsDto` | `403 PERMISSION_DENIED`, `422` (key ngoài danh sách) |

## 7. Màn hình (`apps/web`)

- Thiết bị ưu tiên: laptop chủ spa/quản lý cho màn hình vai trò và cài đặt; tablet quầy cho xem nhanh danh sách nhân viên.
- Luồng chính ≤ 3 chạm: mở Nhân viên → bấm Thêm/Mời → nhập SĐT + chọn chi nhánh/vai trò → gửi link (3 chạm sau khi mở màn hình).
- 5 trạng thái (cho màn hình chi nhánh, nhân viên, vai trò, module, cài đặt):
  1. Đang tải: skeleton khớp bảng/form.
  2. Trống: "Chưa có nhân viên nào — mời nhân viên đầu tiên." / "Chưa có chi nhánh phụ — chi nhánh mặc định đang hoạt động."
  3. Có dữ liệu: bảng có tên, SĐT (che hay đủ theo `mask_customer_phone` và quyền — ở màn hình nhân viên, SĐT nhân viên không che theo cùng quy tắc SĐT khách; quy tắc che SĐT nhân viên nếu có phải được dnduy chốt, xem mục 10), chi nhánh, vai trò.
  4. Lỗi: SĐT trùng, code chi nhánh trùng, module lõi không tắt được — phải nói rõ nguyên nhân và cách sửa, có nút Thử lại.
  5. Không có quyền / module tắt: nhân viên không phải owner mở màn hình vai trò → giải thích "chỉ chủ spa sửa được vai trò"; module đang tắt không hiện trong danh sách bật/tắt của module lõi.

## 8. Tiêu chí nghiệm thu (Given / When / Then)

- **[BR-08] Bật/tắt module**
  - Given: gói cho phép `commission` (`entitled=true`), chủ spa chưa bật (`enabled=false`).
  - When: KTV gọi API hoa hồng.
  - Then: `403 MODULE_DISABLED`; khi chủ spa bật `enabled=true`, API đó mới chạy (không cần tạo lại dữ liệu).
- **[BR-08] Tắt không xoá dữ liệu**
  - Given: module `package` đã có gói khách và lịch sử trừ buổi.
  - When: chủ spa tắt `package`.
  - Then: dữ liệu gói cũ vẫn còn trong DB và xem được ở báo cáo lịch sử (theo quyền); chỉ thao tác gói mới bị chặn.
- **[BR-09] Che SĐT theo conditions**
  - Given: lễ tân có `mask_customer_phone=true` (điều kiện này do M02 lưu, M05 thi hành khi trả dữ liệu khách).
  - When: lễ tân xem hồ sơ khách.
  - Then: SĐT hiển thị dạng che giữa; chủ spa xem cùng hồ sơ thì thấy đầy đủ.
- **[BR-09] Vai trò khác nhau theo chi nhánh**
  - Given: một người là quản lý ở chi nhánh A, lễ tân ở chi nhánh B.
  - When: người đó gọi API quản lý ở chi nhánh B.
  - Then: `403 PERMISSION_DENIED`; ở chi nhánh A thì được phép.
- **[BR-09] Không xoá owner cuối cùng**
  - Given: tenant chỉ còn một owner.
  - When: owner đó tự hạ quyền hoặc bị xoá.
  - Then: từ chối, tenant vẫn còn ít nhất một owner.
- **[INVITE] Link mời dùng một lần và hết hạn**
  - Given: link mời đã được dùng để kích hoạt.
  - When: mở lại link đó.
  - Then: `401`, không tạo thêm tài khoản, không đổi mật khẩu/PIN hiện tại.
- **[ISOLATION] Cách ly tenant**
  - Given: chi nhánh, người dùng, vai trò thuộc spa A.
  - When: người dùng spa B gọi mọi endpoint đọc/sửa/xoá của M02 với ID đó.
  - Then: `404` hoặc `403`; dữ liệu spa A không đổi.
- **[MODULE] Module lõi không tắt được**
  - Given: chủ spa gửi `enabled=false` cho `booking` (lõi).
  - When: gọi `PATCH /api/v1/tenant-modules/booking`.
  - Then: `422`, trạng thái module lõi không đổi.

## 9. Ngoài phạm vi

- Không làm: hồ sơ KTV, cấp bậc, kỹ năng, ca, chấm công (M06); hồ sơ khách và ghi chú sức khoẻ (M05); dịch vụ và mẫu ngành chi tiết (M03); phòng/giường (M04); booking, POS, gói, hoa hồng, báo cáo, kho, ZNS, đặt lịch online, HĐĐT (M07–M17); giá thuê bao (M01, TBD); marketplace; công thức hoa hồng AST; đặt cọc/no-show reminder (không thuộc M02, và không đưa vào MVP khi chưa có quyết định).

## 10. Câu hỏi còn mở

- [ ] `max_refund_amount` mặc định cho quản lý là bao nhiêu, hay để trống và luôn cần PIN (master plan không cho số)?
- [ ] Thời hạn link mời là bao lâu (draft trong spec này chưa chốt số ngày cụ thể — cần dnduy chốt trước khi code, không tự ghi số vào code)?
- [ ] SĐT nhân viên trên màn hình nội bộ có che như SĐT khách không, hay chỉ che SĐT khách?
- [ ] Quản lý được sửa những cài đặt vận hành nào, hay mọi cài đặt đều chỉ owner sửa?
- [ ] Quy trình khôi phục khi nhân viên quên mật khẩu và quên PIN cùng lúc (chưa có trong master plan v2.0)?
- [ ] Có cho phép một SĐT dùng ở nhiều tenant khác nhau không (mỗi tenant một tài khoản riêng, hay một tài khoản dùng chung nhiều store)?

## 11. Quyết định đã chốt ngày 2026-10-29 (Approved, bổ sung — không xóa mục 10)

- Link mời nhân viên hết hạn sau 72 giờ, dùng một lần, token chỉ lưu dạng băm.
- Manager `max_refund_amount` mặc định để trống = mọi hoàn tiền đều cần PIN, không có ngưỡng miễn PIN.
- Hash: cả mật khẩu và PIN đều argon2id; PIN scrypt cũ ở GĐ0 phải reset, cấm chuyển đổi hash.
- Khôi phục: nhân viên quên mật khẩu/PIN thì chủ spa hoặc manager reset; chủ spa quên thì platform admin reset thủ công (MVP, chưa có OTP tự phục hồi).
- SĐT nhân viên trên màn hình nội bộ: chưa chốt che hay không (mục 10 vẫn mở); M02 mặc định trả đầy đủ cho owner/manager trong nội bộ, không áp quy tắc che SĐT khách.
- Một SĐT dùng ở nhiều tenant: mỗi tenant một tài khoản riêng (unique theo tenant_id + phone), không dùng chung tài khoản xuyên tenant.
