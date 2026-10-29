# Mẫu đặc tả module (`spec.md`) & bộ prompt điều phối AI

Phiên bản: 2.0 · khớp với master plan 2.0 và AGENTS.md 2.0.

- **Phần A:** khung để tạo `docs/specs/<module>/spec.md` cho từng module M00–M17.
- **Phần B:** prompt mẫu để dnduy giao việc cho Claude, Antigravity, Muse theo vòng 6 bước. Mỗi lần giao **một bước**, không gộp cả module.

Thay `<...>` bằng giá trị thật trước khi dùng.

---

## PHẦN A: Khung `docs/specs/<module>/spec.md`

````markdown
# Module Mxx `<module_code>` – Spec

- **Loại:** `always_on` (lõi) | `toggleable` (bật/tắt theo BR-08)
- **Người làm:** Claude | Antigravity (theo AGENTS.md mục 1)
- **Trạng thái:** Draft | Approved by dnduy (ngày)

## 1. Mục tiêu
1–2 câu: module chịu trách nhiệm gì, giá trị gì cho spa.

## 2. Quyền & bật/tắt
- Mã module: `<module_code>` hoặc `always_on`.
- Quyền:

| `permission_code` | Mô tả | Vai trò mặc định có quyền | `conditions` hỗ trợ |
| --- | --- | --- | --- |
| `<module>.view` | Xem | Chủ spa, Quản lý, Lễ tân | `data_scope` |
| `<module>.create` | Tạo | ... | — |
| `<module>.override` | Duyệt vượt ngưỡng | Chủ spa, Quản lý | `max_...` |

## 3. Quy tắc nghiệp vụ
Liệt kê từng BR-xx module chịu trách nhiệm, kèm các trường hợp biên cụ thể (số liệu ví dụ, kết quả mong đợi).
- **BR-xx:** ...
  - Biên 1: ...

## 4. Dữ liệu & RLS (Claude viết migration)
- Bảng sở hữu: `<table_1>`, `<table_2>`
- DDL dự kiến (cột, kiểu, NOT NULL, default, khoá ngoại, unique, chỉ mục bắt đầu bằng `tenant_id`):
  ```sql
  -- CREATE TABLE ...
  -- ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;
  -- CREATE POLICY tenant_isolation ...
  ```
- Bảng nào là sổ cái bất biến (AGENTS.md luật 7)?
- Có dữ liệu nhạy cảm không (SĐT, ghi chú sức khoẻ)? Ai được xem, có ghi `audit_logs` không?

## 5. Giao tiếp liên module
- **Facade module này cung cấp:**
  - `methodName(input: InputDto): Promise<OutputDto>` – ai gọi, có chạy trong transaction của bên gọi không
- **Facade module này được gọi:** `OtherFacade.method(...)`
- **Việc đồng bộ trong transaction:** liệt kê (AGENTS.md luật 3)
- **Sự kiện phát ra:** `EVENT_NAME` – payload `{ <khoá> }` – thời điểm phát
- **Sự kiện lắng nghe:** `EVENT_NAME` – xử lý gì – khoá chống trùng `(event_id, '<consumer>')` – hành vi khi module tắt

## 6. REST API (`/api/v1/...`)

