# Triển khai Grok Pocket trên Dokploy

## Chuẩn bị trước khi deploy

Tạo một API key gateway có quyền tối thiểu cần thiết. Điền các biến trong `.env.example` vào Dokploy **Environment/Secrets**, thay giá trị mẫu bằng secret thật. Không đẩy `.env` lên GitHub.

Tạo một `SESSION_SECRET` có ít nhất 32 ký tự. Ví dụ PowerShell:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Tạo thêm `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` bằng cùng lệnh trên và lưu dưới **Build Time Arguments**. Giá trị này phải giữ ổn định ở mọi lần deploy.

## Thiết lập Dokploy

1. Tạo **Application** từ repository GitHub hiện tại, chọn **Dockerfile** build mode.
2. Chọn branch `main`; đặt container port `3000`.
3. Thêm domain HTTPS trong mục Domains của Dokploy.
4. Dán các secret từ `.env.example` vào Environment. Không dùng biến `NEXT_PUBLIC_` cho bất kỳ key nào.
5. Thêm `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` vào Build Time Arguments rồi deploy.

## Kiểm tra sau deploy

1. Mở domain bằng cửa sổ ẩn danh, đăng nhập bằng `APP_PASSWORD`.
2. Phía trên khung chat phải hiện `grok-4.5`, không phải trạng thái đang kiểm tra.
3. Gửi `Xin chào`; nếu thất bại, đọc thông báo lỗi cụ thể và log container. Kiểm tra `GROK_BASE_URL`/API key/model trước.
4. Mở tab **Ảnh**, thử prompt đơn giản. Nếu gateway không có route ảnh, chỉ tab này báo lỗi; chat không bị ảnh hưởng.
5. Chỉ cấu hình `GITHUB_TOKEN` và `GITHUB_ALLOWED_REPOS` khi cần. Khởi đầu bằng repo thử nghiệm, review proposal và giữ Auto-push tắt.

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân/khắc phục |
| --- | --- |
| `GROK_BASE_URL is not configured` | Thiếu biến môi trường hoặc container chưa redeploy sau khi thêm biến |
| Gateway trả HTML | Base URL đang trỏ trang web thay vì endpoint API; dùng URL tương thích OpenAI với `/v1` |
| `401` hoặc `403` từ gateway | API key sai, hết hạn hoặc thiếu quyền cho model |
| `GROK_DEFAULT_MODEL ... is not available` | Sửa model ID hoặc mapping model tại gateway |
| Chat báo `HTTP 502`, `503` hoặc `504` | Gateway hoặc reverse proxy đã ngắt luồng chat. Tắt response buffering và đặt read timeout của Dokploy tối thiểu 120 giây, sau đó redeploy |
| Chat quá 100 giây | Gateway/model chat không trả lời trong thời hạn. Kiểm tra log gateway và mapping của `grok-4.5` |
| GitHub không có repo | Kiểm tra token, `GITHUB_ALLOWED_REPOS`, quyền Contents và branch |

## Cập nhật và phục hồi

Mỗi thay đổi mã nguồn được build trong Docker image mới. Nếu deploy lỗi, Dokploy có thể rollback về image/commit trước. Giữ lại giá trị `SESSION_SECRET` để session hợp lệ giữa các lần redeploy. Vì lịch sử chat hiện được lưu ở localStorage của trình duyệt, xóa dữ liệu website hoặc đổi thiết bị sẽ không mang lịch sử cũ sang máy khác.
