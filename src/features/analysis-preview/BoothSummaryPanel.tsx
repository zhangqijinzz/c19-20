import type { BoothDigest } from '../../types';

interface BoothSummaryPanelProps {
  digest: BoothDigest;
  query: string;
  attentionOnly: boolean;
  selectedId: string | null;
  onClearQuery: () => void;
  onToggleAttention: (value: boolean) => void;
  onSelect: (id: string) => void;
}

export function BoothSummaryPanel({ digest, query, attentionOnly, selectedId, onClearQuery, onToggleAttention, onSelect }: BoothSummaryPanelProps) {
  const filtering = query.trim().length > 0;
  return <section className="booth-summary-panel">
    <div className="booth-summary-head">
      <div className="booth-summary-title"><span className="section-kicker">BOOTH DIRECTORY</span><strong>展位汇总</strong></div>
      <div className="booth-summary-stats">
        <span><b>{digest.total}</b>展位</span>
        <span><b>{digest.totalPowerLoad}</b>kW 总负荷</span>
        <span className={digest.attentionCount ? 'metric-warning' : ''}><b>{digest.attentionCount}</b>需关注</span>
      </div>
      <div className="booth-summary-filters">
        {filtering ? <button type="button" className="filter-chip" title="清除搜索筛选" onClick={onClearQuery}>筛选：{query.trim()} ✕</button> : null}
        <button type="button" className={attentionOnly ? 'filter-toggle active' : 'filter-toggle'} aria-pressed={attentionOnly} onClick={() => onToggleAttention(!attentionOnly)}>只看需关注</button>
      </div>
    </div>
    {digest.entries.length ? <ul className="booth-summary-list">
      {digest.entries.map((entry) => <li key={entry.id}>
        <button type="button" className={entry.id === selectedId ? 'booth-row is-selected' : 'booth-row'} title={entry.name} onClick={() => onSelect(entry.id)}>
          <span className="booth-row-code" title={entry.profile.boothNumber.trim() || '未编号'}>{entry.profile.boothNumber.trim() || '未编号'}</span>
          <span className="booth-row-exhibitor" title={entry.profile.exhibitor.trim() || '未登记展商'}>{entry.profile.exhibitor.trim() || '未登记展商'}</span>
          <span className="booth-row-meta">{entry.profile.powerLoad !== null ? `${entry.profile.powerLoad} kW` : '负荷未报'}</span>
          <span className="booth-row-meta booth-row-contact" title={entry.profile.contact.trim() || '未登记联系人'}>{entry.profile.contact.trim() || '未登记联系人'}</span>
          {entry.attentionReasons.length ? <span className="booth-row-flags">{entry.attentionReasons.map((reason) => <em key={reason}>{reason}</em>)}</span> : <span className="booth-row-ok">正常</span>}
        </button>
      </li>)}
    </ul> : <p className="booth-summary-empty">{digest.total ? '没有符合筛选条件的展位' : '暂无展位，从元素库添加标准展位'}</p>}
  </section>;
}
