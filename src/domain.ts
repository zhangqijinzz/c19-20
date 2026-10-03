import type {
  Analysis,
  BoothFilter,
  BoothSummaryItem,
  BoundsIssue,
  ChannelIssue,
  ElementKind,
  ElementSpec,
  ExpoElement,
  FieldSize,
  LayoutDocument,
  PathPreview,
  OverlapIssue,
} from './types';

export const MIN_CHANNEL = 1.2;
export const HIGH_POWER_LOAD_KW = 10;

export const ELEMENT_SPECS: Record<ElementKind, ElementSpec> = {
  booth: { kind: 'booth', label: '标准展位', eyebrow: 'BOOTH', icon: '▦', color: '#e7f0ff', width: 5, height: 3.5 },
  stage: { kind: 'stage', label: '主舞台', eyebrow: 'STAGE', icon: '✦', color: '#f2e9ff', width: 8, height: 4 },
  seating: { kind: 'seating', label: '观众座席', eyebrow: 'SEATING', icon: '▤', color: '#e6f7f2', width: 6, height: 3 },
  entrance: { kind: 'entrance', label: '入口', eyebrow: 'ENTRY', icon: '↗', color: '#fff2d8', width: 2.5, height: 1.5 },
};

export const createStarterDocument = (): LayoutDocument => ({
  version: 1,
  title: '春日创意市集 · A 区',
  field: { width: 28, height: 18 },
  elements: [
    { id: 'entry-1', kind: 'entrance', name: '主入口', x: 1, y: 8.25, width: 2.5, height: 1.5, rotation: 0 },
    { id: 'stage-1', kind: 'stage', name: '分享舞台', x: 10, y: 1.5, width: 8, height: 4, rotation: 0 },
    { id: 'booth-1', kind: 'booth', name: '香氛展位', x: 4, y: 2, width: 5, height: 3.5, rotation: 0, exhibitor: '栀野花艺工作室', boothNumber: 'A-01', powerLoad: 3.5, contact: '林小满 138-2210-****' },
    { id: 'booth-2', kind: 'booth', name: '手作展位', x: 19, y: 2, width: 5, height: 3.5, rotation: 0, exhibitor: '山下手作', boothNumber: 'A-02', powerLoad: 12, contact: '周野 139-8871-****' },
    { id: 'seating-1', kind: 'seating', name: '休息座席', x: 10, y: 11, width: 6, height: 3, rotation: 0 },
  ],
});

export const createElement = (kind: ElementKind, index: number, field: FieldSize): ExpoElement => {
  const spec = ELEMENT_SPECS[kind];
  const offset = Math.min(index * 0.65, 4);
  return {
    id: `${kind}-${Date.now()}-${index}`,
    kind,
    name: `${spec.label} ${index + 1}`,
    x: Math.max(0.5, Math.min(field.width - spec.width - 0.5, (field.width - spec.width) / 2 + offset)),
    y: Math.max(0.5, Math.min(field.height - spec.height - 0.5, (field.height - spec.height) / 2 + offset)),
    width: spec.width,
    height: spec.height,
    rotation: 0,
    ...(kind === 'booth' ? { exhibitor: '', boothNumber: '', powerLoad: null, contact: '' } : {}),
  };
};

export const normalizeRotation = (rotation: number): number => ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;

export const getBoundingBox = (element: ExpoElement) => {
  const isQuarterTurn = normalizeRotation(element.rotation) % 180 !== 0;
  const width = isQuarterTurn ? element.height : element.width;
  const height = isQuarterTurn ? element.width : element.height;
  return { left: element.x, top: element.y, right: element.x + width, bottom: element.y + height, width, height };
};

const intersectionSize = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

export const findOverlaps = (elements: ExpoElement[]): OverlapIssue[] => {
  const issues: OverlapIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const overlapX = intersectionSize(first.left, first.right, second.left, second.right);
      const overlapY = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      if (overlapX > 0 && overlapY > 0) {
        issues.push({ firstId: elements[i].id, secondId: elements[j].id, amount: Number((overlapX * overlapY).toFixed(1)) });
      }
    }
  }
  return issues;
};

export const findBoundsIssues = (field: FieldSize, elements: ExpoElement[]): BoundsIssue[] =>
  elements.flatMap((element) => {
    const box = getBoundingBox(element);
    const overflow = Math.max(0, -box.left, -box.top, box.right - field.width, box.bottom - field.height);
    return overflow > 0 ? [{ elementId: element.id, overflow: Number(overflow.toFixed(1)) }] : [];
  });

