'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const SIZE_COLORS: Record<string, string> = {
  'Twin': '#f97316',
  'Twin XL': '#84cc16',
  'Full': '#ef4444',
  'Queen': '#844CDA',
  'King': '#8b5cf6',
  'Cal King': '#eab308',
}

type ChartPoint = { time: string; [size: string]: string | number }

export default function PriceChart({ data, sizes }: { data: ChartPoint[]; sizes: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="time"
          tickFormatter={(v: string) => new Date(v).toLocaleDateString()}
          tick={{ fontSize: 11, fill: '#6b7280' }}
        />
        <YAxis
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          width={80}
        />
        <Tooltip
          formatter={(v) => [
            typeof v === 'number'
              ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : String(v),
            '',
          ]}
          labelFormatter={(l) => (typeof l === 'string' ? new Date(l).toLocaleString() : String(l))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {sizes.map(size => (
          <Line
            key={size}
            type="monotone"
            dataKey={size}
            stroke={SIZE_COLORS[size] ?? '#94a3b8'}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
