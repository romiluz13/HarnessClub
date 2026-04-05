"use client";

/**
 * DepartmentComparison — Side-by-side metric comparison across departments.
 *
 * Per frontend-patterns: accessible, responsive.
 * Per tailwind-design-system: design tokens, dark mode.
 */

import useSWR from "swr";
import { Building, Loader2, AlertTriangle } from "lucide-react";
import type { GoalMetric, DepartmentMetrics } from "@/services/metrics-service";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DepartmentComparisonProps {
  orgId: string;
  className?: string;
}

export function DepartmentComparison({ orgId, className = "" }: DepartmentComparisonProps) {
  const { data, isLoading, error } = useSWR(
    `/api/orgs/${orgId}/metrics/departments`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const departments: DepartmentMetrics[] = data?.departments ?? [];

  if (isLoading) {
    return (
      <div className={`flex justify-center py-8 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <div className={`text-center text-sm text-red-500 ${className}`}>Failed to load department metrics</div>;
  }

  if (departments.length === 0) {
    return (
      <div className={`rounded-xl border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700 ${className}`}>
        <Building className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-500">No departments to compare</p>
      </div>
    );
  }

  // Collect all unique metric keys
  const metricKeys = [...new Set(departments.flatMap((d) => d.metrics.map((m) => m.key)))];

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <Building className="h-4 w-4" /> Department Comparison
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 pr-4 text-left text-xs font-medium uppercase text-gray-500">Department</th>
              <th className="pb-2 px-2 text-center text-xs font-medium uppercase text-gray-500">Teams</th>
              <th className="pb-2 px-2 text-center text-xs font-medium uppercase text-gray-500">Assets</th>
              {metricKeys.map((key) => (
                <th key={key} className="pb-2 px-2 text-center text-xs font-medium uppercase text-gray-500">
                  {departments[0]?.metrics.find((m) => m.key === key)?.label ?? key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {departments.map((dept) => (
              <tr key={dept.departmentId}>
                <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white">{dept.departmentName}</td>
                <td className="py-2.5 px-2 text-center text-gray-600 dark:text-gray-400">{dept.teamCount}</td>
                <td className="py-2.5 px-2 text-center text-gray-600 dark:text-gray-400">{dept.assetCount}</td>
                {metricKeys.map((key) => {
                  const metric = dept.metrics.find((m) => m.key === key);
                  if (!metric) return <td key={key} className="py-2.5 px-2 text-center text-gray-400">—</td>;
                  return <MetricCell key={key} metric={metric} />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCell({ metric }: { metric: GoalMetric }) {
  const belowFloor = metric.current < metric.floor;
  const aboveTarget = metric.current >= metric.target;

  return (
    <td className="py-2.5 px-2 text-center">
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-sm font-semibold ${
          belowFloor ? "text-red-600 dark:text-red-400"
          : aboveTarget ? "text-green-600 dark:text-green-400"
          : "text-gray-900 dark:text-white"
        }`}>
          {metric.current}{metric.unit === "%" ? "%" : ""}
        </span>
        {/* Mini bar */}
        <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full ${
              belowFloor ? "bg-red-500" : aboveTarget ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, (metric.current / metric.stretch) * 100)}%` }}
          />
        </div>
        {belowFloor && <AlertTriangle className="h-2.5 w-2.5 text-red-500" />}
      </div>
    </td>
  );
}
