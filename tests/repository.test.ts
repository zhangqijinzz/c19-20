import { describe, expect, it } from 'vitest';
import { createStarterDocument } from '../src/domain';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

describe('LocalLayoutRepository', () => {
  it('falls back to the starter document when persisted JSON is damaged', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    expect(await repository.load()).toEqual(createStarterDocument());
    window.localStorage.clear();
  });

  it('opens legacy layouts without business fields using defaults', async () => {
    const legacy = { version: 1, title: '旧布局', field: { width: 20, height: 12 }, elements: [{ id: 'booth-1', kind: 'booth', name: '旧展位', x: 1, y: 1, width: 4, height: 3, rotation: 0 }] };
    window.localStorage.setItem('exposketch.document.v1', JSON.stringify(legacy));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    expect(loaded.title).toBe('旧布局');
    expect(loaded.elements[0]).toMatchObject({ id: 'booth-1', name: '旧展位', exhibitor: '', boothNumber: '', contact: '', powerLoad: null });
    window.localStorage.clear();
  });

  it('coerces invalid business values instead of rejecting the whole document', async () => {
    const damaged = { version: 1, title: 'x', field: { width: 20, height: 12 }, elements: [{ id: 'b1', kind: 'booth', name: 'n', x: 0, y: 0, width: 2, height: 2, rotation: 0, powerLoad: 'high', exhibitor: 42 }] };
    window.localStorage.setItem('exposketch.document.v1', JSON.stringify(damaged));
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    expect(loaded.elements[0].powerLoad).toBeNull();
    expect(loaded.elements[0].exhibitor).toBe('');
    window.localStorage.clear();
  });

  it('keeps filled and empty business fields through a save/load roundtrip', async () => {
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const document = createStarterDocument();
    document.elements[2] = { ...document.elements[2], exhibitor: '一个名字特别特别长的展商公司', contact: '', boothNumber: '' };
    await repository.save(document);
    const loaded = await repository.load();
    expect(loaded.elements[2].exhibitor).toBe('一个名字特别特别长的展商公司');
    expect(loaded.elements[2].contact).toBe('');
    expect(loaded.elements[2].boothNumber).toBe('');
    expect(loaded.elements[2].name).toBe(document.elements[2].name);
    expect(loaded.elements).toHaveLength(document.elements.length);
    window.localStorage.clear();
  });
});
