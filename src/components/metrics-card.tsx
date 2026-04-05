"use client";

/**
 * MetricsCard — KPI card with value, trend indicator, floor alert, and sparkline.
 *
 * Per frontend-patterns: accessible, responsive, all states.
 * Per tailwind-design-system: design tokens, dark mode.
 */

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { GoalMetric } from "@/services/metrics-service";

interface MetricsCardProps {
  metric: GoalMetric;
  sparklineData?: number[];
  className?: string;
}

export function MetricsCard({ metric, sparklineData, className = "" }: MetricsCardProps) {
  const belowFloor = metric.current < metric.floor;
  const aboveStretch = metric.current >= metric.stretch;

  return (
    <div className={`rounded-xl border p-4 ${
      belowFloor
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
        : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    } ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {metric.label}
        </span>
        <TrendBadge trend={metric.trend} delta={metric.trendDelta} unit={metric.unit} />
      </div>

      {/* Value */}
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${
          belowFloor ? "text-red-600 dark:text-red-400"
          : aboveStretch ? "text-green-600 dark:text-green-400"
          : "text-gray-900 dark:text-white"
        }`}>
          {metric.current}
        </span>
        <span className="text-sm text-gray-400">{metric.unit === "%" ? "%" : ""}</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all ${
            belowFloor ? "bg-red-500" : aboveStretch ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${Math.min(100, (metric.current / metric.stretch) * 100)}%` }}
        />
      </div>

      {/* Target labels */}
      <div className="mt-1.5 flex justify-between text-[10px] text-gray-400">
        <span>Floor: {metric.floor}{metric.unit === "%" ? "%" : ""}</span>
        <span>Target: {metric.target}{metric.unit === "%" ? "%" : ""}</span>
        <span>Stretch: {metric.stretch}{metric.unit === "%" ? "%" : ""}</span>
      </div>

      {/* Floor alert */}
      {belowFloor && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          Below floor ({metric.floor}{metric.unit === "%" ? "%" : ""})
        </div>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="mt-2">
          <SparklineChart data={sparklineData} className="h-8 w-full" />
        </div>
      )}
    </div>
  );
}

// ─── Trend Badge ──────────────────────────────────────────

function TrendBadge({ trend, delta, unit }: { trend: string; delta: number; unit: string }) {
  if (trend === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-gray-400">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const isUp = trend === "up";
  const color = isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {isUp ? "+" : ""}{delta}{unit === "%" ? "%" : ""}
    </span>
  );
}

// ─── Sparkline Chart (pure SVG, no deps) ──────────────────

interface SparklineChartProps {
  data: number[];
  className?: string;
}

export function SparklineChart({ data, className = "" }: SparklineChartProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const isPositive = data[data.length - 1] >= data[0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-label="Trend chart">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={isPositive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].split(",")[0]}
        cy={points[points.length - 1].split(",")[1]}
        r="2"
        fill={isPositive ? "#22c55e" : "#ef4444"}
      />
    </svg>
  );
}
