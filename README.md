# Grok Pocket

Web chat riêng tư, giao diện lấy cảm hứng từ trải nghiệm chat hiện đại của Grok, nhưng không liên kết hay tuyên bố là sản phẩm chính thức của xAI/grok.com.

## Tính năng

- Chat qua gateway tương thích OpenAI, khóa vào model `grok-4.5` cấu hình trên server.
- Tạo ảnh qua endpoint `/v1/images/generations` với model ảnh cấu hình riêng.
- GitHub Workspace: chỉ đọc repository trong allowlist, để AI đề xuất thay đổi, xem trước nội dung và tùy chọn commit thẳng vào `main`.
- Đăng nhập bằng mật khẩu ứng dụng; API key Grok và GitHub token không bao giờ được gửi ra trình duyệt.
- PWA cài được trên điện thoại và lưu lịch sử chat ở trình duyệt.

## Chạy local

1. Sao chép `.env.example` thành `.env.local` và điền các secret thật.
2. Cài dependency: `npm ci`.
3. Chạy `npm run dev` rồi mở `http://localhost:3000`.

Muốn dùng Docker, sao chép `.env.example` thành `.env` và chạy `docker compose up -d --build`.

## Cấu hình bắt buộc

| Biến | Mục đích |
| --- | --- |
| `GROK_BASE_URL` | Base URL gateway tương thích OpenAI; có hoặc không có `/v1` đều được chuẩn hóa |
| `GROK_API_KEY` | API key của gateway, chỉ có trên server |
| `GROK_DEFAULT_MODEL` | Model chat duy nhất được phép, mặc định `grok-4.5` |
| `GROK_IMAGE_MODEL` | Model tạo ảnh, mặc định `grok-imagine-image-2.0` |
| `APP_PASSWORD` | Mật khẩu để mở web chat |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự để ký session |

GitHub là tùy chọn. Dùng fine-grained token có quyền **Contents: Read and write** chỉ trên những repo đặt trong `GITHUB_ALLOWED_REPOS`. Auto-push mặc định tắt; luôn xem trước thay đổi trước khi commit.

## Deploy Dokploy

1. Tạo **Application** từ repository này, chọn build **Dockerfile**.
2. Đặt container port là `3000` và bật domain HTTPS.
3. Đặt toàn bộ biến trong `.env.example` vào **Environment/Secrets** của Dokploy, không commit file `.env`.
4. Thêm một build argument ổn định `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` là Base64 của 32 byte ngẫu nhiên.
5. Deploy, mở domain và đăng nhập. Tab Ảnh và GitHub chỉ hoạt động khi gateway/token tương ứng được cấu hình.

Chat dùng Server-Sent Events (SSE), vì vậy reverse proxy Dokploy không được buffer response và nên đặt read timeout tối thiểu **120 giây**. Sau mỗi deploy, thử chat, tạo ảnh và kiểm tra GitHub bằng một repository thử nghiệm trước.

## An toàn

- Không đưa `GROK_API_KEY`, `GITHUB_TOKEN`, `.env` hoặc session secret lên GitHub.
- Chỉ thêm repository thật sự muốn AI đọc/sửa vào allowlist.
- GitHub Workspace chặn `.env`, `.npmrc`, `.git/` và workflow CI để hạn chế thay đổi nhạy cảm.
- Không bật auto-push trừ khi đã kiểm tra proposal; thao tác tạo commit là thay đổi không thể hoàn tác tự động.