| Method & path | Quyền | `@RequireModule` | Idempotent | Request (Zod) | Response | Lỗi có thể trả |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/v1/...` | `<module>.create` | có/không | có/không | `CreateXSchema` | `XDto` | `...` |

## 7. Màn hình (`apps/web`)
- Thiết bị ưu tiên: tablet lễ tân (≥ 768px) / điện thoại KTV (360px) / laptop chủ spa.
- Luồng chính ≤ 3 chạm: Chạm 1 → Chạm 2 → Chạm 3.
- 5 trạng thái:
  1. Đang tải: ...
  2. Trống: ...
  3. Có dữ liệu: ...
  4. Lỗi: ...
  5. Không có quyền / module tắt: ...

## 8. Tiêu chí nghiệm thu (Given / When / Then)
- **[BR-xx] <tên kịch bản>**
  - Given: ...
  - When: ...
  - Then: ...
- **[ISOLATION] Cách ly tenant**
  - Given: bản ghi thuộc spa A.
  - When: người dùng spa B gọi mọi endpoint đọc/sửa/xoá với ID đó.
  - Then: `404` hoặc `403`; dữ liệu spa A không đổi.
- **[CONCURRENCY] (nếu có khoá dòng)**
  - Given: ...
  - When: 2 request song song ...
  - Then: chỉ 1 thành công, 1 nhận lỗi `...`.
- **[MODULE] (nếu toggleable)** module tắt → API `403 MODULE_DISABLED`, consumer đánh dấu `skipped`.

## 9. Ngoài phạm vi
Những gì module này KHÔNG làm, để AI không viết thừa.

## 10. Câu hỏi còn mở
Những điểm spec chưa quyết; dnduy trả lời trước khi chuyển Approved.
````

---

## PHẦN B: Prompt theo vòng 6 bước

Câu mở đầu chung cho mọi prompt (dán ở đầu):

```text
Đọc AGENTS.md, docs/master-plan.md trước. Không sửa file ngoài phạm vi được giao trong prompt này.
Nếu thấy yêu cầu mâu thuẫn với AGENTS.md hoặc master plan, hoặc thấy test/spec sai: DỪNG và báo lại kèm lý do, không tự sửa.
```

### Bước 1 – Claude viết spec

```text
Nhiệm vụ: viết docs/specs/<module>/spec.md cho module Mxx (<module_code>) theo đúng khung ở docs/specs/_template/spec-and-prompts.md, Phần A.

Yêu cầu:
1. Bao phủ các BR: <liệt kê BR-xx>. Mỗi BR có ít nhất 2 trường hợp biên với số liệu cụ thể.
2. Mục 4: DDL đầy đủ, chỉ mục bắt đầu bằng tenant_id, RLS, ràng buộc DB; đánh dấu bảng sổ cái bất biến và dữ liệu nhạy cảm.
3. Mục 5: chữ ký Facade, việc đồng bộ trong transaction, sự kiện phát/nghe, hành vi khi module tắt (BR-08).
4. Mục 8: kịch bản Given/When/Then cho từng BR + ISOLATION + CONCURRENCY (nếu có khoá dòng) + MODULE (nếu toggleable).
5. Mục 10: liệt kê mọi điểm em phải tự giả định.
Chỉ tạo/sửa file docs/specs/<module>/spec.md. Không viết code.
```

### Bước 2 – Claude viết migration, RLS, Zod

```text
Spec đã duyệt: docs/specs/<module>/spec.md.

Nhiệm vụ:
1. Cập nhật packages/db/prisma/schema.prisma cho các bảng của Mxx; tạo migration bằng `prisma migrate dev --create-only --name <module>_<mô_tả>`, rồi thêm SQL tay vào cùng file: ENABLE + FORCE RLS, policy tenant_isolation, trigger, exclusion constraint, grant cho app_user/app_worker (nếu cần).
2. Tuân thủ AGENTS.md luật 12: không cột GENERATED không immutable, view có security_invoker, không grant bảng platform.
3. Thêm Zod schema, DTO type và mã DomainError của module vào packages/shared.
4. Chạy: pnpm db:migrate (trên DB có seed), pnpm db:check-rls, pnpm typecheck. Dán kết quả vào báo cáo.
Chỉ sửa packages/db và packages/shared.
```

### Bước 3 – Claude viết test trước (đỏ)

```text
Spec: docs/specs/<module>/spec.md (mục 8).

Nhiệm vụ: viết test cho Mxx trong apps/api/src/modules/<module>/__tests__/:
- <module>.service.spec.ts: unit test, mỗi it(...) có tiền tố [BR-xx].
- <module>.api.e2e-spec.ts: API với Postgres thật (Testcontainers), dùng role app_user.
- <module>.isolation.e2e-spec.ts: spa A / spa B cho mọi endpoint.
Bắt buộc có thêm (nếu áp dụng): test 2 request song song cho thao tác có khoá dòng; test module tắt → 403 MODULE_DISABLED; test vượt ngưỡng → 403 PIN_OVERRIDE_REQUIRED.
Tạo stub rỗng cho controller/service/facade/repository để biên dịch được. Chạy pnpm test: test mới phải ĐỎ vì chưa có logic, không đỏ vì lỗi biên dịch.
```

### Bước 4A – Code backend (Claude cho module lõi/tài chính, Antigravity cho module CRUD)

```text
Spec: docs/specs/<module>/spec.md. Test đã có ở __tests__/.

