"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({ prices, positive }: { prices: number[]; positive: boolean | null }) {
  if (prices.length < 2) return <span className="text-gray-300 text-xs">—</span>;

  const data = prices.map((p, i) => ({ i, p }));
  const color = positive == null ? "#6b7280" : positive ? "#16a34a" : "#dc2626";

  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line type="monotone" dataKey="p" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
