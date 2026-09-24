import { UiRegistry, type UiElementDefinition } from '../registry';

const labelCandidates = (label: string): UiElementDefinition['locator'] => ({
  strategy: 'candidates',
  values: [
    { strategy: 'label', value: label },
    { strategy: 'role', role: 'combobox', name: label },
    { strategy: 'placeholder', value: label },
  ],
});

export const orderListDefinitions: UiElementDefinition[] = [
  {
    key: 'orderSearch.modal',
    aliases: ['Tìm kiếm đơn hàng', 'Modal tìm kiếm đơn hàng'],
    type: 'modal',
    locator: {
      strategy: 'candidates',
      values: [
        { strategy: 'role', role: 'dialog', name: 'Tìm kiếm đơn hàng' },
        { strategy: 'testId', value: 'order-search-modal' },
      ],
    },
    trigger: {
      strategy: 'candidates',
      values: [
        { strategy: 'role', role: 'button', name: 'Tìm kiếm đơn hàng' },
        { strategy: 'role', role: 'button', name: 'Tìm kiếm' },
        { strategy: 'testId', value: 'open-order-search' },
      ],
    },
    notes: 'Semantic candidates must be verified against the real application DOM.',
  },
  {
    key: 'orderSearch.qaStatus',
    aliases: ['Tình trạng QA', 'Trạng thái QA', 'QA Status'],
    type: 'select',
    locator: labelCandidates('Tình trạng QA'),
    scope: 'orderSearch.modal',
  },
  {
    key: 'orderSearch.dossierStatus',
    aliases: ['Tình trạng lập HSSX', 'Trạng thái lập HSSX'],
    type: 'select',
    locator: labelCandidates('Tình trạng lập HSSX'),
    scope: 'orderSearch.modal',
  },
  {
    key: 'orderSearch.orderStatus',
    aliases: ['Tình trạng đơn hàng', 'Trạng thái đơn hàng'],
    type: 'select',
    locator: labelCandidates('Tình trạng đơn hàng'),
    scope: 'orderSearch.modal',
  },
  ...[
    ['orderSearch.order', ['Mã/tên đơn hàng', 'Mã đơn hàng', 'Tên đơn hàng']],
    ['orderSearch.customerCode', ['Mã khách hàng']],
    ['orderSearch.po', ['PO']],
    ['orderSearch.hatType', ['Kiểu nón']],
    ['orderSearch.color', ['Màu sắc']],
    ['orderSearch.createdFrom', ['Ngày tạo - Từ']],
    ['orderSearch.createdTo', ['Ngày tạo - Đến']],
    ['orderSearch.deliveryFrom', ['Ngày giao - Từ']],
    ['orderSearch.deliveryTo', ['Ngày giao - Đến']],
  ].map(
    ([key, aliases]) =>
      ({
        key: key as string,
        aliases: aliases as string[],
        type: (key as string).includes('From') || (key as string).includes('To') ? 'date' : 'input',
        locator: labelCandidates((aliases as string[])[0]!),
        scope: 'orderSearch.modal',
      }) satisfies UiElementDefinition,
  ),
  {
    key: 'orderSearch.submit',
    aliases: ['Tìm kiếm', 'Bấm tìm kiếm'],
    type: 'button',
    locator: {
      strategy: 'candidates',
      values: [
        { strategy: 'role', role: 'button', name: 'Tìm kiếm' },
        { strategy: 'testId', value: 'order-search-submit' },
      ],
    },
    scope: 'orderSearch.modal',
  },
  {
    key: 'orderSearch.results',
    aliases: ['Kết quả tìm kiếm', 'Danh sách đơn hàng'],
    type: 'table',
    locator: {
      strategy: 'candidates',
      values: [
        { strategy: 'role', role: 'table', name: 'Kết quả tìm kiếm' },
        { strategy: 'testId', value: 'order-search-results' },
        { strategy: 'role', role: 'table' },
      ],
    },
  },
];

export function createDefaultUiRegistry(): UiRegistry {
  const registry = new UiRegistry();
  for (const definition of orderListDefinitions) registry.register(definition);
  return registry;
}
