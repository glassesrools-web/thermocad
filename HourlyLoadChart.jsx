import React from "react";

/**
 * HourlyLoadChart — 24-hour heat load bar chart.
 * Renders gracefully even when data is empty or missing.
 */
export default function HourlyLoadChart({ data = [], title = "24-Hour Heat Load Profile" }) {
  // Graceful empty state
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="glass-panel p-6 text-center" style={{ borderRadius: 16 }}>
        <p className="text-sm opacity-60">{title}</p>
        <p className="text-xs mt-2 opacity-40">No hourly data available. Run a calculation first.</p>
      </div>
    );
  }

  const maxLoad = Math.max(...data.map((d) => Number(d.load ?? d.value ?? 0)), 1);

  return (
    <div className="glass-panel p-4" style={{ borderRadius: 16 }}>
      <p className="text-xs font-semibold mb-3 opacity-80">{title}</p>
      <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
        {data.map((entry, i) => {
          const load = Number(entry.load ?? entry.value ?? 0);
          const pct = Math.max(0, Math.min(100, (load / maxLoad) * 100));
          return (
            <div
              key={entry.hour ?? i}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${pct}%`,
                background: `var(--glass-primary)`,
                opacity: 0.6 + (pct / 250),
                minHeight: 2,
              }}
              title={`${entry.hour ?? i}h: ${load.toFixed(0)} W`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] opacity-50">0h</span>
        <span className="text-[9px] opacity-50">12h</span>
        <span className="text-[9px] opacity-50">23h</span>
      </div>
    </div>
  );
}
