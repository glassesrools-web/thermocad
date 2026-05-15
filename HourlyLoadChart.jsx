import React from "react";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function HourlyLoadChart({ data }) {
  const chartData = Array.isArray(data) ? data : [];
  const peakLoad = chartData.length
    ? chartData.reduce((max, item) => Math.max(max, item.load ?? 0), 0)
    : 0;

  // Graceful empty-state: recharts crashes on a completely empty dataset
  if (chartData.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-lg font-semibold" style={{ color: "var(--glass-text)" }}>24-Hour Heat Load Profile (Building Total)</h4>
        <div
          className="h-64 sm:h-72 md:h-80 w-full min-h-[200px] flex items-center justify-center rounded-xl border"
          style={{ borderColor: "var(--glass-border)", background: "var(--input-bg)" }}
        >
          <p className="text-sm opacity-50" style={{ color: "var(--glass-text)" }}>
            No hourly data available. Run a calculation first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold" style={{ color: "var(--glass-text)" }}>24-Hour Heat Load Profile (Building Total)</h4>
      <div className="h-64 sm:h-72 md:h-80 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
            <XAxis
              dataKey="hour"
              stroke="var(--glass-text)"
              tick={{ fontSize: 12, fill: "var(--glass-text)", opacity: 0.7 }}
              label={{ value: "Hour of Day", position: "bottom", fill: "var(--glass-text)", dy: 10, opacity: 0.8 }}
            />
            <YAxis
              yAxisId="left"
              stroke="var(--glass-primary)"
              tick={{ fontSize: 12, fill: "var(--glass-primary)" }}
              domain={[0, "auto"]}
              label={{ value: "Heat Load (W)", angle: -90, position: "insideLeft", fill: "var(--glass-primary)", dx: 0 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="var(--glass-text)"
              tick={{ fontSize: 12, fill: "var(--glass-text)", opacity: 0.7 }}
              label={{ value: "Outdoor Temp (°C)", angle: 90, position: "insideRight", fill: "var(--glass-text)", dx: 10, opacity: 0.8 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                padding: "8px",
                color: "var(--glass-text)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 10px 32px rgba(0,0,0,0.15)",
              }}
              labelStyle={{ color: "var(--glass-primary)", fontWeight: "bold" }}
              formatter={(value, name) => {
                if (name === "Load (W)") return [`${Number(value).toFixed(0)} W`, name];
                if (name === "Outdoor Temp (°C)") return [`${Number(value).toFixed(1)} °C`, name];
                return [value, name];
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="load"
              name="Load (W)"
              stroke="var(--glass-primary)"
              fill="var(--glass-accent-bg)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="outdoorTemp"
              name="Outdoor Temp (°C)"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-sm opacity-80" style={{ color: "var(--glass-text)" }}>
        Peak Heating Load: <span className="font-bold font-mono" style={{ color: "var(--glass-primary)" }}>{peakLoad.toFixed(0)} W</span>
      </div>
    </div>
  );
}