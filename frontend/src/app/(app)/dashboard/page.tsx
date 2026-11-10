"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { MonthlySummary } from "@/types";
import { Card, Button } from "@/components/ui";
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
  Wallet,
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

const CHART_COLORS = [
  "#1F4D3A", // primary deep green
  "#B08D57", // champagne gold
  "#6B746E", // warm gray
  "#3A7D5C", // sage green
  "#D4C5A0", // pale gold
  "#4A6B5D", // muted forest
  "#8B7355", // antique brass
  "#A8B5AD", // soft sage
  "#2E3B32", // slate green
  "#C9A86C", // bright gold
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ql-border/60">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text tracking-tight">Monthly Dashboard</h1>
          <p className="text-ql-muted text-sm mt-0.5">
            Spending insights, category breakdown, and monthly trends
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector Buttons */}
          <div className="flex items-center bg-ql-surface border border-ql-border rounded-xl p-1 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-lg text-ql-muted hover:text-ql-text hover:bg-ql-bg transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-medium text-ql-text px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value} className="bg-ql-surface text-ql-text">
                  {m.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-lg text-ql-muted hover:text-ql-text hover:bg-ql-bg transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export CSV Button */}
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="shadow-xs"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-ql-primary" />
            ) : (
              <Download className="w-4 h-4 text-ql-muted" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="p-3.5 rounded-xl bg-ql-error-light border border-ql-error/20 text-ql-error text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
          <Loader2 className="w-7 h-7 text-ql-primary animate-spin mb-3" />
          <p className="text-ql-muted text-sm font-medium">Loading monthly spending data...</p>
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center border-ql-error/30">
          <AlertCircle className="w-8 h-8 text-ql-error mx-auto mb-2" />
          <h3 className="text-base font-semibold text-ql-text">Failed to load dashboard</h3>
          <p className="text-xs text-ql-muted mt-1">
            Could not fetch summary data for {selectedMonthLabel}.
          </p>
          <Button onClick={() => refetch()} variant="primary" size="sm" className="mt-4">
            Try Again
          </Button>
        </Card>
      ) : summary ? (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Spending (Dashed Receipt Signature Border) */}
            <Card variant="receipt" className="p-5 space-y-3 bg-ql-surface/80 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ql-muted uppercase tracking-wider">
                  Total Spending
                </span>
                <div className="w-8 h-8 rounded-lg bg-ql-primary-light text-ql-primary flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-serif font-bold text-ql-text tracking-tight tabular-nums">
                  {formatCurrency(summary.total)}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  {summary.change_percent !== null ? (
                    summary.change_percent > 0 ? (
                      <span className="inline-flex items-center font-medium text-ql-error bg-ql-error-light px-2 py-0.5 rounded-full">
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                        +{summary.change_percent.toFixed(1)}%
                      </span>
                    ) : summary.change_percent < 0 ? (
                      <span className="inline-flex items-center font-medium text-ql-success bg-ql-success-light px-2 py-0.5 rounded-full">
                        <TrendingDown className="w-3 h-3 mr-0.5" />
                        {summary.change_percent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-ql-muted bg-ql-bg px-2 py-0.5 rounded-full">0.0%</span>
                    )
                  ) : (
                    <span className="text-ql-muted">No prior month</span>
                  )}
                  <span className="text-ql-muted/80">vs last month</span>
                </div>
              </div>
            </Card>

            {/* Card 2: Previous Month Total */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ql-muted uppercase tracking-wider">
                  Previous Month
                </span>
                <div className="w-8 h-8 rounded-lg bg-ql-bg text-ql-muted flex items-center justify-center border border-ql-border">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-serif font-semibold text-ql-text/80 tracking-tight tabular-nums">
                  {formatCurrency(summary.previous_month_total)}
                </p>
                <p className="text-xs text-ql-muted mt-2">
                  Baseline for {selectedMonthLabel}
                </p>
              </div>
            </Card>

            {/* Card 3: Transactions Count */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ql-muted uppercase tracking-wider">
                  Entries
                </span>
                <div className="w-8 h-8 rounded-lg bg-ql-accent-light text-ql-accent flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-serif font-semibold text-ql-text tracking-tight tabular-nums">
                  {summary.transaction_count}
                </p>
                <p className="text-xs text-ql-muted mt-2">
                  Recorded in {selectedMonthLabel}
                </p>
              </div>
            </Card>

            {/* Card 4: Daily Average */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ql-muted uppercase tracking-wider">
                  Daily Average
                </span>
                <div className="w-8 h-8 rounded-lg bg-ql-success-light text-ql-success flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-serif font-semibold text-ql-text tracking-tight tabular-nums">
                  {formatCurrency(
                    summary.daily.length > 0
                      ? summary.total / summary.daily.length
                      : 0
                  )}
                </p>
                <p className="text-xs text-ql-muted mt-2">
                  Across active spending days
                </p>
              </div>
            </Card>
          </div>

          {/* Charts Section */}
          {hasData ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown Donut Chart */}
              <Card className="lg:col-span-5 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-ql-border/50">
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-ql-primary" />
                    <h2 className="text-sm font-semibold text-ql-text">Category Breakdown</h2>
                  </div>
                  <span className="text-xs text-ql-muted font-medium">
                    {summary.by_category.length} categories
                  </span>
                </div>

                {isMounted && (
                  <div className="h-64 w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.by_category}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={88}
                          paddingAngle={2}
                          stroke="var(--ql-surface, #ffffff)"
                          strokeWidth={2}
                        >
                          {summary.by_category.map((entry, index) => (
                            <Cell
                              key={`cell-${entry.category_id || entry.category_name}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: unknown) => [
                            formatCurrency(Number(value) || 0),
                            "Total",
                          ]}
                          contentStyle={{
                            backgroundColor: "var(--ql-surface, #ffffff)",
                            borderRadius: "10px",
                            border: "1px solid var(--ql-border, #E8E4DC)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            fontSize: "12px",
                            color: "var(--ql-text, #1C2420)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Donut center total */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] tracking-wider uppercase font-medium text-ql-muted">Total</span>
                      <span className="text-sm font-serif font-bold text-ql-text tabular-nums">
                        {formatCurrency(summary.total)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Categories List */}
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-ql-border/40">
                  {summary.by_category.map((cat, idx) => {
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <div
                        key={cat.category_id || cat.category_name}
                        className="flex items-center justify-between text-xs pt-2 first:pt-0"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[180px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-ql-text/90 truncate">
                            {cat.category_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-ql-text tabular-nums">
                            {formatCurrency(cat.total)}
                          </span>
                          <span className="text-ql-muted w-11 text-right tabular-nums">
                            {cat.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Daily Spending Trend Chart */}
              <Card className="lg:col-span-7 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-ql-border/50">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-ql-primary" />
                    <h2 className="text-sm font-semibold text-ql-text">Daily Spending Trend</h2>
                  </div>
                  <span className="text-xs text-ql-muted font-medium">
                    {summary.daily.length} active days
                  </span>
                </div>

                {isMounted && (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={summary.daily}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDayLabel}
                          tick={{ fill: "#6B746E", fontSize: 11 }}
                          axisLine={{ stroke: "#E8E4DC" }}
                          tickLine={false}
                          angle={-30}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          tickFormatter={(val) => `฿${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                          tick={{ fill: "#6B746E", fontSize: 11 }}
                          axisLine={{ stroke: "#E8E4DC" }}
                          tickLine={false}
                          width={45}
                        />
                        <RechartsTooltip
                          formatter={(val: unknown) => [formatCurrency(Number(val) || 0), "Spent"]}
                          labelFormatter={(label) => `Date: ${formatDayLabel(String(label))}`}
                          contentStyle={{
                            backgroundColor: "var(--ql-surface, #ffffff)",
                            borderRadius: "10px",
                            border: "1px solid var(--ql-border, #E8E4DC)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                            fontSize: "12px",
                            color: "var(--ql-text, #1C2420)",
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="#1F4D3A"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            /* Empty State for Month */
            <Card className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-ql-primary-light text-ql-primary flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-serif font-semibold text-ql-text">
                  No Spending Recorded in {selectedMonthLabel}
                </h3>
                <p className="text-xs text-ql-muted mt-1">
                  Start adding expenses or scan a Thai bank slip to populate your dashboard charts.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link href="/upload">
                  <Button variant="primary" size="sm">
                    <ScanLine className="w-4 h-4" />
                    <span>Scan Bank Slip</span>
                  </Button>
                </Link>
                <Link href="/transactions">
                  <Button variant="secondary" size="sm">
                    <Plus className="w-4 h-4" />
                    <span>Add Expense</span>
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
