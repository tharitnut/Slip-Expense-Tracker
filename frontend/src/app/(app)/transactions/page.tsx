"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Category, Transaction, TransactionPage } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { TransactionModal } from "@/components/TransactionModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  Plus,
  Search,
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
      setDeletingTransaction(null);
    } catch {
      // error handled in alert or toast
    } finally {
      setIsDeleting(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transactions</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            View, filter, and manage your personal spending records
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search merchant or note..."
              className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPage(0);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Month Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="w-4 h-4" />
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
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
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Filter className="w-4 h-4" />
            </span>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-900 bg-white"
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
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtering active</span>
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Skeletons */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center justify-between py-3 px-2 border-b border-slate-100 last:border-0">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-36" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
              <div className="h-5 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </div>
      ) : isError ? (
        /* Error State */
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900">Failed to load transactions</h3>
          <p className="text-sm text-slate-500">Please check your network connection or server status.</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      ) : transactions.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">No transactions found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No transactions match your current filters. Try resetting them or search for something else."
                : "You haven't added any expense records yet. Click the button below to add your first expense!"}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Expense</span>
            </button>
          )}
        </div>
      ) : (
        /* Data Display: Desktop Table + Mobile Cards */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Merchant & Note</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition group">
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900 text-xs">
                      {formatDisplayDate(tx.occurred_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">
                        {tx.merchant || <span className="text-slate-400 italic">No merchant</span>}
                      </div>
                      {tx.note && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tx.note}</div>}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tx.category_id && categoryMap.has(tx.category_id) ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {categoryMap.get(tx.category_id)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-100">
                          Uncategorized
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {tx.source === "slip" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          <FileCheck2 className="w-3 h-3" />
                          Slip
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold text-slate-900">
                      -{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleOpenEditModal(tx)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingTransaction(tx)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {tx.merchant || <span className="text-slate-400 italic">No merchant</span>}
                    </h4>
                    <span className="text-xs text-slate-400">{formatDisplayDate(tx.occurred_at)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-base">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>

                {tx.note && <p className="text-xs text-slate-600">{tx.note}</p>}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {tx.category_id && categoryMap.has(tx.category_id) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {categoryMap.get(tx.category_id)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-100">
                        Uncategorized
                      </span>
                    )}

                    {tx.source === "slip" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        <FileCheck2 className="w-2.5 h-2.5" />
                        Slip
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(tx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingTransaction(tx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold">{page * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-semibold">
                  {Math.min((page + 1) * PAGE_SIZE, total)}
                </span>{" "}
                of <span className="font-semibold">{total}</span> items
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium px-1">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
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
