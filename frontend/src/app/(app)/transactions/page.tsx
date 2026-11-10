"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Category, Transaction, TransactionPage } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { TransactionModal } from "@/components/TransactionModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Card, Button, Badge } from "@/components/ui";
import {
  Plus,
  ScanLine,
  Search,
  Download,
  Calendar,
  Filter,
  Pencil,
  Trash2,
  Receipt,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
} from "lucide-react";

const PAGE_SIZE = 20;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
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

export default function TransactionsPage() {
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [page, setPage] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate start & end date for the selected month filter
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

  // Fetch Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  // Map category IDs to names
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Fetch Transactions Page
  const {
    data: txData,
    isLoading,
    isError,
    refetch,
  } = useQuery<TransactionPage>({
    queryKey: [
      "transactions",
      page,
      start,
      end,
      selectedCategoryId,
      debouncedSearch,
    ],
    queryFn: () => {
      const params: Record<string, string | number | undefined> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (start) params.start = start;
      if (end) params.end = end;
      if (selectedCategoryId) params.category_id = selectedCategoryId;
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();

      return api.get<TransactionPage>("/transactions", params);
    },
  });

  const recentMonths = useMemo(() => getRecentMonths(12), []);

  const total = txData?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const transactions = txData?.items || [];

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return;
    setIsDeleting(true);
    try {
      await api.delete(`/transactions/${deletingTransaction.id}`);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
      setDeletingTransaction(null);
    } catch {
      // error handled
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await api.downloadCsv(selectedMonth || undefined);
    } catch {
      // export handled
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedMonth("");
    setSelectedCategoryId("");
    setSearchQuery("");
    setPage(0);
  };

  const hasActiveFilters = Boolean(selectedMonth || selectedCategoryId || searchQuery);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ql-border/60">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text tracking-tight">Transactions</h1>
          <p className="text-ql-muted text-sm mt-0.5">
            View, filter, and manage your personal spending records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="shadow-xs"
            title="Export transactions as CSV"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-ql-primary" />
            ) : (
              <Download className="w-4 h-4 text-ql-muted" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Link href="/upload">
            <Button variant="secondary" size="md" className="border-ql-border shadow-xs">
              <ScanLine className="w-4 h-4 text-ql-primary" />
              <span>Scan Slip</span>
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAddModal}
            className="shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search merchant or memo..."
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-ql-border bg-ql-surface text-sm text-ql-text placeholder:text-ql-muted focus:outline-none focus:ring-2 focus:ring-ql-primary/30 focus:border-ql-primary transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(0);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-ql-muted hover:text-ql-text transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Month Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
              <Calendar className="w-4 h-4" />
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-ql-border bg-ql-surface text-sm text-ql-text focus:outline-none focus:ring-2 focus:ring-ql-primary/30 focus:border-ql-primary transition cursor-pointer"
            >
              <option value="">All Months</option>
              {recentMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
              <Filter className="w-4 h-4" />
            </span>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-ql-border bg-ql-surface text-sm text-ql-text focus:outline-none focus:ring-2 focus:ring-ql-primary/30 focus:border-ql-primary transition cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-ql-border/40 text-xs text-ql-muted">
            <span>Filters active</span>
            <button
              onClick={handleResetFilters}
              className="text-ql-primary hover:underline font-medium cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        )}
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        /* Skeletons */
        <Card className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-3 px-2 border-b border-ql-border/40 last:border-0">
              <div className="space-y-2">
                <div className="h-4 bg-ql-border/50 rounded w-36" />
                <div className="h-3 bg-ql-border/30 rounded w-24" />
              </div>
              <div className="h-5 bg-ql-border/50 rounded w-20" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        /* Error State */
        <Card className="p-8 text-center space-y-3 border-ql-error/30">
          <AlertCircle className="w-8 h-8 text-ql-error mx-auto" />
          <h3 className="text-base font-semibold text-ql-text">Failed to load transactions</h3>
          <p className="text-xs text-ql-muted">Please check your network connection or server status.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </Card>
      ) : transactions.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-ql-primary-light text-ql-primary flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-serif font-semibold text-ql-text">No transactions found</h3>
            <p className="text-xs text-ql-muted mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No entries match your current search filters. Try clearing filters to see all records."
                : "You haven't added any expense records yet. Click below to add your first expense or scan a slip."}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
            >
              <Plus className="w-4 h-4" />
              <span>Record Your First Expense</span>
            </Button>
          )}
        </Card>
      ) : (
        /* Data Display: Desktop Table + Mobile Cards */
        <Card padding="none" className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-ql-text">
              <thead className="bg-ql-bg/70 border-b border-ql-border text-[11px] font-medium text-ql-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Merchant & Memo</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ql-border/40">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-ql-bg/50 transition-colors group">
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-ql-muted">
                      {formatDisplayDate(tx.occurred_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-ql-text">
                        {tx.merchant || <span className="text-ql-muted italic text-xs">Unspecified merchant</span>}
                      </div>
                      {tx.note && <div className="text-xs text-ql-muted mt-0.5 line-clamp-1">{tx.note}</div>}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tx.category_id && categoryMap.has(tx.category_id) ? (
                        <Badge variant="primary">
                          {categoryMap.get(tx.category_id)}
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          Uncategorized
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tx.source === "slip" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ql-accent bg-ql-accent-light px-2 py-0.5 rounded-md border border-ql-accent/20">
                          <FileCheck2 className="w-3 h-3" />
                          Slip
                        </span>
                      ) : (
                        <span className="text-[11px] text-ql-muted bg-ql-bg px-2 py-0.5 rounded-md border border-ql-border">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold text-ql-text tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleOpenEditModal(tx)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-ql-muted hover:text-ql-primary hover:bg-ql-primary-light transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTransaction(tx)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-ql-muted hover:text-ql-error hover:bg-ql-error-light transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-ql-border/40">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-ql-text text-sm">
                      {tx.merchant || <span className="text-ql-muted italic">Unspecified</span>}
                    </h4>
                    <span className="text-xs text-ql-muted">{formatDisplayDate(tx.occurred_at)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-ql-text text-base tabular-nums">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>

                {tx.note && <p className="text-xs text-ql-muted">{tx.note}</p>}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {tx.category_id && categoryMap.has(tx.category_id) ? (
                      <Badge variant="primary">
                        {categoryMap.get(tx.category_id)}
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        Uncategorized
                      </Badge>
                    )}

                    {tx.source === "slip" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ql-accent bg-ql-accent-light px-1.5 py-0.5 rounded">
                        <FileCheck2 className="w-2.5 h-2.5" />
                        Slip
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(tx)}
                      className="p-1.5 rounded-lg text-ql-muted hover:text-ql-primary hover:bg-ql-primary-light"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingTransaction(tx)}
                      className="p-1.5 rounded-lg text-ql-muted hover:text-ql-error hover:bg-ql-error-light"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-ql-bg/40 border-t border-ql-border text-xs text-ql-muted">
              <div>
                Showing <span className="font-semibold text-ql-text tabular-nums">{page * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-semibold text-ql-text tabular-nums">
                  {Math.min((page + 1) * PAGE_SIZE, total)}
                </span>{" "}
                of <span className="font-semibold text-ql-text tabular-nums">{total}</span> items
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-ql-border text-ql-muted hover:text-ql-text hover:bg-ql-surface disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium px-1 tabular-nums">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-ql-border text-ql-muted hover:text-ql-text hover:bg-ql-surface disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        initialData={editingTransaction}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingTransaction)}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Delete Transaction"
        message={
          deletingTransaction
            ? `Are you sure you want to delete this expense of ${formatCurrency(
                deletingTransaction.amount
              )} ${
                deletingTransaction.merchant
                  ? `from ${deletingTransaction.merchant}`
                  : ""
              }? This action cannot be undone.`
            : ""
        }
      />
    </div>
  );
}
