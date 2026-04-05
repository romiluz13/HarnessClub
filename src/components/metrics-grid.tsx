"use client";

/**
 * MetricsGrid — KPI dashboard grid with SWR auto-refresh.
 * Fetches team metrics and displays MetricsCards with sparklines.
 */

import useSWR from "swr";
import { Loader2, BarChart3 } from "lucide-react";
import { MetricsCard } from "@/components/metrics-card";
import type { GoalMetric, MetricsSnapshot } from "@/services/metrics-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface MetricsGridProps {
  teamId: string;
  className?: string;
}

interface MetricsResponse {
  metrics: GoalMetric[];
  trend: MetricsSnapshot[];
}

export function MetricsGrid({ teamId, className = "" }: MetricsGridProps) {
  const { data, isLoading, error } = useSWR<MetricsResponse>(
    `/api/teams/${teamId}/metrics`,
    fetcher,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className={`flex justify-center py-6 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data?.metrics) {
    return null; // Silent fail — metrics are supplementary
  }

  // Build sparkline data per metric from trend snapshots
  const sparklines = new Map<string, number[]>();
  if (data.trend && data.trend.length >= 2) {
    for (const metric of data.metrics) {
      const points = data.trend.map((snap) => {
        const m = snap.metrics.find((s) => s.key === metric.key);
        return m?.current ?? 0;
      });
      sparklines.set(metric.key, points);
    }
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        Team Metrics
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricsCard
            key={metric.key}
            metric={metric}
            sparklineData={sparklines.get(metric.key)}
          />
        ))}
      </div>
    </div>
  );
}
