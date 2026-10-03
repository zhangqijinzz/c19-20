import { describe, expect, it } from 'vitest';
import { analyzeLayout, findBoundsIssues, findBusinessMatches, findNarrowChannels, findOverlaps, normalizeDocument, normalizeElement, summarizeBooths } from '../src/domain';
import type { ExpoElement, LayoutDocument } from '../src/types';

const item = (id: string, x: number, y: number, width = 4, height = 3): ExpoElement => ({ id, kind: 'booth', name: id, x, y, width, height, rotation: 0 });

describe('layout domain rules', () => {
  it('detects overlap area between two elements', () => {
    expect(findOverlaps([item('a', 1, 1), item('b', 3, 2)])).toEqual([{ firstId: 'a', secondId: 'b', amount: 4 }]);
  });

  it('detects field overflow and rotated bounds', () => {
    const rotated = { ...item('rotated', 8, 2, 2, 5), rotation: 90 };
    expect(findBoundsIssues({ width: 10, height: 10 }, [rotated])).toEqual([{ elementId: 'rotated', overflow: 3 }]);
  });

  it('flags a pass narrower than the minimum channel', () => {
    expect(findNarrowChannels([item('a', 1, 1), item('b', 5.5, 1)])).toEqual([{ firstId: 'a', secondId: 'b', gap: 0.5 }]);
  });

  it('returns a path when entrance and focus area exist', () => {
    const analysis = analyzeLayout({ version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ ...item('entry', 1, 5, 2, 1), kind: 'entrance' }, { ...item('stage', 10, 2, 5, 3), kind: 'stage' }] });
    expect(analysis.path?.points).toHaveLength(3);
    expect(analysis.path?.distance).toBeGreaterThan(0);
  });
});

describe('booth business fields', () => {
  it('normalizes legacy elements with default business fields without dropping data', () => {
    const legacy = item('old', 1, 1);
    const normalized = normalizeElement({ ...legacy, powerLoad: 'bad' as unknown as number });
    expect(normalized).toMatchObject({ id: 'old', name: 'old', exhibitor: '', boothNumber: '', contact: '', powerLoad: null });
    const filled = normalizeElement({ ...legacy, exhibitor: '展商甲', boothNumber: 'A-9', contact: '王五', powerLoad: 7 });
    expect(filled).toMatchObject({ exhibitor: '展商甲', boothNumber: 'A-9', contact: '王五', powerLoad: 7 });
    const withExtra = normalizeElement({ ...legacy, customTag: 'keep' } as ExpoElement & { customTag: string });
    expect((withExtra as { customTag?: string }).customTag).toBe('keep');
  });

  it('normalizes every element of a legacy document', () => {
    const legacy: LayoutDocument = { version: 1, title: '旧布局', field: { width: 20, height: 12 }, elements: [item('a', 0, 0), item('b', 6, 0)] };
    const normalized = normalizeDocument(legacy);
    expect(normalized.elements).toHaveLength(2);
    expect(normalized.elements.every((element) => element.exhibitor === '' && element.powerLoad === null)).toBe(true);
  });

  it('matches elements by booth number or exhibitor, ignoring case and surrounding spaces', () => {
    const elements = [
      { ...item('a', 0, 0), boothNumber: 'A-01', exhibitor: '栀野花艺' },
      { ...item('b', 5, 0), boothNumber: 'B-12', exhibitor: '山下手作' },
    ];
    expect(findBusinessMatches(elements, 'a-01')).toEqual(['a']);
    expect(findBusinessMatches(elements, ' 山下 ')).toEqual(['b']);
    expect(findBusinessMatches(elements, '')).toEqual([]);
    expect(findBusinessMatches(elements, 'zzz')).toEqual([]);
  });

  it('summarizes booths with missing info and high load flags, sorted by booth number', () => {
    const elements = [
      { ...item('full', 0, 0), boothNumber: 'A-01', exhibitor: '展商甲', contact: '张三', powerLoad: 3 },
      { ...item('sparse', 5, 0) },
      { ...item('heavy', 10, 0), boothNumber: 'A-03', exhibitor: '展商乙', contact: '李四', powerLoad: 15 },
      { ...item('stage', 15, 0), kind: 'stage' as const },
    ];
    const all = summarizeBooths(elements, { keyword: '', minPowerLoad: null, onlyMissingInfo: false });
    expect(all.map((booth) => booth.id)).toEqual(['full', 'heavy', 'sparse']);
    expect(all.find((booth) => booth.id === 'sparse')?.missingFields).toEqual(['编号', '展商', '联系人', '负荷']);
    expect(all.find((booth) => booth.id === 'heavy')?.highLoad).toBe(true);
    expect(all.find((booth) => booth.id === 'full')?.missingFields).toEqual([]);
  });

  it('filters booths by keyword, power threshold and missing info', () => {
    const elements = [
      { ...item('full', 0, 0), boothNumber: 'A-01', exhibitor: '展商甲', contact: '张三', powerLoad: 3 },
      { ...item('sparse', 5, 0) },
      { ...item('heavy', 10, 0), boothNumber: 'A-03', exhibitor: '展商乙', contact: '李四', powerLoad: 15 },
    ];
    expect(summarizeBooths(elements, { keyword: '', minPowerLoad: 10, onlyMissingInfo: false }).map((booth) => booth.id)).toEqual(['heavy']);
    expect(summarizeBooths(elements, { keyword: '', minPowerLoad: null, onlyMissingInfo: true }).map((booth) => booth.id)).toEqual(['sparse']);
    expect(summarizeBooths(elements, { keyword: 'a-03', minPowerLoad: null, onlyMissingInfo: false }).map((booth) => booth.id)).toEqual(['heavy']);
    expect(summarizeBooths(elements, { keyword: '展商乙', minPowerLoad: 10, onlyMissingInfo: false }).map((booth) => booth.id)).toEqual(['heavy']);
    expect(summarizeBooths(elements, { keyword: '展商甲', minPowerLoad: 10, onlyMissingInfo: false })).toEqual([]);
  });
});
