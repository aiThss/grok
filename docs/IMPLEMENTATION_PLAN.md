# Kế hoạch triển khai Grok Pocket

## Mục tiêu

Tạo một web chat riêng tư có giao diện tối, gọn, lấy cảm hứng từ trải nghiệm sử dụng Grok. Ứng dụng dùng gateway tương thích OpenAI do người vận hành cấu hình; model chat cố định là `grok-4.5`. Đây là giao diện tùy biến, không phải bản sao thương hiệu hay sản phẩm chính thức của grok.com.

## Kiến trúc

```text
Trình duyệt/PWA
  │ session cookie HTTP-only
  ▼
Next.js web chat (Dokploy, HTTPS)
  ├─ /api/chat ──────────► gateway /v1/chat/completions (grok-4.5)
  ├─ /api/images ────────► gateway /v1/images/generations
  └─ /api/github/* ──────► GitHub API (repo allowlist)
```

Secret chỉ nằm trong biến môi trường của container. Trình duyệt chỉ gọi API cùng origin sau khi đã đăng nhập.

## Phạm vi hiện tại

| Khu vực | Có sẵn |
| --- | --- |
| Chat | Lịch sử local, gửi Enter, trạng thái đang trả lời, model `grok-4.5` khóa server-side |
| Ảnh | Prompt, ba tỷ lệ khung hình, hiển thị URL hoặc base64 trả về từ gateway |
| GitHub Connect | Allowlist repo, duyệt file, AI tạo proposal, review và commit atomic vào `main` |
| Bảo mật | Mật khẩu ứng dụng, HMAC session, kiểm tra Origin cho request thay đổi, giới hạn path nhạy cảm |
| Mobile | Giao diện responsive và manifest PWA |

## Các bước nghiệm thu

1. Cấu hình `GROK_BASE_URL`, key, model chat/ảnh, mật khẩu và session secret trong Dokploy.
2. Xác nhận trang tải, đăng nhập được và `/api/models` trả về `grok-4.5`.
3. Gửi một prompt ngắn; kiểm tra phản hồi và refresh trang để xác nhận lịch sử local còn lại.
4. Tạo một ảnh với prompt không nhạy cảm.
5. Thêm một repository thử nghiệm vào `GITHUB_ALLOWED_REPOS`; tạo proposal, xem nội dung, rồi chỉ bật auto-push khi đã sẵn sàng.
6. Quan sát log Dokploy nếu gateway trả lỗi; ứng dụng sẽ nêu rõ lỗi URL, timeout, HTTP status hoặc model không có.

## Hướng mở rộng an toàn

- Streaming token theo Server-Sent Events.
- Markdown có sanitize và code block/copy button.
- Xác thực nhiều người dùng qua OAuth/OIDC.
- Lưu lịch sử phía server với PostgreSQL.
- Thư viện prompt, chia sẻ chat có kiểm soát và quản lý chi phí theo người dùng.

Mỗi tính năng mới cần được đánh giá quyền truy cập, giới hạn dữ liệu và tác động tới secret trước khi bật.
