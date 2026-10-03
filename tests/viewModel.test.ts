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

  it('updates business fields on the selected booth and keeps empty values', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    vm.selectElement('booth-1');
    vm.updateSelectedBusiness({ exhibitor: '新展商', boothNumber: 'B-07', powerLoad: 6.5, contact: '张三' });
    expect(vm.state.document.elements.find((element) => element.id === 'booth-1')).toMatchObject({ exhibitor: '新展商', boothNumber: 'B-07', powerLoad: 6.5, contact: '张三' });
    vm.updateSelectedBusiness({ contact: '', powerLoad: null });
    const booth = vm.state.document.elements.find((element) => element.id === 'booth-1');
    expect(booth?.contact).toBe('');
    expect(booth?.powerLoad).toBeNull();
    expect(booth?.exhibitor).toBe('新展商');
  });

  it('rejects invalid power load values', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    vm.selectElement('booth-1');
    vm.updateSelectedBusiness({ powerLoad: -3 });
    expect(vm.state.document.elements.find((element) => element.id === 'booth-1')?.powerLoad).toBe(3.5);
    vm.updateSelectedBusiness({ powerLoad: Number.NaN });
    expect(vm.state.document.elements.find((element) => element.id === 'booth-1')?.powerLoad).toBe(3.5);
  });

  it('highlights booths matching the search query and selects the first match', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    vm.setSearchQuery('A-02');
    expect(vm.state.searchMatches).toEqual(['booth-2']);
    expect(vm.state.selectedId).toBe('booth-2');
    vm.setSearchQuery('栀野');
    expect(vm.state.searchMatches).toEqual(['booth-1']);
    expect(vm.state.selectedId).toBe('booth-1');
    vm.setSearchQuery('不存在的展商');
    expect(vm.state.searchMatches).toEqual([]);
    expect(vm.state.selectedId).toBe('booth-1');
    expect(vm.state.notice.tone).toBe('warning');
    vm.setSearchQuery('');
    expect(vm.state.searchMatches).toEqual([]);
  });

  it('keeps search highlights in sync when business fields change', async () => {
    const vm = new ExpoSketchViewModel(fakeRepository());
    await vm.initialize();
    vm.setSearchQuery('C-99');
    expect(vm.state.searchMatches).toEqual([]);
    vm.selectElement('booth-1');
    vm.updateSelectedBusiness({ boothNumber: 'C-99' });
    expect(vm.state.searchMatches).toEqual(['booth-1']);
  });
});