export const findNarrowChannels = (elements: ExpoElement[]): ChannelIssue[] => {
  const issues: ChannelIssue[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const first = getBoundingBox(elements[i]);
    for (let j = i + 1; j < elements.length; j += 1) {
      const second = getBoundingBox(elements[j]);
      const verticalOverlap = intersectionSize(first.top, first.bottom, second.top, second.bottom);
      const horizontalOverlap = intersectionSize(first.left, first.right, second.left, second.right);
      const horizontalGap = first.right <= second.left ? second.left - first.right : second.right <= first.left ? first.left - second.right : 0;
      const verticalGap = first.bottom <= second.top ? second.top - first.bottom : second.bottom <= first.top ? first.top - second.bottom : 0;
      const gap = verticalOverlap > 0 ? horizontalGap : horizontalOverlap > 0 ? verticalGap : 0;
      if (gap > 0 && gap < MIN_CHANNEL) issues.push({ firstId: elements[i].id, secondId: elements[j].id, gap: Number(gap.toFixed(1)) });
    }
  }
  return issues;
};

const distance = (first: { x: number; y: number }, second: { x: number; y: number }) => Math.hypot(second.x - first.x, second.y - first.y);

export const createPathPreview = (elements: ExpoElement[]): PathPreview | null => {
  const entrance = elements.find((element) => element.kind === 'entrance');
  const target = elements.find((element) => element.kind === 'stage') ?? elements.find((element) => element.kind !== 'entrance');
  if (!entrance || !target) return null;
  const startBox = getBoundingBox(entrance);
  const targetBox = getBoundingBox(target);
  const start = { x: startBox.left + startBox.width / 2, y: startBox.top + startBox.height / 2 };
  const end = { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 };
  const elbow = { x: end.x, y: start.y };
  return { points: [start, elbow, end], distance: Number((distance(start, elbow) + distance(elbow, end)).toFixed(1)), fromName: entrance.name, toName: target.name };
};

export const analyzeLayout = (document: LayoutDocument): Analysis => ({
  overlaps: findOverlaps(document.elements),
  bounds: findBoundsIssues(document.field, document.elements),
  channels: findNarrowChannels(document.elements),
  path: createPathPreview(document.elements),
});

export const findElement = (document: LayoutDocument, id: string | null) => document.elements.find((element) => element.id === id) ?? null;

export const formatArea = (field: FieldSize) => `${field.width} × ${field.height} m`;

const cleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const cleanPowerLoad = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export const normalizeElement = (element: ExpoElement): ExpoElement => ({
  ...element,
  exhibitor: typeof element.exhibitor === 'string' ? element.exhibitor : '',
  boothNumber: typeof element.boothNumber === 'string' ? element.boothNumber : '',
  contact: typeof element.contact === 'string' ? element.contact : '',
  powerLoad: cleanPowerLoad(element.powerLoad),
});

export const normalizeDocument = (document: LayoutDocument): LayoutDocument => ({
  ...document,
  elements: document.elements.map(normalizeElement),
});

export const matchesBusinessQuery = (element: ExpoElement, query: string): boolean => {
  const keyword = cleanText(query).toLowerCase();
  if (!keyword) return false;
  return [element.boothNumber, element.exhibitor].some((value) => cleanText(value).toLowerCase().includes(keyword));
};

export const findBusinessMatches = (elements: ExpoElement[], query: string): string[] =>
  cleanText(query) ? elements.filter((element) => matchesBusinessQuery(element, query)).map((element) => element.id) : [];

export const summarizeBooths = (elements: ExpoElement[], filter: BoothFilter): BoothSummaryItem[] => {
  const keyword = cleanText(filter.keyword).toLowerCase();
  return elements
    .filter((element) => element.kind === 'booth')
    .map((element): BoothSummaryItem => {
      const boothNumber = cleanText(element.boothNumber);
      const exhibitor = cleanText(element.exhibitor);
      const contact = cleanText(element.contact);
      const powerLoad = cleanPowerLoad(element.powerLoad);
      const missingFields = [
        boothNumber ? null : '编号',
        exhibitor ? null : '展商',
        contact ? null : '联系人',
        powerLoad === null ? '负荷' : null,
      ].filter((label): label is string => label !== null);
      return { id: element.id, name: element.name, boothNumber, exhibitor, contact, powerLoad, missingFields, highLoad: powerLoad !== null && powerLoad >= HIGH_POWER_LOAD_KW };
    })
    .filter((item) => {
      if (keyword && !item.boothNumber.toLowerCase().includes(keyword) && !item.exhibitor.toLowerCase().includes(keyword)) return false;
      if (filter.minPowerLoad !== null && (item.powerLoad === null || item.powerLoad < filter.minPowerLoad)) return false;
      if (filter.onlyMissingInfo && item.missingFields.length === 0) return false;
      return true;
    })
    .sort((first, second) => (first.boothNumber ? 0 : 1) - (second.boothNumber ? 0 : 1) || first.boothNumber.localeCompare(second.boothNumber, 'zh-CN', { numeric: true }) || first.name.localeCompare(second.name, 'zh-CN'));
};
