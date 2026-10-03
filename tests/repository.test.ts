import { describe, expect, it } from 'vitest';
import { createBoothProfile, createStarterDocument } from '../src/domain';
import { LocalLayoutRepository } from '../src/repository';
import { BrowserStorageService } from '../src/storageService';

const saveRaw = (value: unknown) => window.localStorage.setItem('exposketch.document.v1', JSON.stringify(value));

describe('LocalLayoutRepository', () => {
  it('falls back to the starter document when persisted JSON is damaged', async () => {
    window.localStorage.setItem('exposketch.document.v1', '{broken-json');
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    expect(await repository.load()).toEqual(createStarterDocument());
    window.localStorage.clear();
  });

  it('opens legacy documents without booth fields and fills defaults', async () => {
    const legacy = createStarterDocument();
    const stripped = { ...legacy, elements: legacy.elements.map((element) => { const clone = { ...element }; delete clone.booth; return clone; }) };
    saveRaw(stripped);
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    expect(loaded.elements).toHaveLength(legacy.elements.length);
    for (const element of loaded.elements) {
      if (element.kind === 'booth') expect(element.booth).toEqual(createBoothProfile());
      else expect(element.booth).toBeUndefined();
    }
    window.localStorage.clear();
  });

  it('keeps stored booth values instead of clearing them when other fields are empty', async () => {
    const document = createStarterDocument();
    const target = document.elements.find((element) => element.id === 'booth-1');
    if (target?.booth) {
      target.booth.contact = '';
      target.booth.powerLoad = null;
    }
    saveRaw(document);
    const repository = new LocalLayoutRepository(new BrowserStorageService());
    const loaded = await repository.load();
    const booth = loaded.elements.find((element) => element.id === 'booth-1')?.booth;
    expect(booth?.exhibitor).toBe('屿山香氛工作室');
    expect(booth?.boothNumber).toBe('A-01');
    expect(booth?.contact).toBe('');
    expect(booth?.powerLoad).toBeNull();
    window.localStorage.clear();
  });
});
