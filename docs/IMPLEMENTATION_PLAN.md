# Kế hoạch nghiên cứu và triển khai web chat Open WebUI

## Quyết định kiến trúc

Triển khai image container Open WebUI chính thức, ghim ở phiên bản `v0.11.0`, thay vì tự build toàn bộ mã nguồn từ source. Bản phát hành ổn định hiện tại có sẵn tài khoản đa người dùng, RBAC, kết nối API tương thích OpenAI, lưu lịch sử chat, tải tệp/RAG và PWA. Ghim phiên bản tránh các thay đổi không dự báo được về schema dữ liệu hoặc hành vi từ các tag trôi nổi như `main` và `dev`.

Ứng dụng là một nền tảng chat hoàn chỉnh, không phải frontend proxy mỏng. Nó quản lý tài khoản, chat, tệp tải lên, cấu hình, thông tin xác thực nhà cung cấp do quản trị viên lưu và dữ liệu vector tùy chọn. Vì vậy, thư mục dữ liệu bền vững là thành phần production bắt buộc, không phải cache.

## Kiến trúc mục tiêu

```text
Trình duyệt
  │ HTTPS + WebSocket/SSE
  ▼
Reverse proxy và TLS của Dokploy
  │ cổng 8080
  ▼
Container Open WebUI v0.11.0 ─────► Gateway tương thích OpenAI /v1
  │                                        └─► Grok hoặc các model đã chọn
  ▼
Volume Dokploy bền vững: /app/backend/data
  ├─ tài khoản, lịch sử chat, cấu hình
  ├─ tệp tải lên
  ├─ cơ sở dữ liệu vector (khi bật RAG)
  └─ audit/cache
```

Phiên bản đầu chỉ dùng một replica Open WebUI kèm volume bền vững. Khi cần high availability, phải thay SQLite bằng PostgreSQL, bổ sung Redis, dùng object storage/hạ tầng vector dùng chung và đặt cùng một `WEBUI_SECRET_KEY` trên mọi replica.

## Yêu cầu phiên bản đầu

| Hạng mục | Quyết định |
| --- | --- |
| Image | `ghcr.io/open-webui/open-webui:v0.11.0` qua Dockerfile trong repository |
| Mạng | Domain HTTPS; reverse proxy hỗ trợ WebSocket, SSE và read timeout ít nhất 300 giây |
| Xác thực | Đăng nhập local, chỉ có tài khoản quản trị khởi tạo, `ENABLE_SIGNUP=false` |
| Nhà cung cấp | Endpoint tương thích OpenAI có đúng đường dẫn phiên bản API, thường là `/v1` |
| Quyền provider | API key đặc quyền tối thiểu và allowlist model |
| Dữ liệu | Volume Dokploy mount tại `/app/backend/data` |
| Sao lưu | Sao lưu mã hóa toàn bộ volume trước mỗi nâng cấp và hằng ngày |
| Giám sát | Healthcheck `/health`; kiểm tra kết nối model qua `/api/models` có xác thực |
| Chưa triển khai | Chia sẻ public, MCP/tool/function, web search, RAG, tạo ảnh, voice, OAuth/SSO, Ollama |

## Quyết định về biến môi trường

Phải đặt URL public, CORS origin, cookie bảo mật và `WEBUI_SECRET_KEY` trước lần chạy production đầu tiên. Open WebUI lưu một số cấu hình trong cơ sở dữ liệu; do đó thay đổi biến môi trường sau này có thể trông như bị bỏ qua vì giá trị đã lưu trong Admin panel được ưu tiên. Sau khi khởi tạo, hãy dùng Admin panel cho các cấu hình thông thường. Chỉ đặt `ENABLE_PERSISTENT_CONFIG=false` khi thực sự muốn mọi cấu hình hoàn toàn được quản lý bằng biến môi trường.

`WEBUI_SECRET_KEY` phải dài, ngẫu nhiên, lưu trong Dokploy Secrets và giữ ổn định. Đổi key sẽ làm mất hiệu lực phiên đăng nhập và khiến thông tin xác thực plugin/function đã mã hóa không đọc lại được. `ENABLE_VALVE_ENCRYPTION=true` bảo vệ secret lưu cho plugin/function; không bật plugin không đáng tin cậy trong phiên bản đầu.

URL provider phải là base URL tương thích OpenAI, bao gồm đường dẫn phiên bản API. Nếu provider không hỗ trợ `/models`, thêm thủ công model ID cần dùng vào allowlist trong Admin panel thay vì mở toàn bộ danh sách model upstream.

## Triển khai theo giai đoạn

1. **Nền tảng (repository này):** deploy image chính thức đã ghim phiên bản, storage bền vững, domain TLS, secret, admin đầu tiên, tắt signup và một gateway model.
2. **Nghiệm thu:** kiểm tra đăng nhập, model discovery/allowlist, phản hồi streaming, reconnect và dữ liệu còn lại sau khi container được tạo lại.
3. **Vận hành:** lập lịch backup, chỉ nâng cấp sau khi test staging, theo dõi `/health` và request `/api/models` có xác thực, lưu log deploy/application.
4. **Gia cố:** giới hạn CORS vào domain production, secure cookie, tắt passthrough, rà soát role admin, giới hạn provider key và thử security header/CSP ở report-only trước khi ép buộc.
5. **Mở rộng tùy chọn:** bật RAG sau khi có kế hoạch dung lượng và backup; rồi mới cân nhắc SSO, web search, MCP/tools, object storage, PostgreSQL, Redis và nhiều replica.

## Những điều không nằm trong phạm vi và rủi ro

- Đây không phải dự án đổi thương hiệu tự do: giấy phép và yêu cầu nhận diện thương hiệu của upstream vẫn áp dụng.
- Container không có data volume sẽ mất lịch sử chat, tài khoản, tệp tải lên và cấu hình khi bị tạo lại.
- Reverse proxy thiếu WebSocket hoặc CORS đúng thường gây lỗi kết nối chat dù trang chính vẫn tải được.
- Không dùng provider management/master key cho lưu lượng chat thông thường.
- Không mở trực tiếp cổng Open WebUI ra Internet khi có reverse proxy HTTPS của Dokploy.
