# Module M00 `core` – Spec

- **Loại:** `always_on` (lõi)
- **Người làm:** Claude (theo AGENTS.md mục 1)
- **Trạng thái:** Approved by dnduy ngày 2026-10-29
- **Căn cứ:** `docs/master-plan.md` v2.0, `AGENTS.md` v2.0. Có mâu thuẫn thì sửa master plan trước, code sau.

## 1. Mục tiêu

M00 là lớp nền duy nhất mọi module nghiệp vụ phải đi qua: xác định tenant, gắn tenant vào transaction, kiểm tra quyền và module, xác thực, PIN, audit, idempotency và outbox. Không có M00 thì không có cách ly tenant đáng tin.

## 2. Quyền & bật/tắt

- Mã module: `always_on`. M00 không bị tắt theo BR-08.
- M00 không tự quyết quyền nghiệp vụ; nó chỉ thi hành `permission_code` và `conditions` do M02 lưu, qua interface do M02 cung cấp (xem mục 5). Cấm `if (user.role === '...')` trong mọi module.

| `permission_code` | Mô tả | Vai trò mặc định có quyền | `conditions` hỗ trợ |
| --- | --- | --- | --- |
| `core.audit.view` | Xem nhật ký audit của tenant mình | Chủ spa, Quản lý | `data_scope` |
| `core.pin.verify` | Xác thực PIN vượt ngưỡng cho người khác | Chủ spa, Quản lý (tại chi nhánh đó) | — |
| `core.outbox.view` | Xem trạng thái outbox của tenant mình | Chủ spa | — |
| `core.auth.login` | Đăng nhập bằng SĐT + mật khẩu | Mọi người dùng đang hoạt động | — |

## 3. Quy tắc nghiệp vụ

- **BR-08 (phần của M00):** `ModuleGuard` chặn request khi module không `entitled AND enabled`. Trả `403 MODULE_DISABLED`. Consumer kiểm tra lại trước khi xử lý; module tắt thì đánh dấu `skipped`, không xử lý bù khi bật lại.
  - Biên 1: gói cước cho phép (`entitled=true`) nhưng chủ spa tắt (`enabled=false`) → vẫn `403 MODULE_DISABLED`.
  - Biên 2: sự kiện phát ra trong lúc module tắt → consumer ghi `processed_events` với trạng thái `skipped`, không chạy lại khi bật lại.
- **BR-09:** thao tác vượt ngưỡng `conditions` → API trả `403 PIN_OVERRIDE_REQUIRED`, không thực hiện thao tác. Người có quyền cao hơn ở cùng chi nhánh nhập PIN; thành công thì lưu `approved_by_user_id` và ghi `audit_logs`, rồi thực hiện lại request gốc với cùng `Idempotency-Key`.
  - Biên 1: người duyệt PIN ở chi nhánh khác → từ chối, không tính là lần sai PIN của người duyệt.
  - Biên 2: PIN đúng nhưng người duyệt không có `permission_code` tương ứng → từ chối.
- **BR-61 — PIN (quyết định bắt buộc):** PIN lưu dạng băm **argon2id**. Đây là quyết định theo BR-61, **thay cho scrypt đang dùng ở GĐ0**. Mọi giá trị PIN tạo dưới GĐ0 (scrypt) đều vô hiệu sau khi M00 này triển khai; chủ spa/quản lý phải đặt lại PIN, không được chuyển đổi băm scrypt sang argon2id bằng cách băm lại băm cũ.
  - Biên 1: sai PIN 5 lần liên tiếp → khoá PIN 15 phút, trả `423 PIN_LOCKED`, ghi `audit_logs`, báo chủ spa (qua nhật ký và cảnh báo trên dashboard, không tạo kênh thông báo mới trong M00).
  - Biên 2: hết 15 phút khoá, bộ đếm sai liên tiếp reset về 0; lần sai tiếp theo đếm lại từ 1.
  - Biên 3: mật khẩu đăng nhập (SĐT + mật khẩu) không thuộc BR-61; spec này không đổi cách băm mật khẩu của GĐ0. Nếu dnduy muốn thống nhất argon2id cho cả mật khẩu, xem mục 10.
- **BR-62:** đăng nhập sai 10 lần trong 15 phút từ cùng tài khoản → khoá tạm tài khoản 15 phút (không phân biệt đúng/sai mật khẩu trong thời gian khoá).
  - Biên: 9 lần sai, lần thứ 10 đúng → đăng nhập thành công và reset bộ đếm; 10 lần sai → lần thứ 11 dù đúng mật khẩu vẫn bị khoá.
