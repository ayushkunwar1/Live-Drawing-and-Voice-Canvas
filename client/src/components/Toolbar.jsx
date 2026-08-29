const COLORS = ['#0f172a', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#16a34a', '#ca8a04'];
const TOOLS = [
  ['pen', 'Pen'],
  ['rect', 'Rectangle'],
  ['circle', 'Circle'],
  ['text', 'Text'],
];

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  onClear,
  onExport,
  voiceEnabled,
  onToggleVoice,
  status,
  memberCount,
}) {
  return (
    <div className="toolbar">
      <div className="brand-block">
        <div className="brand-mark">✦</div>
        <div>
          <div className="brand-title">Live Canvas</div>
          <div className="brand-subtitle">Room workspace</div>
        </div>
      </div>

      <div className="toolbar-group tool-group">
        {TOOLS.map(([value, label]) => (
          <button
            key={value}
            className={`tool-button ${tool === value ? 'active' : ''}`}
            onClick={() => setTool(value)}
            title={label}
          >
            {value === 'pen' ? '✎' : value === 'rect' ? '▢' : value === 'circle' ? '○' : 'T'}
          </button>
        ))}
      </div>

      <div className="toolbar-group colors">
        <span className="toolbar-label">Color</span>
        {COLORS.map((item) => (
          <button
            key={item}
            aria-label={`Use color ${item}`}
            className={`color-swatch ${color === item ? 'active' : ''}`}
            style={{ backgroundColor: item }}
            onClick={() => setColor(item)}
          />
        ))}
      </div>

      <div className="toolbar-group size-control">
        <span className="toolbar-label">Brush</span>
        <input type="range" min="1" max="20" value={size} onChange={(event) => setSize(Number(event.target.value))} />
        <span className="size-value">{size}px</span>
      </div>

      <div className="toolbar-spacer" />

      <div className="presence-pill" title={status}>
        <span className={`status-dot ${status === 'connected' ? 'online' : ''}`} />
        {memberCount} {memberCount === 1 ? 'person' : 'people'}
      </div>

      <button className={`voice-button ${voiceEnabled ? 'enabled' : ''}`} onClick={onToggleVoice}>
        {voiceEnabled ? '🎙️ Voice on' : '🎙️ Join voice'}
      </button>
      <button className="secondary-button" onClick={onClear}>Clear</button>
      <button className="export-button" onClick={onExport}>Export ▾</button>
    </div>
  );
}
