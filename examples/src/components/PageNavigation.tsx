interface PageNavigationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function PageNavigation({ currentPage, pageCount, onPageChange }: PageNavigationProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= pageCount) {
      onPageChange(value);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
      >
        ←
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="number"
          className="input"
          value={currentPage}
          onChange={handleInputChange}
          min={1}
          max={pageCount}
          style={{ width: 60, padding: "4px 8px", textAlign: "center" }}
        />
        <span style={{ color: "var(--text-secondary)" }}>/ {pageCount}</span>
      </div>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage >= pageCount}
      >
        →
      </button>
    </div>
  );
}