- **BR-63 (phần của M00):** tenant ở trạng thái chỉ đọc hoặc bị khoá thì mọi thao tác ghi nghiệp vụ trả `403 TENANT_SUSPENDED`. Đọc và xuất dữ liệu trong thời gian chỉ đọc vẫn cho phép theo quyền. Chuyển trạng thái thuộc M01; M00 chỉ thi hành.
- **RLS — 6 luật (master plan §5, ADR-001/ADR-002):** (1) API nghiệp vụ chỉ dùng `app_user`, worker chỉ dùng `app_worker`, không role nào có `BYPASSRLS`; (2) mọi bảng có `tenant_id` đều `ENABLE` + `FORCE ROW LEVEL SECURITY`; (3) policy chuẩn `tenant_isolation`; (4) mỗi request chạy trong 1 transaction, câu đầu là `set_config`; (5) thiếu `app.tenant_id` thì truy vấn lỗi, không dùng giá trị mặc định; (6) CI quét bảng thiếu RLS/policy thì báo đỏ.
- **Ghi sổ đồng bộ / việc chậm (ADR-003):** tiền, sổ cái, số buổi gói, số bill, trạng thái lịch chạy đồng bộ trong transaction đóng đơn. Chỉ hoa hồng, HĐĐT, ZNS, trừ kho, hạng khách đi qua outbox. M00 không tự quyết việc nào là đồng bộ; module nghiệp vụ khai báo, M00 chỉ cung cấp cơ chế.

## 4. Dữ liệu & RLS (Claude viết migration)

