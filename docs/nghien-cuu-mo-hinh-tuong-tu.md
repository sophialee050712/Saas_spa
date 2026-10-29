# Nghiên cứu mô hình SaaS spa tương tự — học hỏi quy trình và ứng dụng

Ngày nghiên cứu: 29/10/2026 (web search, giá và tính năng có thể thay đổi — kiểm tra lại trước khi báo giá hay chốt tính năng).
Mục đích: đối chiếu với Master Plan v2.0 của dự án SaaS spa (Next.js 15 PWA + NestJS, Postgres 16 + RLS, M00–M17), xem nên học gì, nên tránh gì.
Lưu ý: đây là nghiên cứu đối thủ, không sao chép giao diện, nội dung hay dữ liệu của họ.

## 1. Bức tranh chung: mọi app đều xoay quanh một vòng duy nhất

Đặt lịch → nhắc lịch → check-in → phục vụ → POS/thanh toán → gói/thẻ → hoa hồng → chốt ca → báo cáo → giữ khách quay lại.
Khác nhau chủ yếu ở: ai trả tiền cho discovery (marketplace), tính phí theo người hay theo cửa hàng, và mức độ phức tạp khi setup.

- Fresha: booking + marketplace + POS + kho + marketing. Gói Individual $19.95/tháng, Team $14.95/tháng cho mỗi thành viên có thể đặt lịch, phí marketplace 20% cho khách mới (tối thiểu $6).
- Booksy: booking mobile-first + portfolio + POS + marketing. $29.99/tháng cho người đầu tiên + $20/tháng cho mỗi nhân viên thêm; Boost tính 30% cho lần đầu của khách mới (tối thiểu $10, tối đa $100).
- Vagaro: $23.99–$30/tháng cho lịch đầu tiên, +$10 cho mỗi lịch thêm; marketplace, POS, kho, marketing SMS là add-on.
- GlossGenius: $24/tháng khi trả năm ($28 trả tháng) cho gói Standard; POS, booking không cần khách đăng nhập, marketing kèm theo.
- Mangomint: $120/tháng cho mỗi địa điểm + $10/tháng cho mỗi người dùng; định vị UX cao cấp, được đánh giá cao về trải nghiệm.
- Mindbody: Starter từ $99/tháng cho mỗi địa điểm, các gói cao hơn báo giá riêng; mạnh về lớp học, membership, billing định kỳ, marketplace (phí khách mới 20%, tối đa $30).
- Zenoti: báo giá theo địa điểm, các nguồn thứ cấp ước tính khoảng $235–$500/tháng cho mỗi địa điểm; mạnh nhất về chuỗi lớn, membership, POS di động, AI receptionist, báo cáo đa địa điểm.
- Square Appointments: có gói miễn phí, Plus $49/tháng, Premium $149/tháng cho mỗi địa điểm; phù hợp solo và rất nhỏ.
- Myspa (Việt Nam): tự nhận là phần mềm quản lý/CSKH cho spa, salon, clinic, TMV, hơn 5.000 đơn vị; có Zalo Mini App thương hiệu, app đặt lịch, quản lý lịch, khách, nhân viên, tài chính, kho, đa chi nhánh.
- KiotViet (Việt Nam): phần mềm bán hàng tổng quát, mạnh về báo cáo, kho, đa chi nhánh — không phải phần mềm chuyên spa (không có tua KTV, giường, liệu trình theo nghĩa spa).

Nguồn đối chiếu: các trang so sánh Fresha/Booksy, Zenoti, Vagaro/Mangomint/GlossGenius, Mindbody và Myspa (xem mục 5).

## 2. Quy trình học được, đối chiếu với Master Plan v2.0

