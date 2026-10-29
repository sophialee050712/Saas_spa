# Phương án chốt — SaaS quản lý Spa (chốt ngày 29/10/2026)

Tài liệu này ghi lại các quyết định đã chốt từ Master Plan v2.0 và các chỉ đạo sau đó.
Nếu có mâu thuẫn, `docs/master-plan.md` (v2.0) là Single Source of Truth; sửa tài liệu trước, code sau.

## 1. Sản phẩm

- SaaS bán theo thuê bao cho các spa ở Việt Nam, trọng tâm là spa ở Hội An chuyên phục vụ khách du lịch.
- Mỗi spa mua một store riêng, dữ liệu cách ly tuyệt đối (Postgres + FORCE RLS).
- Vòng nghiệp vụ lõi: đặt lịch → check-in → phục vụ → đóng đơn/POS → bill K80 → hoa hồng → chốt ca → báo cáo.
- Không làm marketplace thu phí khách mới trong MVP. Không làm app native, kế toán tổng hợp, bảng lương đầy đủ trong MVP.

## 2. Stack và kiến trúc (theo Master Plan v2.0)

- Next.js 15 (PWA) + NestJS (modular monolith), TypeScript strict, monorepo pnpm + Turborepo.
- PostgreSQL 16 + Prisma; RLS là lớp chặn cuối cùng; tenant lấy từ subdomain khớp JWT, không bao giờ nhận `tenant_id` từ body/query.
- Ghi tiền, sổ cái, số buổi gói, số bill, trạng thái lịch: đồng bộ trong transaction đóng đơn.
- Việc được phép chậm (hoa hồng, HĐĐT, ZNS, kho, hạng khách): qua `outbox_events` + BullMQ + sweeper.
- Bill nội bộ (M11) tách khỏi HĐĐT (M17, bật/tắt). Tắt M17 thì vẫn thu tiền và in bill bình thường (BR-44).
- Hoa hồng: quy tắc khai báo qua biểu mẫu, không có ô nhập công thức tự do trong MVP, không dùng `eval()`.

## 3. Điều chỉnh cho spa Hội An phục vụ khách du lịch

- Catalog và bill song ngữ Việt–Anh; trang đặt lịch công khai Việt/Anh/Hàn (M16).
- Lịch nhóm/cặp đôi (BR-07) là luồng chính, không phải trường hợp biên.
- Ghi chú khách sạn/địa chỉ đón trong lịch hẹn; xác nhận lịch kèm địa chỉ đầy đủ + link Google Maps + hướng dẫn tiếng Anh (địa chỉ hẻm phố cổ dễ lạc).
- Nhắc lịch: ZNS cho khách Việt, email/WhatsApp cho khách du lịch (M15, cân nhắc ưu tiên sau khảo sát GĐ0).
- Tìm khách: tên + email + khách sạn, bên cạnh 4 số cuối SĐT; lưu số quốc tế đầy đủ.
- Thanh toán: VND trong sổ sách (`bigint`), tiền mặt + thẻ quốc tế + VietQR, chia bill, tip tách riêng (BR-12, BR-16).
- Mẫu gói mặc định cho spa Hội An: dịch vụ lẻ, combo cặp đôi/ngày, gói ngắn 2–3 buổi, voucher — không mặc định gói dài hạn.
- Không thu hộ chiếu/CMND khi đặt lịch. Ghi chú sức khỏe chỉ hiện cho người có quyền (BR-60).
- QR đánh giá Google Maps trên bill là kênh giữ khách chính cho nhóm khách này.

## 4. Những gì đã loại bỏ / không dùng

- Các bản Master Plan cũ có động cơ công thức hoa hồng AST, `tenants.db_url`, cột `occupied_until` dạng generated, và lộ trình không có GĐ0 khảo sát — không dùng làm căn cứ code. Bản v2.0 thay thế bằng: hoa hồng biểu mẫu, `db_secret_ref`, trigger cho `occupied_until`, GĐ0 khảo sát tuần 1–2, M17 chỉ ở mức sandbox trong GĐ4.
- File AGENTS cũ (10 luật, AST) không dùng. Bản dùng là `AGENTS.md` v2.0 ở gốc repo.

## 5. Lộ trình (16 tuần, cổng chặn quyết định sang giai đoạn sau)

- GĐ0 (tuần 1–2): khảo sát 3–5 spa + nền móng (monorepo, Docker, CI, vai trò DB, `sys.*`, khung RLS, TenantPrismaService, auth).
- GĐ1 (tuần 3–4): platform, tổ chức, bật/tắt module, phân quyền động, PIN, design system, luồng mở store dưới 15 phút.
- GĐ2 (tuần 5–7): danh mục, cơ sở, khách, nhân sự + chia tua, đặt lịch, Timeline lễ tân, lịch KTV.
- GĐ3 (tuần 8–10): bán hàng, gói, ca, bill, POS, VietQR, thẻ trả trước, tip, đơn 0đ trừ gói, in K80.
- GĐ4 (tuần 11–13): hoa hồng, báo cáo, HĐĐT sandbox.
- GĐ5 (tuần 14–16): pilot 2–3 spa, nhập Excel, backup/khôi phục, mở bán.

## 6. Chưa chốt — tính sau, không tự quyết

- Giá thuê bao SaaS (giá cho thuê): tính sau, theo chỉ đạo ngày 29/10/2026.
- Nhà cung cấp HĐĐT cho MVP, tên sản phẩm/tên miền/màu thương hiệu, danh sách spa khảo sát và pilot, mốc 30/90 ngày ở BR-63 — trả lời trong GĐ0.
- Có đưa nhắc lịch tối thiểu vào MVP hay giữ M15 sau MVP: quyết sau khảo sát tỉ lệ no-show và kênh liên lạc thực tế của spa Hội An.

## 7. Phân vai theo AGENTS.md v2.0

- Chủ dự án (dnduy): duyệt spec, migration/RLS, ADR, review PR, nghiệm thu với spa pilot.
- Claude: kiến trúc và lõi (packages/db, packages/shared, packages/einvoice; M00, M01, M07, M08, M09, M10, M11, M12, M17).
- Antigravity: module CRUD và màn hình (M02, M03, M04, M05, M06, M13; M14–M16 sau MVP).
- Muse: packages/ui và bố cục lễ tân, POS, KTV, quy tắc hoa hồng; kiểm đủ 5 trạng thái màn hình.