- Bảng sở hữu: `audit_logs`, `idempotency_keys`, `outbox_events`, `processed_events`. M00 không sở hữu `tenants` (M01), `users`/`roles` (M02); nó chỉ đọc chúng qua Facade/interface.
- Cột chuẩn mọi bảng nghiệp vụ: `id uuid` (UUIDv7), `tenant_id uuid`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid`, `updated_by uuid`. Riêng `audit_logs` không `UPDATE` sau khi ghi; `processed_events` là sổ chống trùng, không sửa.

| Bảng | Cột chính (ngoài cột chuẩn) | Ràng buộc / chỉ mục |
| --- | --- | --- |
| `audit_logs` | `actor_user_id`, `action text`, `entity_type text`, `entity_id uuid`, `before_data jsonb`, `after_data jsonb`, `branch_id uuid` | Index `(tenant_id, created_at)`; `(tenant_id, entity_type, entity_id)`; không `DELETE`/`UPDATE` |
| `idempotency_keys` | `key uuid`, `user_id uuid`, `endpoint text`, `request_hash text`, `response_status int`, `response_body jsonb`, `status text` (`pending`/`done`) | Unique `(tenant_id, user_id, key)`; index `(tenant_id, created_at)` |
| `outbox_events` | `event_type text`, `payload jsonb` (chỉ chứa khoá, xem mục 5), `status text` (`pending`/`dispatching`/`processed`/`skipped`/`failed`), `dispatched_at timestamptz`, `retry_count int` | Index `(tenant_id, status, created_at)`; `(tenant_id, event_type)` |
| `processed_events` | `event_id uuid`, `consumer text` | Unique `(event_id, consumer)` — đây là khoá chống xử lý trùng |

- DDL mẫu (áp dụng cho mọi bảng có `tenant_id` của M00):
  ```sql
  ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON outbox_events
    USING (tenant_id = current_setting('app.tenant_id', false)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);
  ```
- Sổ cái bất biến (AGENTS.md luật 7, áp dụng cho M00): `audit_logs`, `processed_events` — cấm `UPDATE`/`DELETE`. `idempotency_keys` không sửa `request_hash` sau khi ghi; `outbox_events` chỉ đổi `status`/`retry_count` theo vòng đời, không sửa `payload`.
- Dữ liệu nhạy cảm: M00 không lưu SĐT, mật khẩu, PIN dạng rõ, token hay secret trong log. Log JSON chỉ có `tenant_id`, `user_id`, `request_id`. Ghi chú sức khoẻ thuộc M05; M00 chỉ cung cấp cơ chế ghi audit khi M05 gọi (BR-60), không tự đọc nội dung ghi chú.
- Vai trò DB: `app_owner` (migration, sở hữu bảng, không superuser, không `BYPASSRLS`), `app_user` (API), `app_worker` (worker + sweeper), `app_platform` (chỉ M01, `BYPASSRLS`, triển khai tách riêng), `app_sys_definer` (nologin, `BYPASSRLS`, chỉ sở hữu schema `sys`). `app_user`/`app_worker` không có quyền gì trên 5 bảng platform.

## 5. Giao tiếp liên module

- **TenantContext:** `{ tenantId, branchId, userId, timezone, tenantStatus }`. Chỉ tạo từ subdomain + JWT đã xác thực (mục 6). Không bao giờ lấy `tenant_id` từ body, query hay path.
- **Facade M00 cung cấp:**
  - `TenantPrismaService.runInTenant(tenantId, fn)` — mở transaction, câu đầu `SELECT set_config('app.tenant_id', $1, true)`, rồi chạy `fn`. Mọi truy vấn nghiệp vụ phải đi qua hàm này. Cấm dùng `PrismaClient` gốc ngoài `core` và `packages/db`.
  - `CoreFacade.resolveTenantBySlug(slug)` — gọi `sys.resolve_tenant(slug)`, trả tối thiểu `{ tenantId, timezone, status, dbSecretRef }`.
  - `CoreFacade.verifyPin(approverUserId, branchId, pin)` — kiểm tra argon2id, khoá theo BR-61, ghi audit.
  - `CoreFacade.checkAbility(userId, branchId, permissionCode)` — trả quyết định cho phép/từ chối và ngưỡng `conditions` áp dụng.
  - `CoreFacade.writeOutbox(tx, eventType, payload)` — ghi `outbox_events` trong cùng transaction của bên gọi.
  - `CoreFacade.recordProcessed(tx, eventId, consumer)` — ghi `processed_events` trong cùng transaction xử lý của consumer.
- **Facade M00 được gọi (qua interface, để tránh phụ thuộc vòng):** M00 định nghĩa interface `AbilityProvider` và `ModuleActivationProvider`; M02 cài đặt chúng từ `roles`/`role_permissions`/`tenant_modules`. M00 không import Repository/Service của M02. Wiring ở tầng API (Nest module) tiêm implementation của M02 vào guard của M00.
- **Việc đồng bộ trong transaction:** ghi audit cho thao tác nhạy cảm (đổi quyền, đổi giá, đổi quy tắc hoa hồng, vượt ngưỡng PIN, khoá PIN/tài khoản); ghi `idempotency_keys`; ghi `outbox_events` (chỉ ghi, không xử lý consumer ngay trong transaction).
- **Sự kiện phát ra:** M00 không tự phát sự kiện nghiệp vụ. Nó chỉ cung cấp cơ chế ghi/đẩy cho các module khác (M07/M08 phát `APPOINTMENT_COMPLETED`, `ORDER_PAID`, `ORDER_REFUNDED` — chi tiết ở spec các module đó).
- **Sự kiện lắng nghe:** M00 không có consumer nghiệp vụ. Sweeper (thuộc worker, dùng `app_worker`) không phải consumer nghiệp vụ: nó gọi `sys.claim_pending_outbox(limit)` mỗi phút, vớt event `pending` quá 30 giây, đẩy job `{ event_id, tenant_id }` vào Redis. Event kẹt `dispatching` quá 5 phút được `sys.requeue_stuck_outbox()` trả về `pending`.
- **Hàm `sys.*` (SECURITY DEFINER, sở hữu bởi `app_sys_definer`, `search_path` cố định, thu hồi quyền `PUBLIC`, chỉ cấp `EXECUTE` cho role cần dùng, mỗi hàm một việc, trả tối thiểu cột; thêm hàm mới phải có ADR):**
  - `sys.resolve_tenant(p_slug)` → `{ tenant_id, timezone, status, db_secret_ref }`; cấp cho `app_user`, `app_worker`.
  - `sys.claim_pending_outbox(p_limit)` → `{ event_id, tenant_id }`; chỉ cấp cho `app_worker`; dùng `FOR UPDATE SKIP LOCKED`.
  - `sys.requeue_stuck_outbox()` → trả event `dispatching` quá 5 phút về `pending`; chỉ cấp cho `app_worker`.

## 6. REST API

- Tiền tố nghiệp vụ: `/api/v1`. Platform API riêng: `/platform/v1` (M01). Auth dưới đây thuộc M00 nhưng chạy trên subdomain của tenant.
- AuthGuard đầy đủ (khắc phục khoảng trống GĐ0 — GĐ0 mới decode JWT, chưa xác thực chữ ký): mọi request nghiệp vụ phải qua AuthGuard trước TenantMatchGuard. AuthGuard xác thực chữ ký JWT bằng `JWT_SECRET` (secret cấp platform, do M01 quản lý vòng đời và luân chuyển, không lưu theo tenant, không trả về client), kiểm tra hết hạn, kiểm tra claim `tenant_id` và `user_id` có mặt, từ chối token giả mạo/hết hạn/sai chữ ký bằng `401`. Sau đó TenantMatchGuard so khớp subdomain với `JWT.tenant_id`; lệch → `403 TENANT_MISMATCH`. Thứ tự: AuthGuard → TenantMatchGuard → ModuleGuard → AbilityGuard → controller (Zod → service).

| Method & path | Quyền | `@RequireModule` | Idempotent | Request (Zod) | Response | Lỗi có thể trả |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/v1/auth/login` | công khai trên subdomain (rate-limit, BR-62) | không | không | `{ phone, password }` | `{ accessToken, userId, tenantId, branchIds }` | `401`, `423` (khoá tạm), `403 TENANT_SUSPENDED` |
| `POST /api/v1/auth/pin-verify` | đã đăng nhập | không | không | `{ pin, targetAction, branchId }` | `{ approvedByUserId, approvedAt }` | `403 PIN_OVERRIDE_REQUIRED`, `423 PIN_LOCKED`, `403 PERMISSION_DENIED` |
| `GET /api/v1/audit-logs?cursor=&limit=` | `core.audit.view` | không | không | query cursor, limit ≤ 100 | `{ items, nextCursor }` | `403 PERMISSION_DENIED`, `403 TENANT_MISMATCH` |
| `GET /api/v1/outbox-events?status=` | `core.outbox.view` | không | không | query status, cursor | `{ items, nextCursor }` | `403 PERMISSION_DENIED` |