### 2.1 Đặt lịch và chống trống giờ
- Tất cả đều có: lịch theo nhân viên, dịch vụ kèm thời lượng, thời gian đệm/dọn, ngăn trùng lịch, đặt online 24/7, đặt từ Google/Facebook/Instagram.
- Booksy có thêm: dịch vụ song song (parallel clients), combo, waitlist tự động, dịch vụ di động.
- Zenoti/Mindbody có: đặt theo phòng + nhân viên cùng lúc, lịch nhóm/cặp đôi, lớp học có sức chứa và waitlist.
- Đối chiếu v2.0: BR-01 (chống trùng KTV/giường, cộng cleanup 10 phút, exclusion constraint), BR-02 (thời lượng = tổng dịch vụ), BR-07 (lịch nhóm, assignment_type auto/requested) đã bao phủ phần lõi. Waitlist tự động là khoảng trống có thể đưa vào backlog sau MVP, không nên nhét vào GĐ2.

### 2.2 Nhắc lịch và chống no-show — khoảng trống lớn nhất của v2.0 hiện tại
- Vấn đề thật: no-show ở salon/spa không có hệ thống phòng ngừa được báo cáo 15–30%; quên là nguyên nhân lớn nhất.
- Combo hiệu quả nhất trong các nguồn: nhắc tự động (48 giờ + sáng hôm đặt lịch + 2 giờ trước), tin nhắn có nút xác nhận / đổi lịch 1 chạm, và đặt cọc cho dịch vụ giá trị cao hoặc khách lần đầu. Có nguồn báo nhắc SMS giảm no-show khoảng 38%, đặt cọc giảm tới 65–69%.
- Đối chiếu v2.0: BR-04 mới chỉ gợi ý đánh dấu no_show sau 30 phút, chưa có nhắc lịch hay đặt cọc trong MVP. M15 (notify: Zalo ZNS/SMS) đang xếp sau MVP. Đề xuất cho GĐ0 khảo sát: hỏi spa về tỉ lệ no-show thực tế, họ có muốn ZNS nhắc lịch + đặt cọc VietQR không, rồi mới quyết định có đưa nhắc lịch tối thiểu vào MVP hay giữ M15 sau MVP. Không tự thêm đặt cọc vào MVP khi chưa có quyết định của dnduy.

### 2.3 POS, thanh toán, tip, chốt ca
- Chuẩn chung: POS tích hợp booking, thanh toán nhiều phương thức, chia bill, tip tách riêng, in bill, bán lẻ kèm dịch vụ, kho gắn với bán hàng.
- Zenoti nhấn mạnh: POS di động để KTV chốt tiền ngay tại ghế, không chờ quầy; tip và hoa hồng tính tự động lúc checkout rồi đưa vào payroll.
- Đối chiếu v2.0: BR-11 (calcOrderTotals duy nhất), BR-12 (nhiều phương thức, tổng phải khớp), BR-15 (phải có ca mở), BR-16 (tip tách khỏi doanh thu và HĐĐT), BR-40 (số bill liên tục), BR-43 (chốt ca đối chiếu tiền mặt, lệch phải ghi lý do) đã đúng hướng và chặt hơn nhiều app chỉ làm POS đơn giản. Điểm khác biệt ở Việt Nam là tiền mặt vẫn chủ đạo + VietQR động, nên chốt ca tiền mặt phải là luồng bắt buộc, không phải tính năng phụ.

### 2.4 Gói liệu trình, thẻ trả trước, membership
- Zenoti/Mindbody/Booker: gói và membership là động cơ giữ khách — mua gói, trừ buổi khi dùng, hết hạn/đóng băng/bỏ qua kỳ thanh toán, dùng chéo chi nhánh, theo dõi tỉ lệ dùng gói và doanh thu thực hiện.
- Đối chiếu v2.0: BR-20–BR-25 đã có bán gói, trừ buổi lúc đóng đơn (đồng bộ, khóa FOR UPDATE), thẻ trả trước dạng sổ cái, session_value, đơn 0đ cho buổi gói, hoàn đơn trả lại buổi. Khoảng trống cần hỏi ở GĐ0: có cần đóng băng/gia hạn linh hoạt kiểu membership không, hay chỉ gia hạn theo BR-22 là đủ cho spa nhỏ.

