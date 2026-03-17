import { useState, useEffect, useCallback, useRef } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
}

export function MetricCard({ label, value, unit, trend }: MetricCardProps) {
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : undefined;

  return (
    <div className="metric-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color: trendColor }}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

interface MetricsPanelProps {
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: "up" | "down" | "stable";
  }>;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <div className="metrics-panel">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}

interface PerformanceMetrics {
  renderTime: number;
  frameRate: number;
  memoryUsage: number | null;
  pageLoadTime: number;
}

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    frameRate: 0,
    memoryUsage: null,
    pageLoadTime: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number>();

  const measureFrameRate = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    frameTimesRef.current.push(delta);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    const avgFrameTime =
      frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const fps = Math.round(1000 / avgFrameTime);

    setMetrics(prev => ({ ...prev, frameRate: fps }));

    animationFrameRef.current = requestAnimationFrame(measureFrameRate);
  }, []);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(measureFrameRate);

    // Measure memory if available
    const memoryInterval = setInterval(() => {
      if ("memory" in performance) {
        const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        }));
      }
    }, 1000);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(memoryInterval);
    };
  }, [measureFrameRate]);

  const startRenderTimer = useCallback(() => {
    return performance.now();
  }, []);

  const endRenderTimer = useCallback((startTime: number) => {
    const renderTime = performance.now() - startTime;
    setMetrics(prev => ({ ...prev, renderTime: Math.round(renderTime * 100) / 100 }));
    return renderTime;
  }, []);

  const recordPageLoad = useCallback((loadTime: number) => {
    setMetrics(prev => ({ ...prev, pageLoadTime: Math.round(loadTime * 100) / 100 }));
  }, []);

  return {
    metrics,
    startRenderTimer,
    endRenderTimer,
    recordPageLoad,
  };
}

interface CoordinateDisplayProps {
  screenX: number;
  screenY: number;
  pdfX?: number;
  pdfY?: number;
  page?: number;
  scale?: number;
  rotation?: number;
}

export function CoordinateDisplay({
  screenX,
  screenY,
  pdfX,
  pdfY,
  page,
  scale,
  rotation,
}: CoordinateDisplayProps) {
  return (
    <div className="coordinate-display">
      <div>
        <span className="coord-label">Screen:</span>
        <span className="coord-value">
          ({screenX.toFixed(0)}, {screenY.toFixed(0)})
        </span>
      </div>
      {pdfX !== undefined && pdfY !== undefined && (
        <div>
          <span className="coord-label">PDF:</span>
          <span className="coord-value">
            ({pdfX.toFixed(2)}, {pdfY.toFixed(2)})
          </span>
        </div>
      )}
      {page !== undefined && (
        <div>
          <span className="coord-label">Page:</span>
          <span className="coord-value">{page}</span>
        </div>
      )}
      {scale !== undefined && (
        <div>
          <span className="coord-label">Scale:</span>
          <span className="coord-value">{(scale * 100).toFixed(0)}%</span>
        </div>
      )}
      {rotation !== undefined && (
        <div>
          <span className="coord-label">Rotation:</span>
          <span className="coord-value">{rotation}°</span>
        </div>
      )}
    </div>
  );
}

interface TimingInfo {
  label: string;
  duration: number;
}

interface TimingDisplayProps {
  timings: TimingInfo[];
}

export function TimingDisplay({ timings }: TimingDisplayProps) {
  const total = timings.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Performance Timings</h3>
        <span className="badge badge-info">{total.toFixed(2)}ms total</span>
      </div>
      <div className="card-body">
        <table className="table">
          <thead>
            <tr>
              <th>Operation</th>
              <th style={{ textAlign: "right" }}>Duration</th>
              <th style={{ textAlign: "right" }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {timings.map((timing, index) => (
              <tr key={index}>
                <td>{timing.label}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                  {timing.duration.toFixed(2)}ms
                </td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                  {((timing.duration / total) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
