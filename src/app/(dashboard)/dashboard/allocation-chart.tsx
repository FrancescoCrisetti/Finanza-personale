"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Slice {
  key: string;
  label: string;
  value: number;
  weightPct: number;
  color: string;
}

function eur(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function AllocationChart({ slices }: { slices: Slice[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="90%"
            paddingAngle={2}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, entry) => {
              const payload = entry?.payload as Slice | undefined;
              const num = typeof value === "number" ? value : 0;
              return [`${eur(num)} (${payload?.weightPct ?? 0}%)`, payload?.label ?? ""];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