### 2.5 Hoa hồng và chia tua
- Zenoti: hoa hồng theo cấp nhân viên, theo loại bán (dịch vụ vs membership), theo khoảng doanh thu.
- Mangomint/Vagaro/GlossGenius: hoa hồng theo dịch vụ/nhân viên, payroll là add-on trả thêm.
- Đối chiếu v2.0: hoa hồng dạng biểu mẫu (phạm vi × cấp KTV, cơ sở LINE_NET/LINE_GROSS/PACKAGE_SESSION_VALUE, % hoặc cố định, phụ cấp chỉ định, split_bp, snapshot BR-31, dòng âm khi hoàn BR-33) là lựa chọn đúng cho spa nhỏ — dễ hiểu, dễ đối chiếu tay, tránh được cái bẫy công thức tự do AST đã bị loại khỏi MVP ở v2.0. Chia tua BR-06 (gợi ý KTV rảnh, ít tua nhất, đủ kỹ năng) tương đương round-robin của các app quốc tế, nhưng cần giữ quyền lễ tân đổi tay.

### 2.6 Giữ khách và marketing
- Fresha/Booksy/Mindbody: marketplace giúp spa mới có khách, nhưng đổi lại bằng phí khách mới 20–30%.
- Các app còn lại: nhắc sinh nhật, chiến dịch SMS/email, loyalty, đánh giá Google.
- Đối chiếu v2.0: đúng khi KHÔNG đưa marketplace vào MVP. Spa nhỏ ở Việt Nam tìm khách chủ yếu qua Zalo/Facebook/Google Maps, không cần trả 20% cho một sàn lạ. M15 ZNS cảm ơn + nhắc lịch và M16 đặt lịch công khai (Việt/Anh/Hàn) là hướng giữ khách rẻ hơn và đúng địa phương hơn.

### 2.7 Trải nghiệm theo vai trò và thiết bị
- Điểm chung được khen: lễ tân mở ra là lịch hôm nay, KTV mở ra là lịch của mình, thao tác ít chạm, chạy tốt trên tablet và điện thoại, không cần phần cứng đắt tiền.
- Mangomint được đánh giá UX rất cao; Zenoti bị chê setup phức tạp, onboarding kéo dài hàng tuần — đó chính là rủi ro mà v2.0 đã chặn bằng mục tiêu onboarding dưới 15 phút, mẫu ngành sẵn, nhập Excel.
- Đối chiếu v2.0: §8 (tối đa 3 chạm, vùng chạm 44px, 5 trạng thái màn hình, tablet ≥768px, điện thoại KTV 360px, PWA cache lịch hôm nay khi mất mạng) là đúng và nên giữ làm tiêu chí nghiệm thu, không hy sinh cho thêm tính năng.

## 3. Bài học áp dụng trực tiếp cho dự án (ưu tiên cao → thấp)