Nhiệm vụ: cài đặt repository, service, facade, controller, consumers (nếu có) của Mxx để mọi test chuyển XANH.
Ràng buộc:
1. Không sửa, không xoá, không skip test. Nếu tin rằng test sai: dừng và báo lý do.
2. Truy vấn chỉ qua TenantPrismaService; gọi module khác chỉ qua Facade.
3. Tiền qua calcOrderTotals/mulDivRound; hoa hồng qua resolveCommissionRule/calcCommission; ngày qua getTenantDayRange.
4. Không sửa packages/db (Antigravity: không sửa cả các hàm cấm ở AGENTS.md mục 1).
5. Chạy pnpm test, typecheck, lint, depcruise; dán kết quả.
```

### Bước 4B – Giao diện (Muse thiết kế/khung component, Antigravity ghép API)

```text
Đọc mục 8 master plan và mục 7 của docs/specs/<module>/spec.md.

Nhiệm vụ: xây màn hình <tên màn hình> của Mxx trong apps/web.
1. Chỉ dùng component từ packages/ui và design tokens; tiền qua formatVnd(), ngày qua formatTenantDateTime(); % nhập bằng PercentInput (lưu basis points).
2. Luồng chính ≤ 3 chạm; vùng chạm ≥ 44×44px; kiểm ở 360px và 1024px.
3. Đủ 5 trạng thái; module tắt/không quyền dùng ModuleGate, useModuleEnabled, useAbility.
4. Lỗi PIN_OVERRIDE_REQUIRED tự bật PinDialog rồi gửi lại request với cùng Idempotency-Key.
5. Gọi API qua client sinh từ OpenAPI, không tự viết fetch.
Muse: chỉ sửa packages/ui và file giao diện; không sửa logic gọi API.
```

### Bước 5 – Phiên Claude mới review chéo

```text
Em là người review độc lập, chưa tham gia viết code này. Đọc AGENTS.md, docs/master-plan.md, docs/specs/<module>/spec.md, rồi review `git diff main...HEAD`:

1. RLS & vai trò DB: có truy vấn nào lách TenantPrismaService, bảng mới thiếu FORCE RLS/policy, grant sai, view thiếu security_invoker?
2. Ranh giới module: có import Repository/Service của module khác?
3. Đồng bộ/bất đồng bộ: có ghi tiền/sổ cái/buổi gói qua outbox thay vì trong transaction? Consumer có ghi processed_events?
4. Tiền & hoa hồng: có tính tiền ngoài calcOrderTotals/mulDivRound, tính hoa hồng ngoài calcCommission, dùng float?
5. Sổ cái: có UPDATE/DELETE trên bảng bất biến? Có khoá FOR UPDATE trước khi kiểm số dư?
6. Múi giờ: có cắt ngày bằng giờ server?
7. Test: có kiểm thật nhánh nghiệp vụ, cách ly tenant, song song; hay chỉ mock cho qua? Có test bị skip/sửa?
8. Giao diện: đủ 5 trạng thái, BR-08/BR-09 trên UI?

Xuất bảng: Đạt/Vi phạm | File:dòng | Mô tả | Cách sửa đề xuất. Cuối báo cáo: kết luận "Có thể merge" hoặc "Chưa thể merge".
```

### Bước 6 – Merge & demo staging (dnduy)

Checklist trước khi merge:

- [ ] Báo cáo review bước 5 không còn mục "Vi phạm"
- [ ] CI xanh (test, typecheck, lint, depcruise, check-rls, migrate diff)
- [ ] Migration đã duyệt riêng (nếu có)
- [ ] Đã thử trên tablet và điện thoại thật ở staging
