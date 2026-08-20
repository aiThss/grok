# Triển khai trên Dokploy

## 1. Chuẩn bị secret

Tạo các biến sau trong phần secret/environment của Dokploy. Không thêm file `.env` thật vào Git.

```text
WEBUI_URL=https://chat.example.com
CORS_ALLOW_ORIGIN=https://chat.example.com
WEBUI_SESSION_COOKIE_SECURE=true
WEBUI_SECRET_KEY=<openssl rand -hex 32>

WEBUI_ADMIN_NAME=Admin
WEBUI_ADMIN_EMAIL=<email quản trị>
WEBUI_ADMIN_PASSWORD=<mật khẩu dài, riêng biệt>
ENABLE_SIGNUP=false
DEFAULT_USER_ROLE=pending

OPENAI_API_BASE_URL=https://gateway.example.com/v1
OPENAI_API_KEY=<provider key đặc quyền tối thiểu>
OPENAI_API_CONFIGS={"0":{"enable":true,"prefix_id":"ai","model_ids":["your-model-id"]}}
ENABLE_OPENAI_API_PASSTHROUGH=false

ENABLE_VALVE_ENCRYPTION=true
ENABLE_PERSISTENT_CONFIG=true
```

Đặt `WEBUI_URL` và `CORS_ALLOW_ORIGIN` bằng chính xác URL HTTPS public trước lần khởi động đầu tiên. Chỉ khi thật sự cần nhiều domain mới thêm các browser origin khác, ngăn cách bằng dấu chấm phẩy.

## 2. Tạo ứng dụng

1. Trong Dokploy, tạo **Application** từ Git repository này ở chế độ build **Dockerfile**.
2. Đặt cổng application/container là **8080**.
3. Tạo persistent storage với mount path **`/app/backend/data`**. Mount này là bắt buộc.
4. Thêm các biến môi trường ở trên dưới dạng secret; không đặt chúng vào build argument hoặc biến hiển thị cho trình duyệt.
5. Thêm domain public, bật HTTPS rồi deploy.

Dockerfile dùng image upstream đã ghim phiên bản. Khi nâng cấp, hãy đổi `OPEN_WEBUI_VERSION` có chủ đích, deploy staging trước, backup dữ liệu, rồi mới đưa đúng phiên bản đã kiểm thử lên production.

## 3. Yêu cầu reverse proxy

Proxy/domain của Dokploy phải:

- kết thúc HTTPS và chuyển tiếp đến cổng 8080;
- chuyển tiếp header WebSocket `Upgrade` và `Connection`;
- tắt response buffering cho Server-Sent Events streaming;
- cho phép read timeout ít nhất 300 giây với phản hồi model chậm;
- không mở một host port trực tiếp khác ra Internet.

## 4. Quy trình chạy lần đầu

1. Mở `WEBUI_URL` public và đăng nhập bằng `WEBUI_ADMIN_EMAIL`/`WEBUI_ADMIN_PASSWORD`.
2. Vào **Admin Settings → Connections → OpenAI**, xác thực gateway và giới hạn model hiển thị ở các model ID đã phê duyệt.
3. Gửi một prompt ngắn và xác nhận streaming hoàn tất.
4. Restart/redeploy ứng dụng nhưng không xóa persistent storage; xác nhận tài khoản admin, cấu hình và chat thử vẫn còn.
5. Giữ signup đóng. Khi cần cấp quyền chung, tạo tài khoản thủ công hoặc bật signup sau với `DEFAULT_USER_ROLE=pending` để quản trị viên duyệt từng tài khoản.

## 5. Kiểm tra và giám sát

```bash
# Kiểm tra service public và database đã khởi tạo
curl -fsS https://chat.example.com/health

# Sau khi tạo tài khoản/API key riêng cho monitoring, kiểm tra model
curl -fsS https://chat.example.com/api/models \\
  -H "Authorization: Bearer <monitoring-api-key>"
```

Dùng `/health` cho liveness; dùng `/api/models` có xác thực để phát hiện provider lỗi dù trang đăng nhập vẫn hoạt động.

## 6. Sao lưu và khôi phục

Sao lưu toàn bộ thư mục data đã mount trước mỗi lần nâng cấp và ít nhất hằng ngày. Nó gồm `webui.db`, upload, vector data, cache và audit information. Mã hóa bản sao lưu, đồng thời thử phục hồi trên staging cô lập. Không dùng chung volume production với image `:dev`.

## 7. Lựa chọn chạy local

Nếu tự quản trị máy chủ, sao chép `.env.example` thành `.env`, điền secret rồi chạy:

```bash
docker compose up -d --build
```

Compose được cung cấp bind mặc định vào `127.0.0.1:3000`; hãy đặt reverse proxy có TLS ở phía trước. Không đổi sang bind public khi chưa hoàn tất kiểm soát HTTPS, CORS và firewall nêu trên.
