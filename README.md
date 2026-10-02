# MimiToys Image Studio

Ứng dụng Next.js để lấy ảnh từ URL sản phẩm công khai, chọn tối đa 10 ảnh, chỉnh bằng Gemini và tải kết quả PNG 1200 × 1200 dưới dạng ZIP.

## Chạy cục bộ

Khuyến nghị Node.js 22.12 trở lên (mức Puppeteer hỗ trợ chính thức). Shopee adapter dùng Google Chrome đã cài trên máy; crawler tổng quát dùng Chromium của Playwright.

```bash
npm install
npx playwright install chromium
```

Sao chép `.env.example` thành `.env.local`, rồi điền `GEMINI_API_KEY`. Có thể đổi `GEMINI_IMAGE_MODEL` sang một model chỉnh ảnh tương thích.

Các model Gemini tạo ảnh hiện không có hạn mức API miễn phí. API key cần thuộc một dự án đã bật gói trả phí; nếu tài khoản ở Free Tier, thao tác tạo ảnh sẽ báo lỗi hạn mức.

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cách dùng

Nếu Shopee mở được trong Chrome thường nhưng crawler báo xác minh, cài extension trong `chrome-extension` qua **chrome://extensions → Developer mode → Load unpacked**. Mở ứng dụng trong chính Chrome đó và tải lại trang; dòng **Chrome đã kết nối** xác nhận extension hoạt động. Khi phân tích link Shopee, ứng dụng ưu tiên lấy gallery từ tab Chrome, dùng phiên duyệt hiện tại. Nếu cần xác minh, thực hiện trong tab Shopee; ứng dụng chờ tối đa 2 phút. Hướng dẫn và ZIP có tại [http://localhost:3000/chrome-helper.html](http://localhost:3000/chrome-helper.html). Chạy `npm run package:chrome-helper` để cập nhật ZIP sau khi sửa extension.

Chrome Helper 1.1 đọc danh sách `images` của đúng sản phẩm từ phản hồi trang Shopee; nếu không có dữ liệu này, quét carousel thumbnail đến cuối. Không dừng ở 4 thumbnail đầu. Cache cũ được vô hiệu hóa để tránh giữ kết quả thiếu ảnh. Sau khi cập nhật file extension, tải lại extension trong **chrome://extensions** và tải lại ứng dụng. `npm run test:chrome-helper` kiểm tra gallery 9 ảnh qua 3 trang thumbnail, cùng phản hồi fetch/XHR chỉ hiển thị 4 thumbnail, bằng trang Shopee mô phỏng.

1. Dán URL sản phẩm công khai và bấm **Phân tích**.
2. Chọn 1–10 ảnh; kéo thả hoặc dùng mũi tên để đổi thứ tự.
3. Chọn một trong ba preset và thêm chỉ dẫn nếu cần.
4. Bấm **Tạo bộ ảnh**. Ảnh được xử lý lần lượt; ảnh lỗi có thể thử lại.
5. Tải từng PNG hoặc tải các ảnh thành công dưới dạng ZIP.

## Cấu trúc

- `lib/crawler`: crawler tổng quát bằng Playwright và adapter Shopee bằng Puppeteer.
- `chrome-extension`: đọc gallery từ Chrome thường; chỉ nhận yêu cầu từ ứng dụng trên localhost/127.0.0.1 cổng 3000, chỉ mở và đọc trang Shopee.
- Ảnh Shopee lấy được sẽ được lưu trong `.mimitoys/shopee-cache` trong 30 ngày để phân tích lại mà không cần truy cập trang thêm lần nữa.
- `lib/validation`: kiểm tra URL và chặn địa chỉ mạng nội bộ.
- `lib/image`: tải và chuẩn hóa ảnh với Sharp.
- `lib/gemini`: tạo prompt và gọi Gemini Image API.
- `app/api`: các API phân tích, proxy ảnh, tạo ảnh và xuất ZIP.

## Giới hạn V1

- Shopee có thể đưa phiên tự động sang trang xác minh, kể cả khi Puppeteer đã lấy được ảnh ở lần trước. Ứng dụng báo rõ trạng thái này; adapter không đảm bảo truy cập ổn định khi Shopee chặn.
- Crawler tổng quát không đảm bảo nhận diện đúng gallery của mọi website.
- Gemini có thể thay đổi chi tiết sản phẩm dù prompt yêu cầu giữ nguyên. Hãy duyệt từng ảnh trước khi dùng thương mại.
- Preset Standard chừa chỗ cho tiêu đề nhưng V1 chưa thêm chữ/logo. Việc thêm chữ tiếng Việt chính xác và logo thật thuộc bước tiếp theo.
- Kết quả được giữ trong phiên trình duyệt; làm mới trang sẽ mất ảnh đã tạo.

API chỉnh ảnh dựa trên [tài liệu Gemini Image Editing chính thức](https://ai.google.dev/gemini-api/docs/image-generation).
