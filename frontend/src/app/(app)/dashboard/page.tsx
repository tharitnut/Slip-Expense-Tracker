"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { MonthlySummary } from "@/types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Receipt,
  Download,
  ScanLine,
  Plus,
  ChevronLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Loader2,
  AlertCircle,
} from "lucide-react";

const CATEGORY_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#84cc16", // Lime
  "#64748b", // Slate
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getRecentMonths(count = 12): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [yearStr, monStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monStr, 10);
  const target = new Date(year, mon - 1 + delta, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function formatDayLabel(dateStr: string): string {
  // input: "2026-10-05" -> "Oct 5"
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monIdx = parseInt(parts[1], 10) - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[monIdx]} ${day}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const recentMonths = useMemo(() => getRecentMonths(12), []);

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery<MonthlySummary>({
    queryKey: ["monthly-summary", selectedMonth],
    queryFn: () => api.get<MonthlySummary>("/summary/monthly", { month: selectedMonth }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await api.downloadCsv(selectedMonth);
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.message);
      } else {
        setExportError("Failed to export CSV. Please try again.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const selectedMonthLabel = useMemo(() => {
    const found = recentMonths.find((m) => m.value === selectedMonth);
    if (found) return found.label;
    const [year, mon] = selectedMonth.split("-");
    const d = new Date(parseInt(year, 10), parseInt(mon, 10) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [recentMonths, selectedMonth]);

  const hasData = summary && summary.total > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Monthly Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Spending insights, category breakdown, and monthly trends
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector Buttons */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-1">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Download className="w-4 h-4 text-slate-500" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[360px]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-500 text-sm">Loading monthly spending data...</p>
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-900">Failed to load dashboard</h3>
          <p className="text-xs text-slate-500 mt-1">
            Could not fetch summary data for {selectedMonthLabel}.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
          >
            Try Again
          </button>
        </div>
      ) : summary ? (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Spending */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Spending
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatCurrency(summary.total)}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {summary.change_percent !== null ? (
                    summary.change_percent > 0 ? (
                      <span className="inline-flex items-center text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded-md">
                        <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                        +{summary.change_percent.toFixed(1)}%
                      </span>
                    ) : summary.change_percent < 0 ? (
                      <span className="inline-flex items-center text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                        {summary.change_percent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-500">0.0%</span>
                    )
                  ) : (
                    <span className="text-slate-400">No previous data</span>
                  )}
                  <span className="text-slate-400">vs last month</span>
                </div>
              </div>
            </div>

            {/* Card 2: Previous Month Total */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Previous Month
                </span>
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-700 tracking-tight">
                  {formatCurrency(summary.previous_month_total)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Baseline comparison for {selectedMonthLabel}
                </p>
              </div>
            </div>

            {/* Card 3: Transactions Count */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Transactions
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {summary.transaction_count}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Recorded in {selectedMonthLabel}
                </p>
              </div>
            </div>

            {/* Card 4: Daily Average */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Daily Average
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatCurrency(
                    summary.daily.length > 0
                      ? summary.total / summary.daily.length
                      : 0
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Across active spending days
                </p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          {hasData ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown Donut Chart */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900">Category Breakdown</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {summary.by_category.length} categories
                  </span>
                </div>

                {isMounted && (
                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.by_category}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {summary.by_category.map((entry, index) => (
                            <Cell
                              key={`cell-${entry.category_id || entry.category_name}`}
                              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: unknown) => [
                            formatCurrency(Number(value) || 0),
                            "Total",
                          ]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Categories List */}
                <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {summary.by_category.map((cat, idx) => {
                    const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                    return (
                      <div
                        key={cat.category_id || cat.category_name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[180px]">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-slate-700 truncate">
                            {cat.category_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(cat.total)}
                          </span>
                          <span className="text-slate-400 w-12 text-right">
                            {cat.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Spending Trend Chart */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-base font-bold text-slate-900">Daily Spending Trend</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {summary.daily.length} days with spending
                  </span>
                </div>

                {isMounted && (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={summary.daily}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDayLabel}
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                          angle={-30}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          tickFormatter={(val) => `฿${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                          width={45}
                        />
                        <RechartsTooltip
                          formatter={(val: unknown) => [formatCurrency(Number(val) || 0), "Spent"]}
                          labelFormatter={(label) => `Date: ${formatDayLabel(String(label))}`}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="#3b82f6"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty State for Month */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
                <Receipt className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">
                  No Spending Recorded in {selectedMonthLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Start adding expenses or scan a bank slip to see your monthly dashboard and visual charts.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Scan Bank Slip</span>
                </Link>
                <Link
                  href="/transactions"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Expense</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
