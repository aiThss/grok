# Web Chat

Repository này triển khai [Open WebUI](https://github.com/open-webui/open-webui): giao diện chat AI tự host, hỗ trợ API tương thích OpenAI và model Ollama chạy local. Repository **không** sao chép hay fork mã nguồn Open WebUI; Docker sẽ tải image chính thức đã ghim phiên bản, còn repository này quản lý cấu hình triển khai, tài liệu và quyết định vận hành.

## Phạm vi phiên bản đầu

- Web chat riêng tư, đa người dùng, chạy sau HTTPS.
- Một hoặc nhiều gateway model tương thích OpenAI, bao gồm gateway tương thích Grok.
- Lưu bền vững chat, tài khoản, tệp tải lên và dữ liệu vector tại `/app/backend/data`.
- Tắt đăng ký tự do và tạo sẵn một tài khoản quản trị.
- Chưa bật chia sẻ công khai, passthrough tới nhà cung cấp model, MCP, tool tùy ý, web search, nạp tài liệu RAG hoặc Ollama đóng gói sẵn.

Các tính năng tùy chọn trên làm tăng bề mặt tấn công hoặc chi phí vận hành. Chỉ bật sau khi luồng chat cơ bản đã ổn định.

## Nội dung repository

- `Dockerfile` — sử dụng image Open WebUI chính thức đã ghim phiên bản.
- `docker-compose.yml` — triển khai một node ở local hoặc máy chủ tự quản trị.
- `.env.example` — mẫu cấu hình cho lần chạy đầu, không chứa secret.
- `docs/DEPLOYMENT.md` — quy trình triển khai production trên Dokploy và checklist xác thực.
- `docs/IMPLEMENTATION_PLAN.md` — kết quả nghiên cứu, kiến trúc và lộ trình theo giai đoạn.

## Kiểm tra nhanh ở local

1. Sao chép `.env.example` thành `.env`, rồi thay tất cả giá trị mẫu bằng giá trị riêng tư thật.
2. Chạy `docker compose up -d --build`.
3. Mở `http://127.0.0.1:3000`, đăng nhập bằng tài khoản quản trị khởi tạo, sau đó thêm/xác thực nhà cung cấp model.

Để triển khai public, dùng quy trình Dokploy và cấu hình HTTPS tại [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Không bao giờ commit `.env`, API key, bản sao cơ sở dữ liệu hoặc `/app/backend/data`.

## Upstream và giấy phép

Open WebUI là sản phẩm upstream có giấy phép và yêu cầu nhận diện thương hiệu riêng. Trước khi tùy biến giao diện hoặc phát hành bản đã sửa, hãy đọc [giấy phép Open WebUI](https://github.com/open-webui/open-webui/blob/main/LICENSE) hiện hành và giữ nguyên các yêu cầu về ghi nhận/nhận diện thương hiệu.