1. Giữ onboarding dưới 15 phút bằng mọi giá. Đây là lợi thế cạnh tranh lớn nhất trước Zenoti/Mindbody. Mẫu ngành (massage, nail–mi, da), giá mẫu, quy tắc hoa hồng mẫu, nhập Excel phải chạy được ngay ở GĐ1, trước khi thêm tính năng khó.
2. Không làm marketplace thu phí khách mới trong MVP. Học Fresha/Booksy/Mindbody ở mặt trái: phí 20–30% khiến spa đang lớn dần sẽ bỏ sàn. Bán thuê bao minh bạch, không thu phí trên từng booking.
3. Giá phải minh bạch và không phạt khi spa thêm KTV. Tránh mô hình $20/người/tháng kiểu Booksy và báo giá mập mờ kiểu Zenoti/Mindbody. Với spa nhỏ Việt Nam, giá theo store/chi nhánh + gói module (đúng M01) dễ bán hơn giá theo đầu người.
4. Đưa nhắc lịch Zalo ZNS vào danh sách cân nhắc sớm, dù M15 đang ở sau MVP. Đây là tính năng có ROI rõ nhất (giảm no-show), và ở Việt Nam Zalo là kênh đúng, không phải SMS/WhatsApp như app quốc tế.
5. Giữ tiền chặt như v2.0 đang làm: một hàm tính tiền, đơn paid không sửa, tip tách riêng, chốt ca bắt đối chiếu. Đây là điểm mà nhiều app booking đơn giản làm lỏng, và là lý do spa tin dùng hệ thống lâu dài.
6. Hoa hồng biểu mẫu, có xem trước ví dụ bằng số thật, có snapshot. Đừng quay lại AST tự do trong MVP chỉ vì spa lớn yêu cầu — giải quyết bằng cấu hình, đúng nguyên tắc 5 của v2.0.
7. Học Myspa ở điểm địa phương hóa: Zalo Mini App, app thương hiệu, CSKH cho spa/salon/clinic. Nhưng không sao chép tính năng tràn lan; dự án này thắng bằng vòng quầy (booking → POS → gói → hoa hồng → chốt ca) chạy mượt trên tablet, không phải bằng số lượng module.
8. Bảo mật dữ liệu khách là lợi thế riêng: ghi chú sức khỏe chỉ hiện cho người có quyền (BR-60), PIN khóa sau 5 lần sai (BR-61), cách ly tenant bằng RLS. Các app booking phổ thông thường không có lớp này.

## 4. Câu hỏi cần trả lời ở GĐ0 (bổ sung cho danh sách câu hỏi mở của v2.0)

- Tỉ lệ no-show và khách hủy giờ chót ở 3–5 spa khảo sát là bao nhiêu? Họ có chấp nhận đặt cọc VietQR không?
- KTV được chia tua thực tế ra sao (vòng tua, chỉ định, làm nhóm)? Có trường hợp nào ngoài BR-06/BR-07 không?
- Tip trả qua chuyển khoản rồi đưa tiền mặt cho KTV có phổ biến không (đã có BR-16, cần xác nhận tần suất)?
- Máy in K80 đang dùng là mẫu nào, in qua trình duyệt có lệch khổ không?
- Spa dùng Zalo OA/ZNS chưa, hay chỉ dùng Zalo cá nhân và SMS?
- Giá thuê bao spa nhỏ Việt Nam chịu được là bao nhiêu/tháng, và họ so sánh với Myspa/KiotViet ra sao?

## 5. Áp dụng cho spa ở Việt Nam, trọng tâm Hội An, chuyên phục vụ khách du lịch

Cập nhật theo chỉ đạo ngày 29/10/2026: thị trường là spa ở Việt Nam, chủ yếu ở Hội An, chuyên phục vụ khách du lịch. Giá cho thuê (giá thuê bao SaaS) tính sau — bản cập nhật này cố tình không chốt giá thuê bao, cũng không chốt giá dịch vụ mẫu.

### 5.1 Khách du lịch khác khách địa phương ở những điểm nào

