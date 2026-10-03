import { describe, expect, it, vi } from 'vitest';
import { createStarterDocument } from '../src/domain';
import type { LayoutRepository } from '../src/repository';
import type { LayoutDocument } from '../src/types';
import { ExpoSketchViewModel } from '../src/viewModel';

const fakeRepository = (initial: LayoutDocument | null = null): LayoutRepository => ({
  load: vi.fn(async () => initial ?? createStarterDocument()),
  save: vi.fn(async (_document) => {}),
});

describe('ExpoSketchViewModel', () => {
  it('initializes and updates the selected layout', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('ready');
    const count = vm.state.document.elements.length;
    vm.addElement('booth');
    expect(vm.state.document.elements).toHaveLength(count + 1);
    expect(vm.state.selectedId).toContain('booth-');
  });

  it('updates analysis immediately after moving an element into an overlap', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.moveElement('stage-1', 4.5, 2.5);
    expect(vm.state.analysis.overlaps.length).toBeGreaterThan(0);
  });

  it('recovers the example if repository loading fails', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => { throw new Error('bad storage'); }), save: vi.fn(async () => {}) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    expect(vm.state.phase).toBe('error');
    expect(vm.state.document.title).toContain('春日创意市集');
  });

  it('shows a save error without dropping the working document', async () => {
    const repository: LayoutRepository = { load: vi.fn(async () => createStarterDocument()), save: vi.fn(async () => { throw new Error('quota'); }) };
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.addElement('stage');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.state.document.elements.some((element) => element.kind === 'stage' && element.id.startsWith('stage-'))).toBe(true);
    expect(vm.state.notice.tone).toBe('error');
  });

  it('ignores invalid dimensions instead of corrupting the working selection', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    const before = vm.state.document.elements[0].width;
    vm.resizeSelected(0, 0);
    expect(vm.state.document.elements[0].width).toBe(before);
  });
});

describe('booth business fields', () => {
  const boothOf = (vm: ExpoSketchViewModel, id: string) => vm.state.document.elements.find((element) => element.id === id)?.booth;

  it('updates business fields on the selected booth and persists them', async () => {
    const repository = fakeRepository();
    const vm = new ExpoSketchViewModel(repository);
    await vm.initialize();
    vm.selectElement('booth-2');
    vm.updateSelectedBooth({ exhibitor: '木作实验室', boothNumber: 'B-12', powerLoad: 6.5, contact: '陈工' });
    expect(boothOf(vm, 'booth-2')).toEqual({ exhibitor: '木作实验室', boothNumber: 'B-12', powerLoad: 6.5, contact: '陈工' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const calls = (repository.save as ReturnType<typeof vi.fn>).mock.calls;
    const saved = calls[calls.length - 1][0] as LayoutDocument;
    expect(saved.elements.find((element) => element.id === 'booth-2')?.booth?.exhibitor).toBe('木作实验室');
  });

  it('keeps sibling fields when only one field is edited', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    vm.updateSelectedBooth({ contact: '' });
    const booth = boothOf(vm, 'booth-1');
    expect(booth?.exhibitor).toBe('屿山香氛工作室');
    expect(booth?.contact).toBe('');
  });

  it('rejects invalid power loads without clearing the stored value', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('booth-1');
    vm.updateSelectedBooth({ powerLoad: Number('abc') });
    expect(boothOf(vm, 'booth-1')?.powerLoad).toBe(3.5);
    vm.updateSelectedBooth({ powerLoad: -4 });
    expect(boothOf(vm, 'booth-1')?.powerLoad).toBe(3.5);
    vm.updateSelectedBooth({ powerLoad: null });
    expect(boothOf(vm, 'booth-1')?.powerLoad).toBeNull();
  });

  it('ignores booth updates for non-booth elements', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.selectElement('stage-1');
    vm.updateSelectedBooth({ exhibitor: '不应生效' });
    expect(vm.state.document.elements.find((element) => element.id === 'stage-1')?.booth).toBeUndefined();
  });

  it('edits legacy elements that have no stored profile yet', async () => {
    const initial = createStarterDocument();
    const stripped = { ...initial, elements: initial.elements.map((element) => { const clone = { ...element }; delete clone.booth; return clone; }) };
    const vm = new ExpoSketchViewModel(fakeRepository(stripped));
    await vm.initialize();
    vm.selectElement('booth-1');
    vm.updateSelectedBooth({ boothNumber: 'C-08' });
    expect(boothOf(vm, 'booth-1')).toEqual({ exhibitor: '', boothNumber: 'C-08', powerLoad: null, contact: '' });
  });

  it('matches booths by number or exhibitor for canvas highlight', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    vm.setBoothQuery('a-01');
    expect(vm.state.matchedBoothIds).toEqual(['booth-1']);
    vm.setBoothQuery('拾光');
    expect(vm.state.matchedBoothIds).toEqual(['booth-2']);
    vm.setBoothQuery('');
    expect(vm.state.matchedBoothIds).toEqual([]);
  });

  it('summarizes booths and filters by query and attention flag', () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    expect(vm.state.boothDigest.total).toBe(2);
    expect(vm.state.boothDigest.totalPowerLoad).toBe(3.5);
    expect(vm.state.boothDigest.attentionCount).toBe(1);
    vm.setAttentionOnly(true);
    expect(vm.state.boothDigest.entries.map((entry) => entry.id)).toEqual(['booth-2']);
    vm.setAttentionOnly(false);
    vm.setBoothQuery('A-02');
    expect(vm.state.boothDigest.entries.map((entry) => entry.id)).toEqual(['booth-2']);
    expect(vm.state.boothDigest.total).toBe(2);
  });
});