- Không định nghĩa refresh token, đổi mật khẩu, quên mật khẩu trong bản draft này (xem mục 10). Đăng xuất là client huỷ token; không có endpoint huỷ token phía server trong MVP draft.

## 7. Màn hình (`apps/web`)

- Thiết bị ưu tiên: màn hình đăng nhập dùng được trên tablet quầy và điện thoại KTV; màn hình audit dùng laptop chủ spa/quản lý.
- Luồng chính ≤ 3 chạm: nhập SĐT → nhập mật khẩu → bấm Đăng nhập (vào đúng màn hình theo vai trò). PinDialog: khi API trả `PIN_OVERRIDE_REQUIRED`, hộp thoại PIN tự bật, nhập PIN → gửi lại request gốc với cùng `Idempotency-Key`.
- 5 trạng thái:
  1. Đang tải: skeleton của form đăng nhập / bảng audit, không xoay trắng màn hình.
  2. Trống: audit chưa có dòng nào → "Chưa có hoạt động nào được ghi lại trong khoảng thời gian này."
  3. Có dữ liệu: bảng audit có actor, hành động, đối tượng, thời gian theo `tenants.timezone`.
  4. Lỗi: mã lỗi theo `DomainError` + nút Thử lại (riêng lỗi `PIN_LOCKED`/`TENANT_SUSPENDED` phải nói rõ thời gian khoá và việc cần làm, không chỉ "thử lại").
  5. Không có quyền / module tắt: M00 luôn bật nên trạng thái này ở đây là "không có quyền xem audit" với hướng dẫn liên hệ chủ spa; không hiển thị dữ liệu của tenant khác trong bất kỳ trạng thái nào.

## 8. Tiêu chí nghiệm thu (Given / When / Then)

- **[BR-09] Vượt ngưỡng cần PIN**
  - Given: lễ tân có `max_discount_percent = 10`, thao tác giảm 15%.
  - When: gọi API giảm giá.
  - Then: `403 PIN_OVERRIDE_REQUIRED`, thao tác không thực hiện, không ghi thay đổi nào.
- **[BR-09] PIN đúng cho phép thao tác**
  - Given: quản lý cùng chi nhánh có quyền duyệt, PIN chưa khoá.
  - When: nhập PIN đúng qua `pin-verify`, gửi lại request với cùng `Idempotency-Key`.
  - Then: thao tác thực hiện 1 lần, `approved_by_user_id` được lưu, có dòng `audit_logs`.
- **[BR-61] PIN argon2id và khoá**
  - Given: PIN đã đặt bằng argon2id.
  - When: nhập sai 5 lần liên tiếp.
  - Then: lần thứ 6 trả `423 PIN_LOCKED`, có `audit_logs`, bộ đếm không reset cho tới hết 15 phút.
- **[BR-61] PIN GĐ0 scrypt vô hiệu**
  - Given: một PIN cũ chỉ tồn tại dưới dạng băm scrypt từ GĐ0.
  - When: dùng PIN đó để xác thực sau khi M00 triển khai.
  - Then: xác thực thất bại; người dùng phải đặt lại PIN qua chủ spa/quản lý (không có đường chuyển đổi băm).
