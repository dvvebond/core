interface ZoomControlsProps {
  scale: number;
  minScale?: number;
  maxScale?: number;
  onScaleChange: (scale: number) => void;
}

export function ZoomControls({
  scale,
  minScale = 0.25,
  maxScale = 4,
  onScaleChange,
}: ZoomControlsProps) {
  const handleZoomOut = () => {
    const newScale = Math.max(minScale, scale / 1.25);
    onScaleChange(newScale);
  };

  const handleZoomIn = () => {
    const newScale = Math.min(maxScale, scale * 1.25);
    onScaleChange(newScale);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      onScaleChange(value);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleZoomOut}
        disabled={scale <= minScale}
      >
        -
      </button>
      <select
        className="input"
        value={scale}
        onChange={handleSelectChange}
        style={{ width: 100, padding: "4px 8px" }}
      >
        <option value={0.25}>25%</option>
        <option value={0.5}>50%</option>
        <option value={0.75}>75%</option>
        <option value={1}>100%</option>
        <option value={1.25}>125%</option>
        <option value={1.5}>150%</option>
        <option value={2}>200%</option>
        <option value={3}>300%</option>
        <option value={4}>400%</option>
      </select>
      <button
        className="btn btn-secondary btn-sm"
        onClick={handleZoomIn}
        disabled={scale >= maxScale}
      >
        +
      </button>
    </div>
  );
}
