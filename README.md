# TMS data-driven Playwright automation

An independent TypeScript automation engine that fetches test cases by TMS task ID, compiles Vietnamese test steps into a validated execution plan, executes supported actions in Chromium, and writes evidence-backed results. It does not generate one Playwright spec per TMS test case.

## Tài liệu tiếng Việt

Nên đọc theo thứ tự:

1. [Hướng dẫn cài đặt](docs/INSTALLATION.vi.md): yêu cầu hệ thống, `.env`, Chromium, CI và kiểm tra cài đặt.
2. [Hướng dẫn sử dụng](docs/USER_GUIDE.vi.md): chạy task, đọc status/report, debug và xử lý mapping/data.
3. [Tài liệu kiến trúc](docs/ARCHITECTURE.vi.md): pipeline, module boundaries và cách mở rộng compiler/runtime.

Chạy nhanh sau khi đã cấu hình `.env`:

```bash
npm run test:tms -- TT-1240
npm run test:task -- TT-1240
```

## Requirements and installation

- Node.js 20 or newer
- npm and network access to TMS

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

Set the TMS configuration in `.env`. `TMS_TOKEN` is optional at schema level because the current API authentication contract is unknown. When present, it is sent as `Authorization: Bearer <token>` by default; change `TMS_AUTH_HEADER` and `TMS_AUTH_SCHEME` if needed.

```dotenv
TMS_BASE_URL=
TMS_TOKEN=
APP_BASE_URL=
HEADLESS=true
```

Credentials and authorization headers are never written to reports. Do not commit `.env` or `.auth`.

## Commands

```bash
npm run test:task -- TT-1240
npm run test:headed -- TT-1240
npm run test:tms -- TT-1240
npm run test
npm run test:e2e
npm run typecheck
npm run lint
```

`test:task` runs the real pipeline:

1. Fetch `/api/tasks/task/{TASK_ID}/testcases`.
2. Adapt the response to the local TMS model.
3. Compile each testcase into a Zod-validated `ExecutionPlan`.
4. Reuse `.cache/{TEST_CASE_ID}.json` when title, description, and steps have not changed.
5. Prepare authentication once.
6. Execute supported plans in isolated browser contexts.
7. Save evidence and `output/reports/{TASK_ID}.json`.

`test:e2e` uses `tests/task.spec.ts`; set `TASK_ID=TT-1240` to enable it. Without `TASK_ID`, the Playwright test is intentionally skipped.

## Status semantics

- `PASS`: every compiled action and business assertion was verified.
- `FAIL`: the mapped flow ran, but an action failed or actual behavior differed from expected.
- `SKIP`: no executable action exists for the current scope.
- `NEED_MAPPING`: an action, expected result, page, or UI target cannot be mapped safely.
- `NEED_DATA`: a supported flow requires business test data the provider cannot supply.
- `PARTIAL`: the flow ran, but only part of the expected business result was verified.

`NEED_MAPPING`, `NEED_DATA`, and `PARTIAL` are never converted to `PASS`. By default they remain visible without making the CLI exit non-zero. Set `NEED_ATTENTION_EXIT_CODE=true` to make them fail CI. Any `FAIL` or infrastructure error exits with code 1.

## Compiler architecture

`DeterministicTestCaseCompiler` recognizes explicit patterns such as:

- `Mở modal [Tìm kiếm đơn hàng]` → `OPEN_MODAL`
- `Click vào dropdown "Tình trạng QA"` plus `Chọn trạng thái "Tái chế"` → `SELECT`
- `Bấm tìm kiếm` → `SEARCH`
- combined fields in brackets → `FILL_SEARCH_FIELDS`

Unknown actions and unverifiable expected results become `CUSTOM/NEED_MAPPING`. A misplaced modal/search step is reordered only when the dependency is unambiguous. Ambiguous ordering is reported instead of guessed.

`TestCaseCompiler` is the extension interface. `AiTestCaseCompiler` is deliberately a non-functional extension point; no AI provider, key, or fake response is included.

## Add or correct a UI mapping

Mappings live in `src/ui/pages/order-list.ts`; resolution logic lives in `src/ui/resolver.ts`. Prefer role/accessibility name, label, placeholder, `data-testid`, then stable CSS.

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

Bundled order-search mappings are semantic candidates derived from TMS terminology. Verify them against the real DOM. A candidate matching nothing produces `NEED_MAPPING`, never `PASS`.

## Add an action handler

1. Add the discriminated action to `src/compiler/types.ts` and `src/compiler/schema.ts`.
2. Compile only explicit patterns in `src/compiler/compiler.ts`.
3. Add a handler to `actionHandlers` in `src/runtime/actions.ts`.
4. Add unit tests for both supported and unsupported input.

Handlers are separate from assertions: clicking Search cannot pass a search-result testcase by itself.

## Test data

The default `StaticTestDataProvider` reads optional JSON from `TEST_DATA_JSON`. It never invents application endpoints.

```json
{
  "fields": {
    "Mã/tên đơn hàng": "ORDER-001",
    "PO": "PO-001"
  },
  "orders": [
    {
      "orderCode": "ORDER-001",
      "qaStatus": "Tái chế",
      "customerCode": "CUS-01",
      "po": "PO-001"
    }
  ],
  "searchExpectations": [
    {
      "criteria": { "Tình trạng QA": "Tái chế" },
      "includedOrderCodes": ["ORDER-001"],
      "excludedOrderCodes": ["ORDER-002"]
    }
  ]
}
```

For real data, implement `TestDataProvider` from `src/data/types.ts` using a documented application API, database fixture, or controlled seed. Until then, exact business-result assertions report `NEED_DATA`.

## Authentication

- `AUTH_MODE=none`: no login automation.
- `AUTH_MODE=storage-state`: reuse `AUTH_STORAGE_STATE`.
- `AUTH_MODE=form`: log in once and save storage state for all testcases.

Form login requires verified UI mappings for `Tên đăng nhập`, `Mật khẩu`, and `Đăng nhập`. They are intentionally not invented. Add them after inspecting the actual login DOM. Missing credentials, storage state, or mappings produce a clear `NEED_MAPPING` reason.

## Artifacts and security

Non-passing browser executions keep:

```text
output/screenshots/{TEST_CASE_ID}/failure.png
output/traces/{TEST_CASE_ID}/trace.zip
output/reports/{TASK_ID}.json
```

Network collection stores only method, redacted URL, status, duration, and failure state. It does not dump headers, cookies, authorization values, or response bodies.

## Current TT-1240 POC scope

The deterministic compiler supports opening the order-search modal, QA-status selection, combined search fields, Search, retained-value assertions, basic include/exclude rules, and download extension points. Real browser execution still requires:

- a reachable `APP_BASE_URL`;
- verified DOM mappings for the application version;
- authentication mappings or storage state if login is required;
- real search data and expected included/excluded order codes.

Run `npm run test:tms -- TT-1240` first to validate TMS authentication, then `npm run test:task -- TT-1240`. The JSON report lists every testcase needing mapping or data and the exact reason.