- **Ở ngắn ngày, mua 1 lần là chính:** gói 10 buổi kiểu khách địa phương ít bán được cho khách du lịch. Thứ bán được là dịch vụ lẻ, combo cặp đôi/ngày, gói ngắn 2–3 buổi trong kỳ nghỉ, voucher tặng. Module gói M09 vẫn cần, nhưng mẫu gói mặc định khi onboarding cho spa Hội An phải là combo du lịch, không phải gói dài hạn.
- **Walk-in và đặt qua kênh du lịch chiếm tỉ trọng cao:** Google Maps, Tripadvisor, khách sạn/concierge, Facebook/Instagram, website của spa — chứ không phải Zalo như khách Việt. Vì vậy M16 (trang đặt lịch công khai đa ngôn ngữ) quan trọng hơn nhiều so với spa địa phương, và cần gắn link Google Maps, không chỉ Zalo.
- **Ngôn ngữ:** nhân viên dùng giao diện tiếng Việt được, nhưng mặt khách hàng phải song ngữ. V2.0 đã có bill song ngữ Việt–Anh và đặt lịch Việt/Anh/Hàn ở M16 — với spa Hội An thì đây là yêu cầu bắt buộc, không phải tính năng sau này. Tên dịch vụ trong catalog nên có cả tên tiếng Việt và tiếng Anh ngay từ mẫu ngành.
- **Liên lạc:** khách nước ngoài thường không có Zalo, số điện thoại có mã quốc gia. Nhắc lịch chỉ bằng ZNS sẽ không tới được họ. M15 cần thêm email và WhatsApp cho khách du lịch, bên cạnh ZNS cho khách Việt. Tìm khách cũng không thể chỉ dựa vào 4 số cuối SĐT Việt Nam: cần tìm theo tên + email + tên khách sạn (tùy chọn), và lưu số quốc tế đầy đủ để `phone_last4` vẫn hoạt động.
- **Thanh toán:** tiền mặt VND, thẻ quốc tế, VietQR cho khách Việt; bill tính bằng VND (`bigint`, đúng BR-10), không quy đổi tỷ giá vào sổ sách. Tip tiền mặt rất phổ biến, chia bill cho cặp đôi/nhóm cũng phổ biến — đúng BR-12 và BR-16, cần test kỹ ở GĐ3.
- **Tìm đường ở phố cổ là vấn đề thật:** địa chỉ kiểu hẻm như 5/3 Trần Phú (ví dụ đã gặp ở Relaxanh Hội An) rất dễ lạc nếu chỉ ghi số nhà. Xác nhận đặt lịch phải kèm địa chỉ đầy đủ, link Google Maps và hướng dẫn bằng tiếng Anh, không chỉ ghi tên đường.
- **Đưa đón:** nhiều spa Hội An đưa đón miễn phí trong phố cổ. Booking nên có trường ghi chú khách sạn/địa chỉ đón và giờ đón, ở dạng ghi chú của lịch hẹn, không cần làm module riêng.
- **Nhóm và cặp đôi là luồng chính, không phải trường hợp biên:** khách đi theo cặp, gia đình, đoàn tour. BR-07 (một mã đặt lịch nhiều dòng song song, nhiều KTV/giường) phải được ưu tiên test ở GĐ2, cùng với sức chứa theo phòng/giường.
- **Đánh giá Google Maps là kênh giữ khách chính:** sau khi thanh toán, QR đánh giá trên bill (đã có trong mẫu bill K80 của v2.0) quan trọng hơn loyalty Zalo đối với khách chỉ ở vài ngày.
- **Nhân viên nói tiếng Anh là một kỹ năng xếp lịch:** nên dùng `staff_skills` để gắn kỹ năng ngôn ngữ, ưu tiên xếp KTV nói tiếng Anh cho lịch khách nước ngoài.
- **HĐĐT không phải rào cản checkout cho khách du lịch:** khách nước ngoài thường chỉ cần bill song ngữ, không cần HĐĐT Việt Nam. Giữ đúng BR-44: tắt/chưa có M17 thì vẫn thu tiền và in bill bình thường, đừng bắt luồng HĐĐT chặn POS.
- **Thu thập dữ liệu tối thiểu:** đừng thu hộ chiếu/CMND cho booking du lịch. Chỉ cần tên, liên hệ, khách sạn (tùy chọn), ghi chú sức khỏe có sự đồng ý và chỉ hiện cho người có quyền (BR-60).

### 5.2 Thứ tự ưu tiên thay đổi thế nào (không đổi phạm vi v2.0, chỉ đổi trọng tâm)