- **[BR-62] Khoá đăng nhập**
  - Given: tài khoản đã sai mật khẩu 10 lần trong 15 phút.
  - When: đăng nhập lần thứ 11 với mật khẩu đúng.
  - Then: vẫn bị khoá 15 phút; hết khoá mới đăng nhập được.
- **[RLS] Thiếu tenant thì truy vấn lỗi**
  - Given: một đoạn code gọi DB mà không qua `TenantPrismaService`.
  - When: chạy truy vấn vào bảng có `tenant_id`.
  - Then: `current_setting('app.tenant_id', false)` báo lỗi, truy vấn dừng, không trả dữ liệu.
- **[IDEMPOTENCY] Gửi lại cùng key, cùng nội dung**
  - Given: một request ghi tiền đã hoàn thành với `Idempotency-Key` X.
  - When: gửi lại đúng X và đúng nội dung.
  - Then: trả lại đúng response cũ, không tạo thêm giao dịch.
- **[IDEMPOTENCY] Cùng key, khác nội dung**
  - Given: như trên, nhưng nội dung khác.
  - When: gửi lại với key X.
  - Then: `409 IDEMPOTENCY_CONFLICT`, không thực hiện.
- **[OUTBOX] Consumer trùng**
  - Given: một event đã được consumer `commission` xử lý và ghi `processed_events`.
  - When: job đó được đẩy lại.
  - Then: consumer bỏ qua, không tính hoa hồng lần hai.
- **[ISOLATION] Cách ly tenant**
  - Given: bản ghi audit/outbox thuộc spa A.
  - When: người dùng spa B gọi mọi endpoint đọc của M00 với ID đó.
  - Then: `404` hoặc `403`; dữ liệu spa A không đổi.
- **[TENANT] Subdomain lệch JWT**
  - Given: JWT chứa `tenant_id` của spa A, request tới subdomain spa B.
  - When: gọi bất kỳ endpoint nghiệp vụ nào.
  - Then: `403 TENANT_MISMATCH` trước khi chạm vào dữ liệu nghiệp vụ.

## 9. Ngoài phạm vi

- Không làm: logic booking, POS, gói, hoa hồng, báo cáo, kho, ZNS, đặt lịch online, HĐĐT (thuộc M03–M17); không làm marketplace; không làm công thức hoa hồng tự do (AST) dưới bất kỳ hình thức nào; không làm đặt cọc hay nhắc no-show trong M00 (đó là quyết định phạm vi ở M07/M15, xem mục 10 của spec liên quan); không lưu secret hay chuỗi kết nối DB trong M00; không tạo thêm hàm `sys.*` ngoài 3 hàm đã liệt kê nếu chưa có ADR.

## 10. Câu hỏi còn mở

- [ ] Thời hạn JWT bao nhiêu (đề xuất draft: ngắn, dưới 1 ngày — cần dnduy chốt, không tự chốt số khác trong code)?
- [ ] Có refresh token hay bắt đăng nhập lại khi hết hạn?
- [ ] Quy trình đặt lại PIN khi chính chủ spa bị khoá PIN, và quy trình đổi/quên mật khẩu (chưa có trong master plan v2.0)?
- [ ] Có thống nhất argon2id cho cả mật khẩu đăng nhập hay giữ scrypt cho mật khẩu và chỉ argon2id cho PIN (theo BR-61)?
- [ ] NestJS gắn ngay ở GĐ0 hay giữ server thuần rồi gắn ở M01 (kế thừa từ GD0-README, cần dnduy quyết trước khi code M00)?
- [ ] ESLint đầy đủ có cài ngay hay giữ script kiểm tra `any` của GĐ0?

## 11. Quyết định đã chốt ngày 2026-10-29 (Approved, bổ sung — không xóa mục 10)

- JWT: access 8 giờ, refresh 7 ngày, refresh quay vòng (refresh cũ vô hiệu ngay khi đổi mới); access hết hạn thì dùng refresh, refresh hết hạn thì đăng nhập lại.
- Hash: cả mật khẩu và PIN đều argon2id (thống nhất; PIN theo BR-61). PIN scrypt cũ ở GĐ0 phải reset, cấm chuyển đổi hash.
- Khôi phục: nhân viên quên mật khẩu/PIN thì chủ spa hoặc manager reset; chủ spa quên thì platform admin reset thủ công (MVP, chưa có OTP tự phục hồi).
- NestJS gắn ở M01, ESLint đầy đủ (typescript-eslint) cài ở M01.
- Tên sản phẩm, domain, giá thuê bao: vẫn TBD; code không hard-code giá, không hard-code tên thương hiệu cuối.
