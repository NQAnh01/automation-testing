# Hướng dẫn sử dụng

Tài liệu này dành cho QA, developer và người vận hành muốn chạy testcase từ một TMS Task ID.

## 1. Luồng sử dụng nhanh

```bash
cd /home/anh/tms/automation
npm run test:tms -- TT-1240
npm run test:task -- TT-1240
```

Lệnh thứ nhất chỉ kiểm tra kết nối và liệt kê testcase. Lệnh thứ hai thực hiện toàn bộ pipeline TMS → compile → browser → assertion → report.

Để quan sát browser:

```bash
npm run test:headed -- TT-1240
```

## 2. Hệ thống thực hiện những gì?

Với mỗi task, engine sẽ:

1. Gọi `GET /api/tasks/task/{TASK_ID}/testcases`.
2. Chỉ giữ các trường cần thực thi như ID, title, description và steps.
3. Biên dịch câu lệnh tiếng Việt thành `ExecutionPlan` có cấu trúc.
4. Kiểm tra cache để không compile lại testcase chưa thay đổi.
5. Chuẩn bị login/storage state.
6. Mở browser context riêng cho từng testcase.
7. Resolve target qua UI Registry.
8. Thực hiện action và assertion độc lập.
9. Thu thập network metadata, screenshot và trace.
10. Ghi console summary và JSON report.

Engine không tạo hàng trăm file `.spec.ts`, không cho runtime đoán câu tiếng Việt, và không tự báo `PASS` khi chưa kiểm tra được expected result.

## 3. Ý nghĩa trạng thái

| Trạng thái | Ý nghĩa | Hành động tiếp theo |
|---|---|---|
| `PASS` | Tất cả action và assertion đã được kiểm chứng | Không cần xử lý |
| `FAIL` | Flow đã được map nhưng actual khác expected hoặc thao tác bị lỗi | Xem screenshot, trace, failed action |
| `NEED_MAPPING` | Chưa hiểu action/expected result hoặc chưa resolve được UI | Bổ sung compiler pattern/UI registry |
| `NEED_DATA` | Thiếu order/customer/PO hoặc expected dataset | Bổ sung data provider/fixture |
| `PARTIAL` | Chạy được flow nhưng chưa kiểm chứng đủ business rule | Bổ sung assertion/verifier |
| `SKIP` | Testcase ngoài phạm vi automation hiện tại | Review và giữ skip hoặc mở rộng engine |

`PASS` chỉ xuất hiện khi toàn bộ action/assertion của plan trả kết quả thành công.

## 4. Đọc console report

Ví dụ:

```text
Task: TT-1240

Total:        25
PASS:         15
FAIL:          3
SKIP:          0
NEED_MAPPING:  4
NEED_DATA:     1
PARTIAL:       2
```

Phía dưới summary, mỗi testcase có status, step lỗi và reason. Báo cáo đầy đủ nằm tại `output/reports/{TASK_ID}.json`.

Các trường quan trọng trong JSON:

- `summary`: tổng hợp theo status.
- `results[].reason`: nguyên nhân không pass.
- `results[].failedActionIndex`: action index bị lỗi.
- `results[].actionResults`: action đã compile, expected, actual và error.
- `results[].network`: method, URL đã redact, HTTP status và duration.
- `results[].artifacts`: đường dẫn screenshot/trace.

## 5. Debug testcase FAIL

1. Mở JSON report và tìm `testCaseId`.
2. Đọc `failedActionIndex`, `reason`, `expected` và `actual`.
3. Xem screenshot trong `output/screenshots/{TEST_CASE_ID}`.
4. Mở trace:

```bash
npx playwright show-trace output/traces/{TEST_CASE_ID}/trace.zip
```

5. Nếu lỗi do locator, kiểm tra accessibility tree/DOM rồi cập nhật UI Registry.
6. Nếu flow đúng nhưng business result sai, giữ status `FAIL`; không đổi assertion thành kiểm tra element visible đơn giản hơn.

## 6. Xử lý NEED_MAPPING

### Target UI chưa tồn tại

Thông báo thường gặp:

```text
Unknown UI target: "Tên control"
```

Thêm definition hoặc alias vào `src/ui/pages/order-list.ts`:

```ts
{
  key: 'orderSearch.qaStatus',
  aliases: ['Tình trạng QA', 'Trạng thái QA', 'QA Status'],
  type: 'select',
  locator: {
    strategy: 'candidates',
    values: [
      { strategy: 'label', value: 'Tình trạng QA' },
      { strategy: 'testId', value: 'qa-status' },
    ],
  },
}
```

Ưu tiên locator theo thứ tự: role → label → placeholder → test ID → stable CSS. Không thêm fuzzy matching rộng hoặc XPath dễ vỡ.

### Action chưa được compiler hiểu

Report sẽ ghi:

```text
No deterministic action mapping for step ...
```

Chỉ thêm parser khi pattern đủ rõ ràng. Sau đó thêm unit test trong `src/compiler/compiler.test.ts`.

### Expected result chưa kiểm chứng được

Report sẽ ghi:

```text
Expected result is not deterministically verifiable: ...
```

Cần bổ sung một assertion có thể đo actual result. Không được xóa expected result hoặc tự trả `PASS`.

## 7. Cung cấp test data

Phase hiện tại dùng `StaticTestDataProvider`. Có thể đặt JSON một dòng trong `.env`:

```dotenv
TEST_DATA_JSON={"fields":{"Mã/tên đơn hàng":"ORDER-001","PO":"PO-001"},"orders":[{"orderCode":"ORDER-001","qaStatus":"Tái chế"}],"searchExpectations":[{"criteria":{"Tình trạng QA":"Tái chế"},"includedOrderCodes":["ORDER-001"],"excludedOrderCodes":["ORDER-002"]}]}
```

Các nhóm dữ liệu:

- `fields`: giá trị dùng để fill control tìm kiếm.
- `orders`: order dùng cho assertion included/excluded.
- `searchExpectations`: các order bắt buộc có hoặc không có trong bảng kết quả.

Nếu không tìm thấy dữ liệu phù hợp, engine trả `NEED_DATA`.

Khi có application API hoặc database fixture chính thức, nên implement một class mới theo `TestDataProvider` thay vì duy trì JSON lớn trong environment.

## 8. Authentication

### Ứng dụng không yêu cầu login

```dotenv
AUTH_MODE=none
```

### Dùng session đã lưu

```dotenv
AUTH_MODE=storage-state
AUTH_STORAGE_STATE=.auth/storage-state.json
```

### Form login

```dotenv
AUTH_MODE=form
TEST_USERNAME=automation-user
TEST_PASSWORD=secret
```

Engine đăng nhập một lần, lưu storage state và tái sử dụng cho các browser context. Nếu mapping login chưa tồn tại, tất cả testcase sẽ được báo `NEED_MAPPING` thay vì crash không rõ nguyên nhân.

## 9. Cache compiled plan

Plan được lưu ở `.cache/{TEST_CASE_ID}.json`. Fingerprint phụ thuộc title, description, pre/post-condition và steps.

- Testcase không đổi: dùng cache.
- Testcase thay đổi: tự compile lại.
- Cache hỏng hoặc sai schema: tự rebuild.

Có thể xóa riêng một cache file để ép compile lại một testcase. Không cần commit `.cache`.

## 10. Exit code và CI

Mặc định:

- Có `FAIL` hoặc infrastructure error: exit 1.
- Chỉ có `NEED_MAPPING`, `NEED_DATA`, `PARTIAL`: exit 0 nhưng hiển thị rõ trong report.

Để dùng các trạng thái cần chú ý làm quality gate:

```dotenv
NEED_ATTENTION_EXIT_CODE=true
```

## 11. Lỗi thường gặp

### TMS trả HTTP 401

- Token thiếu/hết hạn.
- Sai `TMS_AUTH_SCHEME`.
- Sai `TMS_AUTH_HEADER`.

Chạy lại:

```bash
npm run test:tms -- TT-1240
```

### Browser chưa được cài

```bash
npx playwright install chromium
```

### `APP_BASE_URL is not configured`

Điền URL application vào `.env`. Đây là `NEED_MAPPING`, không phải testcase fail.

### Mapping có nhưng không match element

Selector semantic hiện tại có thể chưa khớp DOM thật. Chạy headed, inspect label/role/test ID rồi sửa registry.

### Search chạy nhưng trả NEED_DATA

Flow UI đã hoạt động nhưng engine chưa có dataset để chứng minh kết quả đúng. Bổ sung `searchExpectations` hoặc provider thật.
