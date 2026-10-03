import { describe, expect, it } from 'vitest';
import { analyzeLayout, createBoothProfile, findBoundsIssues, findNarrowChannels, findOverlaps, getBoothAttentionReasons, matchesBoothQuery, normalizeBoothProfile, normalizeDocument, normalizeElement, POWER_LOAD_ALERT_KW, summarizeBooths } from '../src/domain';
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

describe('booth profile normalization', () => {
  it('returns defaults for missing or malformed profiles', () => {
    const empty = createBoothProfile();
    expect(normalizeBoothProfile(undefined)).toEqual(empty);
    expect(normalizeBoothProfile(null)).toEqual(empty);
    expect(normalizeBoothProfile('A-01')).toEqual(empty);
    expect(normalizeBoothProfile({ powerLoad: 'abc' })).toEqual(empty);
  });

  it('keeps existing values and only fills the missing ones', () => {
    expect(normalizeBoothProfile({ exhibitor: '拾光手作社', powerLoad: '6.5', extra: 'kept-out' })).toEqual({ exhibitor: '拾光手作社', boothNumber: '', powerLoad: 6.5, contact: '' });
  });

  it('adds defaults to legacy booth elements and leaves other kinds untouched', () => {
    const legacyBooth = item('b1', 1, 1);
    expect(normalizeElement(legacyBooth).booth).toEqual(createBoothProfile());
    const stage: ExpoElement = { ...item('s1', 0, 0), kind: 'stage' };
    expect(normalizeElement(stage)).toBe(stage);
  });

  it('normalizes every booth in a document without dropping other data', () => {
    const document: LayoutDocument = { version: 1, title: 't', field: { width: 20, height: 12 }, elements: [item('b1', 1, 1), { ...item('b2', 8, 1), booth: { exhibitor: '甲公司', boothNumber: 'A-01', powerLoad: 4, contact: '张三' } }] };
    const normalized = normalizeDocument(document);
    expect(normalized.elements[0].booth).toEqual(createBoothProfile());
    expect(normalized.elements[1].booth?.exhibitor).toBe('甲公司');
    expect(normalized.field).toEqual({ width: 20, height: 12 });
  });
});

describe('booth search and summary', () => {
  const profile = { exhibitor: '屿山香氛工作室', boothNumber: 'A-01', powerLoad: 3.5, contact: '林晓' };

  it('matches booth number or exhibitor case-insensitively', () => {
    expect(matchesBoothQuery(profile, 'a-01')).toBe(true);
    expect(matchesBoothQuery(profile, '香氛')).toBe(true);
    expect(matchesBoothQuery(profile, 'B-99')).toBe(false);
    expect(matchesBoothQuery(profile, '   ')).toBe(false);
  });

  it('flags booths that need attention', () => {
    expect(getBoothAttentionReasons(profile)).toEqual([]);
    expect(getBoothAttentionReasons(createBoothProfile())).toEqual(['未编号', '缺展商', '缺联系人']);
    expect(getBoothAttentionReasons({ ...profile, powerLoad: POWER_LOAD_ALERT_KW })).toEqual(['高负荷']);
  });

  const summaryDocument = (): LayoutDocument => ({
    version: 1,
    title: 't',
    field: { width: 20, height: 12 },
    elements: [
      { ...item('b1', 1, 1), booth: { exhibitor: '甲公司', boothNumber: 'A-01', powerLoad: 4, contact: '张三' } },
      item('b2', 8, 1),
      { ...item('s1', 1, 8), kind: 'stage' },
    ],
  });

  it('summarizes totals across booths only', () => {
    const digest = summarizeBooths(summaryDocument());
    expect(digest.total).toBe(2);
    expect(digest.totalPowerLoad).toBe(4);
    expect(digest.attentionCount).toBe(1);
    expect(digest.entries.map((entry) => entry.id)).toEqual(['b1', 'b2']);
  });

  it('filters summary entries by keyword and attention flag', () => {
    expect(summarizeBooths(summaryDocument(), '甲公司').entries.map((entry) => entry.id)).toEqual(['b1']);
    expect(summarizeBooths(summaryDocument(), 'a-01').entries.map((entry) => entry.id)).toEqual(['b1']);
    expect(summarizeBooths(summaryDocument(), '', true).entries.map((entry) => entry.id)).toEqual(['b2']);
    expect(summarizeBooths(summaryDocument(), '不存在').entries).toEqual([]);
  });
});
