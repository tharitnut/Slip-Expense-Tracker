"use client";

import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { MonthlySummary, TransactionPage } from "@/types";
import { Card, Button, Modal } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
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
  TrendingUp,
  TrendingDown,
  Download,
  ScanLine,
  Plus,
  ChevronLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Loader2,
  AlertCircle,
  Target,
  Pencil,
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

function useMonthlyBudget(selectedMonth: string) {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }, []);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`budget_${selectedMonth}`);
  }, [selectedMonth]);

  const rawValue = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const budget = rawValue ? Number(rawValue) : null;

  const setMonthlyBudget = useCallback(
    (amount: number | null) => {
      try {
        if (amount === null || isNaN(amount) || amount <= 0) {
          localStorage.removeItem(`budget_${selectedMonth}`);
        } else {
          localStorage.setItem(`budget_${selectedMonth}`, String(amount));
        }
        window.dispatchEvent(new Event("storage"));
      } catch {
        // ignore storage error
      }
    },
    [selectedMonth]
  );

  return { budget: budget && budget > 0 ? budget : null, setMonthlyBudget };
}

export default function DashboardPage() {
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const { budget, setMonthlyBudget } = useMonthlyBudget(selectedMonth);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
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
      toast.success(`Exported ${selectedMonth} transactions as CSV`);
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.message);
        toast.error(err.message);
      } else {
        setExportError("Failed to export CSV. Please try again.");
        toast.error("Failed to export CSV");
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

  const { start, end } = useMemo(() => {
    if (!selectedMonth) return { start: undefined, end: undefined };
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const startDate = `${selectedMonth}-01T00:00:00`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`;

    return { start: startDate, end: endDate };
  }, [selectedMonth]);

  const { data: monthTxData } = useQuery<TransactionPage>({
    queryKey: ["month-transactions", selectedMonth],
    queryFn: () =>
      api.get<TransactionPage>("/transactions", {
        start,
        end,
        limit: 200,
      }),
    enabled: !!summary && summary.transaction_count > 0,
  });

  // Computed Insights
  const peakDay = useMemo(() => {
    if (!summary?.daily || summary.daily.length === 0) return null;
    const sorted = [...summary.daily].sort((a, b) => b.total - a.total);
    const top = sorted[0];
    if (!top || top.total <= 0) return null;

    const dayTxs = monthTxData?.items?.filter((tx) => tx.occurred_at.startsWith(top.date));
    const topTx = dayTxs && dayTxs.length > 0 ? [...dayTxs].sort((a, b) => Number(b.amount) - Number(a.amount))[0] : null;

    return {
      date: top.date,
      total: top.total,
      merchant: topTx?.merchant || null,
    };
  }, [summary, monthTxData]);

  const topMerchant = useMemo(() => {
    if (!monthTxData?.items || monthTxData.items.length === 0) return null;
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of monthTxData.items) {
      if (!tx.merchant) continue;
      const key = tx.merchant.trim();
      if (!key) continue;
      const existing = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: existing.total + Number(tx.amount),
        count: existing.count + 1,
      });
    }
    if (map.size === 0) return null;
    let best = { name: "", total: 0, count: 0 };
    for (const [name, stats] of map.entries()) {
      if (stats.total > best.total) {
        best = { name, total: stats.total, count: stats.count };
      }
    }
    return best.total > 0 ? best : null;
  }, [monthTxData]);

  const slipStats = useMemo(() => {
    if (!monthTxData?.items || monthTxData.items.length === 0) return null;
    const total = monthTxData.items.length;
    const slipCount = monthTxData.items.filter((tx) => tx.source === "slip").length;
    const percent = Math.round((slipCount / total) * 100);
    return { slipCount, total, percent };
  }, [monthTxData]);

  const pacingForecast = useMemo(() => {
    if (!summary || summary.total <= 0) return null;
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const totalDays = new Date(year, month, 0).getDate();

    const now = new Date();
    const isCurrentMonth =
      now.getFullYear() === year && now.getMonth() + 1 === month;
    const currentDay = isCurrentMonth ? Math.min(now.getDate(), totalDays) : totalDays;

    const activeDays = summary.daily.length || 1;
    const dailyAvg = summary.total / activeDays;
    const projected = isCurrentMonth
      ? Math.round((summary.total / Math.max(1, currentDay)) * totalDays)
      : summary.total;

    return {
      projected,
      dailyAvg,
      isCurrentMonth,
    };
  }, [summary, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ql-border/70">
        <h1 className="text-2xl sm:text-[26px] font-serif font-semibold text-ql-text tracking-tight">
          {selectedMonthLabel}
        </h1>

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
          {/* Primary Ledger Overview: Asymmetric 5 + 7 layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Hero Total Card (Dashed Receipt Signature Border) */}
            <Card variant="receipt" className="lg:col-span-5 p-5 sm:p-6 bg-ql-surface/90 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ql-muted">Total spent</span>
                  {summary.change_percent !== null ? (
                    summary.change_percent > 0 ? (
                      <span className="inline-flex items-center text-xs font-medium text-ql-error">
                        <TrendingUp className="w-3.5 h-3.5 mr-1" />
                        +{summary.change_percent.toFixed(1)}% vs prev
                      </span>
                    ) : summary.change_percent < 0 ? (
                      <span className="inline-flex items-center text-xs font-medium text-ql-success">
                        <TrendingDown className="w-3.5 h-3.5 mr-1" />
                        {summary.change_percent.toFixed(1)}% vs prev
                      </span>
                    ) : (
                      <span className="text-xs text-ql-muted">Unchanged vs prev</span>
                    )
                  ) : (
                    <span className="text-xs text-ql-muted">First active month</span>
                  )}
                </div>

                <p className="text-3xl sm:text-4xl font-serif font-bold text-ql-text tracking-tight tabular-nums">
                  {formatCurrency(summary.total)}
                </p>
              </div>

              {/* Monthly Budget Progress Indicator */}
              {budget !== null ? (
                (() => {
                  const percentSpent = (summary.total / budget) * 100;
                  const isOver = summary.total > budget;
                  const remaining = budget - summary.total;
                  return (
                    <div className="pt-3 border-t border-ql-border/50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ql-muted">Budget</span>
                          <span className="font-medium text-ql-text tabular-nums">
                            {formatCurrency(budget)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setBudgetInput(String(budget));
                              setIsBudgetModalOpen(true);
                            }}
                            title="Edit target budget"
                            className="p-0.5 text-ql-muted hover:text-ql-primary transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                        <span className={isOver ? "text-ql-error font-medium tabular-nums" : "text-ql-muted tabular-nums"}>
                          {isOver
                            ? `+${formatCurrency(summary.total - budget)} over`
                            : `${formatCurrency(remaining)} left (${Math.round(percentSpent)}%)`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-ql-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver ? "bg-ql-error" : percentSpent > 80 ? "bg-ql-accent" : "bg-ql-primary"
                          }`}
                          style={{ width: `${Math.min(percentSpent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="pt-3 border-t border-ql-border/50 flex items-center justify-between">
                  <span className="text-xs text-ql-muted">No monthly ceiling set</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput("");
                      setIsBudgetModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-ql-primary hover:underline cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Set budget</span>
                  </button>
                </div>
              )}
            </Card>

            {/* Secondary Ledger Metrics — Unified 3-column strip with vertical dividers */}
            <Card padding="none" className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-ql-border/60">
              <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
                <span className="text-xs text-ql-muted">Previous month</span>
                <div>
                  <p className="text-2xl font-serif font-semibold text-ql-text tracking-tight tabular-nums">
                    {formatCurrency(summary.previous_month_total)}
                  </p>
                  <p className="text-xs text-ql-muted mt-1">Prior period total</p>
                </div>
              </div>

              <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
                <span className="text-xs text-ql-muted">Recorded entries</span>
                <div>
                  <p className="text-2xl font-serif font-semibold text-ql-text tracking-tight tabular-nums">
                    {summary.transaction_count}
                  </p>
                  <p className="text-xs text-ql-muted mt-1">
                    {slipStats
                      ? `${slipStats.slipCount} slip · ${slipStats.total - slipStats.slipCount} manual`
                      : `In ${selectedMonthLabel}`}
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
                <span className="text-xs text-ql-muted">Daily average</span>
                <div>
                  <p className="text-2xl font-serif font-semibold text-ql-text tracking-tight tabular-nums">
                    {formatCurrency(
                      summary.daily.length > 0
                        ? summary.total / summary.daily.length
                        : 0
                    )}
                  </p>
                  <p className="text-xs text-ql-muted mt-1">
                    Across {summary.daily.length} active {summary.daily.length === 1 ? "day" : "days"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Ledger Highlights Strip (replaces generic 4-box Insights card) */}
          {hasData && (
            <div className="rounded-2xl border border-ql-border/80 bg-ql-surface/70 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-6 divide-y sm:divide-y-0 lg:divide-x divide-ql-border/50">
                <div className="pt-2 sm:pt-0">
                  <span className="text-xs text-ql-muted">Peak day</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-base font-serif font-semibold text-ql-text tabular-nums">
                      {peakDay ? formatCurrency(peakDay.total) : "—"}
                    </span>
                    {peakDay && (
                      <span className="text-xs text-ql-muted truncate">
                        on {formatDayLabel(peakDay.date)}
                      </span>
                    )}
                  </div>
                  {peakDay?.merchant && (
                    <p className="text-[11px] text-ql-muted truncate mt-0.5">
                      Mostly {peakDay.merchant}
                    </p>
                  )}
                </div>

                <div className="pt-3 sm:pt-0 lg:pl-6">
                  <span className="text-xs text-ql-muted">Top payee</span>
                  <p className="mt-1 text-base font-serif font-semibold text-ql-text truncate">
                    {topMerchant ? topMerchant.name : "Various"}
                  </p>
                  <p className="text-[11px] text-ql-muted tabular-nums mt-0.5">
                    {topMerchant
                      ? `${formatCurrency(topMerchant.total)} · ${topMerchant.count} ${
                          topMerchant.count === 1 ? "entry" : "entries"
                        }`
                      : "No payee recorded"}
                  </p>
                </div>

                <div className="pt-3 sm:pt-0 lg:pl-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ql-muted">Slip coverage</span>
                    <span className="text-xs font-medium text-ql-text tabular-nums">
                      {slipStats ? `${slipStats.percent}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-ql-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ql-accent rounded-full transition-all duration-300"
                      style={{ width: `${slipStats ? slipStats.percent : 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-ql-muted mt-1.5">
                    {slipStats
                      ? `${slipStats.slipCount} of ${slipStats.total} verified by bank slip`
                      : "Manual entries only"}
                  </p>
                </div>

                <div className="pt-3 sm:pt-0 lg:pl-6">
                  <span className="text-xs text-ql-muted">
                    {pacingForecast?.isCurrentMonth ? "Projected month-end" : "Month close"}
                  </span>
                  <p className="mt-1 text-base font-serif font-semibold text-ql-text tabular-nums">
                    {pacingForecast ? formatCurrency(pacingForecast.projected) : "—"}
                  </p>
                  <p className="text-[11px] text-ql-muted tabular-nums mt-0.5">
                    {budget && pacingForecast
                      ? pacingForecast.projected <= budget
                        ? `${formatCurrency(budget - pacingForecast.projected)} within budget`
                        : `${formatCurrency(pacingForecast.projected - budget)} over budget`
                      : pacingForecast?.isCurrentMonth
                      ? "At current daily pace"
                      : "Final recorded spend"}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                          formatter={(value: unknown, name: unknown) => [
                            formatCurrency(Number(value) || 0),
                            String(name || "Total"),
                          ]}
                          contentStyle={{
                            backgroundColor: "var(--ql-surface, #ffffff)",
                            borderRadius: "10px",
                            border: "1px solid var(--ql-border, #E8E4DC)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                            fontSize: "12px",
                            color: "var(--ql-text, #1C2420)",
                          }}
                          itemStyle={{
                            color: "var(--ql-text, #1C2420)",
                            fontWeight: 600,
                          }}
                          labelStyle={{
                            color: "var(--ql-muted, #6B746E)",
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

                {/* Categories List with visual proportion bars */}
                <div className="mt-4 space-y-3">
                  {summary.by_category.map((cat, idx) => {
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    const isTop = idx === 0;
                    return (
                      <div
                        key={cat.category_id || cat.category_name}
                        className="space-y-1.5"
                      >
                        <div className="flex items-baseline justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span
                              className={`truncate ${
                                isTop ? "font-semibold text-ql-text" : "font-medium text-ql-text/85"
                              }`}
                            >
                              {cat.category_name}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2.5 shrink-0">
                            <span
                              className={`tabular-nums ${
                                isTop ? "font-semibold text-ql-text" : "font-medium text-ql-text/90"
                              }`}
                            >
                              {formatCurrency(cat.total)}
                            </span>
                            <span className="text-[11px] text-ql-muted w-10 text-right tabular-nums">
                              {cat.percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-ql-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(cat.percent, 2)}%`,
                              backgroundColor: color,
                            }}
                          />
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
                  <div className="flex-1 min-h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={summary.daily}
                        margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ql-border, #E8E4DC)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDayLabel}
                          tick={{ fill: "var(--ql-muted, #6B746E)", fontSize: 11 }}
                          axisLine={{ stroke: "var(--ql-border, #E8E4DC)" }}
                          tickLine={false}
                          angle={-30}
                          textAnchor="end"
                          height={40}
                        />
                        <YAxis
                          tickFormatter={(val) => `฿${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                          tick={{ fill: "var(--ql-muted, #6B746E)", fontSize: 11 }}
                          axisLine={{ stroke: "var(--ql-border, #E8E4DC)" }}
                          tickLine={false}
                          width={45}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "var(--ql-primary-light)", opacity: 0.65, rx: 6, ry: 6 }}
                          formatter={(val: unknown) => [formatCurrency(Number(val) || 0), "Spent"]}
                          labelFormatter={(label) => `${formatDayLabel(String(label))}`}
                          contentStyle={{
                            backgroundColor: "var(--ql-surface, #ffffff)",
                            borderRadius: "10px",
                            border: "1px solid var(--ql-border, #E8E4DC)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                            fontSize: "12px",
                            color: "var(--ql-text, #1C2420)",
                          }}
                          itemStyle={{
                            color: "var(--ql-text, #1C2420)",
                            fontWeight: 600,
                          }}
                          labelStyle={{
                            color: "var(--ql-muted, #6B746E)",
                            marginBottom: "2px",
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="var(--ql-primary, #1F4D3A)"
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
            /* Empty State for Month — Receipt Ledger style */
            <div className="receipt-border rounded-2xl bg-ql-surface/60 px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-mono uppercase tracking-[0.12em] text-ql-muted">
                  No entries · {selectedMonthLabel}
                </p>
                <h3 className="text-base font-serif font-semibold text-ql-text">
                  Nothing recorded for this month yet
                </h3>
                <p className="text-xs text-ql-muted">
                  Scan a Thai bank transfer slip or add an expense manually to see your breakdown.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link href="/upload">
                  <Button variant="primary" size="sm">
                    <ScanLine className="w-4 h-4" />
                    <span>Scan Slip</span>
                  </Button>
                </Link>
                <Link href="/transactions">
                  <Button variant="secondary" size="sm">
                    <Plus className="w-4 h-4" />
                    <span>Add Expense</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {/* Set Monthly Budget Modal */}
      <Modal
        open={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title={`Set Target Budget (${selectedMonthLabel})`}
        maxWidth="max-w-sm"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const num = parseFloat(budgetInput);
            if (!isNaN(num) && num > 0) {
              setMonthlyBudget(num);
              toast.success(`Target budget set to ${formatCurrency(num)}`);
            } else {
              setMonthlyBudget(null);
              toast.info("Budget target cleared");
            }
            setIsBudgetModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Monthly Spending Limit (THB)
            </label>
            <input
              type="number"
              step="1000"
              min="0"
              placeholder="e.g. 15000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-ql-border bg-ql-surface text-ql-text text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ql-primary/30 focus:border-ql-primary transition"
            />
            <p className="text-[11px] text-ql-muted mt-1.5">
              Set a spending ceiling for this month to monitor your spending allowance.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-ql-border/60">
            {budget !== null ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setMonthlyBudget(null);
                  toast.info("Budget target cleared");
                  setIsBudgetModalOpen(false);
                }}
              >
                Clear
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsBudgetModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Target
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
