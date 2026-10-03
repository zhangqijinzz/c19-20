import { useState } from 'react';
import { summarizeBooths } from '../../domain';
import type { ExpoElement } from '../../types';

interface BoothSummaryPanelProps {
  elements: ExpoElement[];
  onSelect: (id: string) => void;
}

export function BoothSummaryPanel({ elements, onSelect }: BoothSummaryPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [minLoadText, setMinLoadText] = useState('');
  const [onlyMissingInfo, setOnlyMissingInfo] = useState(false);
  const parsedMinLoad = minLoadText.trim() === '' ? null : Number(minLoadText);
  const minPowerLoad = parsedMinLoad !== null && Number.isFinite(parsedMinLoad) && parsedMinLoad >= 0 ? parsedMinLoad : null;
  const booths = summarizeBooths(elements, { keyword, minPowerLoad, onlyMissingInfo });
  const totalBooths = elements.filter((element) => element.kind === 'booth').length;

  return <section className="booth-summary">
    <div className="analysis-title"><span className="analysis-pulse" /><div><span className="section-kicker">BOOTH SUMMARY</span><strong>展位汇总 · 重点关注筛选</strong></div></div>
    <div className="booth-filters">
      <input aria-label="按编号或展商筛选" placeholder="编号 / 展商" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      <input aria-label="最低用电负荷" type="number" min="0" step="0.5" placeholder="负荷 ≥ kW" value={minLoadText} onChange={(event) => setMinLoadText(event.target.value)} />
      <label className="booth-filter-check"><input type="checkbox" checked={onlyMissingInfo} onChange={(event) => setOnlyMissingInfo(event.target.checked)} />仅看资料不全</label>
      <span className="booth-count">{booths.length} / {totalBooths} 展位</span>
    </div>
    <div className="booth-list">
      {booths.length ? booths.map((booth) => <button key={booth.id} type="button" className="booth-row" onClick={() => onSelect(booth.id)} title={`${booth.boothNumber || '未编号'} · ${booth.exhibitor || '未登记展商'}`}>
        <strong className="booth-cell">{booth.boothNumber || '未编号'}</strong>
        <span className="booth-cell booth-exhibitor">{booth.exhibitor || '未登记展商'}</span>
        <span className="booth-cell">{booth.powerLoad !== null ? `${booth.powerLoad} kW` : '—'}</span>
        <span className="booth-cell">{booth.contact || '—'}</span>
        <span className="booth-tags">{booth.highLoad ? <b className="booth-tag load">高负荷</b> : null}{booth.missingFields.length ? <b className="booth-tag missing">缺{booth.missingFields.join('、')}</b> : null}</span>
      </button>) : <p className="booth-empty">{totalBooths ? '没有符合条件的展位，调整筛选条件试试' : '场地中还没有展位'}</p>}
    </div>
  </section>;
}
