import type { BoothBusinessPatch, RenderElement } from '../../types';

interface InspectorPanelProps {
  selectedElement: RenderElement | null;
  onRename: (name: string) => void;
  onResize: (width: number, height: number) => void;
  onRotate: () => void;
  onDelete: () => void;
  onBusinessChange: (patch: BoothBusinessPatch) => void;
}

export function InspectorPanel({ selectedElement, onRename, onResize, onRotate, onDelete, onBusinessChange }: InspectorPanelProps) {
  return <section className="panel inspector-panel">
    <div className="panel-heading"><div><span className="section-kicker">SELECTION</span><h2>属性面板</h2></div><span className="selection-indicator" /></div>
    {selectedElement ? <SelectedFields element={selectedElement} onRename={onRename} onResize={onResize} onRotate={onRotate} onDelete={onDelete} onBusinessChange={onBusinessChange} /> : <div className="empty-inspector"><span>⌁</span><p>点击场地中的元素<br />开始调整布局</p></div>}
  </section>;
}

interface SelectedFieldsProps { element: RenderElement; onRename: (name: string) => void; onResize: (width: number, height: number) => void; onRotate: () => void; onDelete: () => void; onBusinessChange: (patch: BoothBusinessPatch) => void; }

function SelectedFields({ element, onRename, onResize, onRotate, onDelete, onBusinessChange }: SelectedFieldsProps) {
  return <div className="selected-fields">
    <div className="selected-kind"><span className="selected-symbol">{element.kind === 'stage' ? '✦' : element.kind === 'entrance' ? '↗' : element.kind === 'seating' ? '▤' : '▦'}</span><div><strong>{element.kind.toUpperCase()}</strong><small>ID · {element.id.slice(0, 12)}</small></div></div>
    <label className="field-label-input">名称<input aria-label="元素名称" value={element.name} onChange={(event) => onRename(event.target.value)} /></label>
    <div className="dimension-grid"><label>宽度<input aria-label="元素宽度" type="number" min="1" step="0.5" value={element.width} onChange={(event) => onResize(Number(event.target.value), element.height)} /></label><label>深度<input aria-label="元素深度" type="number" min="1" step="0.5" value={element.height} onChange={(event) => onResize(element.width, Number(event.target.value))} /></label></div>
    {element.kind === 'booth' ? <BusinessFields element={element} onBusinessChange={onBusinessChange} /> : null}
    <div className="transform-readout"><span>位置 <strong>{element.x.toFixed(1)}, {element.y.toFixed(1)}</strong></span><span>旋转 <strong>{element.rotation}°</strong></span><span>占地 <strong>{element.occupiedArea.toFixed(1)} m²</strong></span></div>
    <div className="inspector-actions"><button type="button" className="secondary-button" onClick={onRotate}>↻ 旋转 90°</button><button type="button" className="icon-button danger" aria-label="删除元素" onClick={onDelete}>⌫</button></div>
  </div>;
}

interface BusinessFieldsProps { element: RenderElement; onBusinessChange: (patch: BoothBusinessPatch) => void; }

function BusinessFields({ element, onBusinessChange }: BusinessFieldsProps) {
  const commitPowerLoad = (raw: string, input: HTMLInputElement) => {
    const text = raw.trim();
    if (text === '') { onBusinessChange({ powerLoad: null }); return; }
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0) { input.value = element.powerLoad?.toString() ?? ''; return; }
    onBusinessChange({ powerLoad: parsed });
  };
  return <div className="business-fields">
    <span className="section-kicker">BOOTH INFO</span>
    <label>展商名称<input aria-label="展商名称" value={element.exhibitor ?? ''} placeholder="未登记展商" onChange={(event) => onBusinessChange({ exhibitor: event.target.value })} /></label>
    <label>展位编号<input aria-label="展位编号" value={element.boothNumber ?? ''} placeholder="如 A-01" onChange={(event) => onBusinessChange({ boothNumber: event.target.value })} /></label>
    <label>用电负荷 (kW)<input aria-label="用电负荷" type="number" min="0" step="0.5" placeholder="未登记" defaultValue={element.powerLoad ?? ''} key={`power-${element.id}`} onBlur={(event) => commitPowerLoad(event.target.value, event.currentTarget)} /></label>
    <label>现场联系人<input aria-label="现场联系人" value={element.contact ?? ''} placeholder="未登记联系人" onChange={(event) => onBusinessChange({ contact: event.target.value })} /></label>
  </div>;
}
