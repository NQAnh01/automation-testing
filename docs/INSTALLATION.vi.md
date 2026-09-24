# Hướng dẫn cài đặt

Tài liệu này hướng dẫn cài project automation trên máy developer hoặc máy CI. Project chạy độc lập với source Vue/Laravel của ứng dụng được kiểm thử.

## 1. Yêu cầu hệ thống

- Node.js 20 trở lên; nên dùng một bản LTS.
- npm.
- Có quyền truy cập `https://projects.tms-s.vn`.
- Có token TMS nếu endpoint yêu cầu xác thực.
- Có URL và tài khoản của application nếu muốn chạy browser automation thật.

Kiểm tra môi trường:

```bash
node --version
npm --version
```

## 2. Cài dependency

```bash
cd /home/anh/tms/automation
npm install
npx playwright install chromium
```

Trên CI Linux mới hoàn toàn, có thể cần cài thêm system dependency:

```bash
npx playwright install --with-deps chromium
```

## 3. Tạo file cấu hình

```bash
cp .env.example .env
```

Không commit `.env`, token, password hoặc file storage state vào Git.

### Cấu hình tối thiểu để đọc TMS

```dotenv
TMS_BASE_URL=https://projects.tms-s.vn
TMS_TOKEN=your-token
TMS_AUTH_SCHEME=Bearer
TMS_AUTH_HEADER=Authorization
```

Client mặc định gửi:

```http
Authorization: Bearer your-token
```

Nếu API dùng header khác:

```dotenv
TMS_AUTH_HEADER=X-API-Key
TMS_AUTH_SCHEME=
TMS_TOKEN=your-api-key
```

### Cấu hình để chạy browser

```dotenv
APP_BASE_URL=https://application-under-test.example
HEADLESS=true
OUTPUT_DIR=output
```

Nếu chưa có `APP_BASE_URL`, hệ thống vẫn có thể fetch và compile testcase, nhưng không chạy browser. Các testcase cần browser sẽ được báo `NEED_MAPPING` với lý do cấu hình còn thiếu.

### Cấu hình đăng nhập

Không cần đăng nhập tự động:

```dotenv
AUTH_MODE=none
```

Dùng storage state đã có:

```dotenv
AUTH_MODE=storage-state
AUTH_STORAGE_STATE=.auth/storage-state.json
```

Đăng nhập bằng form một lần rồi lưu storage state:

```dotenv
AUTH_MODE=form
TEST_USERNAME=automation-user
TEST_PASSWORD=secret
AUTH_STORAGE_STATE=.auth/storage-state.json
```

`AUTH_MODE=form` chỉ chạy được sau khi registry có mapping đã xác minh cho ba target `Tên đăng nhập`, `Mật khẩu` và `Đăng nhập`.

## 4. Danh sách biến môi trường

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---:|---|---|
| `TMS_BASE_URL` | Có | `https://projects.tms-s.vn` trong code | Base URL của TMS |
| `TMS_TOKEN` | Tùy API | Trống | Token xác thực TMS |
| `TMS_AUTH_SCHEME` | Không | `Bearer` | Prefix đứng trước token |
| `TMS_AUTH_HEADER` | Không | `Authorization` | Header chứa token |
| `APP_BASE_URL` | Khi chạy browser | Trống | URL application được kiểm thử |
| `AUTH_MODE` | Không | `none` | `none`, `form` hoặc `storage-state` |
| `TEST_USERNAME` | Với form login | Trống | Tài khoản automation |
| `TEST_PASSWORD` | Với form login | Trống | Mật khẩu automation |
| `AUTH_STORAGE_STATE` | Không | `.auth/storage-state.json` | Cookie/local storage dùng lại |
| `HEADLESS` | Không | `true` | Chạy browser ẩn hoặc hiện |
| `OUTPUT_DIR` | Không | `output` | Thư mục report/artifact |
| `TEST_DATA_JSON` | Tùy testcase | Trống | Dữ liệu cho static data provider |
| `NEED_ATTENTION_EXIT_CODE` | Không | `false` | Có làm CI fail khi gặp NEED/PARTIAL hay không |

## 5. Xác nhận cài đặt

Chạy lần lượt:

```bash
npm run typecheck
npm run test
npm run lint
npm run test:e2e
```

Kết quả mong đợi:

- TypeScript không có lỗi.
- Unit tests của adapter/compiler đều pass.
- ESLint không có lỗi.
- Playwright khởi động được. Test task sẽ skip nếu chưa đặt `TASK_ID`.

Kiểm tra kết nối TMS:

```bash
npm run test:tms -- TT-1240
```

Nếu nhận `HTTP 401`, endpoint đã phản hồi nhưng token hoặc auth scheme chưa đúng. Kiểm tra lại `TMS_TOKEN`, `TMS_AUTH_HEADER` và `TMS_AUTH_SCHEME`.

## 6. Chạy lần đầu

```bash
npm run test:task -- TT-1240
```

Chạy có giao diện browser:

```bash
npm run test:headed -- TT-1240
```

Report được ghi tại:

```text
output/reports/TT-1240.json
```

Trace và screenshot của testcase không pass nằm trong:

```text
output/traces/{TEST_CASE_ID}/trace.zip
output/screenshots/{TEST_CASE_ID}/failure.png
```

Mở trace:

```bash
npx playwright show-trace output/traces/TTTC-2614/trace.zip
```

## 7. Cài đặt trên CI

Quy trình tối thiểu:

```bash
npm ci
npx playwright install --with-deps chromium
npm run typecheck
npm run test
npm run lint
npm run test:task -- TT-1240
```

Nên đặt secret bằng secret store của CI, không ghi trực tiếp vào YAML hoặc repository. Với quality gate nghiêm ngặt:

```dotenv
NEED_ATTENTION_EXIT_CODE=true
```

Khi đó `FAIL`, `NEED_MAPPING`, `NEED_DATA` và `PARTIAL` đều làm job CI thất bại.