- GĐ2: đặt lịch nhóm/cặp đôi + catalog song ngữ + ghi chú khách sạn/đón + trang đặt lịch đa ngôn ngữ lên trước.
- GĐ3: POS bill song ngữ, tiền mặt + thẻ quốc tế + VietQR, chia bill — test bằng kịch bản cặp đôi và đoàn nhỏ.
- M15: ưu tiên email/WhatsApp cho khách du lịch, ZNS cho khách Việt; đừng chỉ làm ZNS rồi coi như xong nhắc lịch.
- M13: báo cáo tách theo kênh đến (Google, khách sạn/tour, walk-in, Facebook, website) và theo nhóm khách du lịch/khách địa phương ở mức tổng hợp, để spa Hội An biết tiền đến từ đâu. Không thu thập hay báo cáo theo đặc điểm nhạy cảm của khách.

### 5.3 Câu hỏi GĐ0 bổ sung, riêng cho spa Hội An phục vụ khách du lịch

- Tỉ lệ walk-in / đặt trước / qua khách sạn-tour / qua Google-Tripadvisor là bao nhiêu?
- Khách du lịch liên lạc bằng WhatsApp, email hay gì khác để nhắc lịch?
- Có đưa đón trong phố cổ không, khung giờ và phạm vi đón ra sao?
- Tỉ lệ tiền mặt / thẻ quốc tế / VietQR thực tế là bao nhiêu?
- Dịch vụ và combo nào bán chạy nhất cho khách du lịch?
- Có cần tên dịch vụ và bill song ngữ ngay từ ngày đầu không, và ngôn ngữ thứ ba ngoài tiếng Anh là gì (Hàn hay ngôn ngữ khác)?

## 6. Nguồn tham khảo (URL nguyên văn từ kết quả tìm kiếm)

- Fresha/Booksy comparison: https://climbcal.com/salon-booking-software-cost/
- Fresha review: https://schedulingkit.com/reviews/fresha-review
- Booksy alternatives (GlossGenius): https://webflow.glossgenius.com/blog/booksy-alternatives
- Fresha alternatives: https://koalendar.com/blog/fresha-alternatives-salon-software
- Fresha vs Booksy: https://pabau.com/blog/fresha-vs-booksy/
- Zenoti vs Bewtee: https://bewtee.com/blog/zenoti-vs-bewtee-which-salon-software-is-right-for-your-indian-salon-in-2026
- Zenoti POS: https://www.Zenoti.com/thecheckin/pos-system-for-salon-and-spa
- Zenoti review/pricing: https://thesalonbusiness.com/zenoti-review/
- Zenoti membership: https://www.zenoti.com/platform/membership-and-packages
- Zenoti spa software: https://www.zenoti.com/spa-management-software
- Booksy spa: https://biz.booksy.com/en-gb/who-loves-us/spas
- Booksy pricing: https://glossgenius.com/blog/booksy-price
- Spa software comparison (GlossGenius): https://glossgenius.com/blog/best-spa-software
- Vagaro vs Mangomint: https://glossgenius.com/blog/vagaro-vs-mangomint
- Massage software comparison: https://rankite.com/blog/best-massage-software
- Salon software comparison: https://rankite.com/blog/best-salon-software
- No-show playbook: https://www.phorest.com/gb/blog/salon-no-shows/
- No-show automation: https://dingg.app/blogs/can-automation-really-stop-spa-no-shows
- Mindbody worth it: https://supaday.app/blog/is-mindbody-worth-it-for-a-salon
- Mindbody alternatives: https://bookafy.com/mindbody-alternatives/
- Myspa Crunchbase: https://www.crunchbase.com/organization/myspa-vn
- Myspa Manager (Google Play): https://play.google.com/store/apps/details?id=com.myspa.merchant&referrer=utm_source%3Dapkpure.com
