"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { Category, Transaction } from "@/types";
import { X, Loader2, DollarSign, Calendar, Store, Tag, FileText } from "lucide-react";

const transactionSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0")
    .refine(
      (val) => /^\d+(\.\d{1,2})?$/.test(val),
      "Amount must have at most 2 decimal places"
    ),
  occurred_at: z.string().min(1, "Date and time are required"),
  merchant: z.string().max(120, "Merchant name cannot exceed 120 characters").optional(),
  category_id: z.string().optional(),
  note: z.string().max(500, "Note cannot exceed 500 characters").optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

function getLocalCurrentDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialData?: Transaction | null;
  onSuccess: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  categories,
  initialData,
  onSuccess,
}: TransactionModalProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      occurred_at: getLocalCurrentDateTime(),
      merchant: "",
      category_id: "",
      note: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          amount: String(initialData.amount),
          occurred_at: initialData.occurred_at.slice(0, 16),
          merchant: initialData.merchant || "",
          category_id: initialData.category_id ? String(initialData.category_id) : "",
          note: initialData.note || "",
        });
      } else {
        reset({
          amount: "",
          occurred_at: getLocalCurrentDateTime(),
          merchant: "",
          category_id: "",
          note: "",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  const onSubmit = async (data: TransactionFormData) => {
    setApiError(null);
    try {
      // Local time string WITHOUT timezone, appending :00 as required
      const formattedDate = data.occurred_at.length === 16 ? `${data.occurred_at}:00` : data.occurred_at;

      const payload = {
        amount: parseFloat(data.amount),
        occurred_at: formattedDate,
        merchant: data.merchant?.trim() || null,
        category_id: data.category_id ? parseInt(data.category_id, 10) : null,
        note: data.note?.trim() || null,
      };

      if (initialData) {
        await api.patch(`/transactions/${initialData.id}`, payload);
      } else {
        await api.post("/transactions", {
          ...payload,
          source: "manual",
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError("Failed to save transaction. Please try again.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">
            {initialData ? "Edit Transaction" : "Add New Expense"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {apiError}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount (THB) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4" />
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                  errors.amount ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
                } focus:outline-none focus:ring-2 text-slate-900 text-sm`}
              />
            </div>
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="datetime-local"
                {...register("occurred_at")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                  errors.occurred_at
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-200 focus:ring-blue-500"
                } focus:outline-none focus:ring-2 text-slate-900 text-sm`}
              />
            </div>
            {errors.occurred_at && (
              <p className="text-red-500 text-xs mt-1">{errors.occurred_at.message}</p>
            )}
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Merchant / Store
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Store className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. 7-Eleven, Starbucks, BTS"
                {...register("merchant")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                  errors.merchant ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
                } focus:outline-none focus:ring-2 text-slate-900 text-sm`}
              />
            </div>
            {errors.merchant && <p className="text-red-500 text-xs mt-1">{errors.merchant.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Tag className="w-4 h-4" />
              </span>
              <select
                {...register("category_id")}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-blue-500 focus:outline-none focus:ring-2 text-slate-900 text-sm bg-white"
              >
                <option value="">-- Uncategorized (Auto-learn if matched) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tip: When you assign a category to a merchant, future transactions from that merchant will be auto-categorized!
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (Optional)</label>
            <div className="relative">
              <span className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </span>
              <textarea
                rows={2}
                placeholder="Additional details..."
                {...register("note")}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-blue-500 focus:outline-none focus:ring-2 text-slate-900 text-sm"
              />
            </div>
            {errors.note && <p className="text-red-500 text-xs mt-1">{errors.note.message}</p>}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : initialData ? (
                "Save Changes"
              ) : (
                "Add Expense"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
