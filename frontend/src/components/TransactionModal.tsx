"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { Category, Transaction } from "@/types";
import { X, Loader2, DollarSign, Calendar, Store, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-ql-surface rounded-2xl shadow-lg border border-ql-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ql-border/60 bg-ql-bg/40">
          <h2 className="text-lg font-serif font-semibold text-ql-text">
            {initialData ? "Edit Transaction" : "Record Expense"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-ql-muted hover:text-ql-text hover:bg-ql-bg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {apiError && (
            <div className="p-3.5 rounded-xl bg-ql-error-light border border-ql-error/20 text-ql-error text-xs">
              {apiError}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Amount (THB) <span className="text-ql-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                <DollarSign className="w-4 h-4" />
              </span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm tabular-nums transition ${
                  errors.amount
                    ? "border-ql-error focus:ring-ql-error/30"
                    : "border-ql-border focus:ring-ql-primary/30 focus:border-ql-primary"
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {errors.amount && <p className="text-ql-error text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Date & Time <span className="text-ql-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="datetime-local"
                {...register("occurred_at")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                  errors.occurred_at
                    ? "border-ql-error focus:ring-ql-error/30"
                    : "border-ql-border focus:ring-ql-primary/30 focus:border-ql-primary"
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {errors.occurred_at && (
              <p className="text-ql-error text-xs mt-1">{errors.occurred_at.message}</p>
            )}
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Merchant / Payee
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                <Store className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. 7-Eleven, Starbucks, BTS"
                {...register("merchant")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                  errors.merchant
                    ? "border-ql-error focus:ring-ql-error/30"
                    : "border-ql-border focus:ring-ql-primary/30 focus:border-ql-primary"
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {errors.merchant && <p className="text-ql-error text-xs mt-1">{errors.merchant.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Category
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                <Tag className="w-4 h-4" />
              </span>
              <select
                {...register("category_id")}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ql-border bg-ql-surface text-ql-text text-sm focus:ring-ql-primary/30 focus:border-ql-primary focus:outline-none focus:ring-2 transition"
              >
                <option value="">-- Uncategorized (Auto-learn if matched) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-ql-muted mt-1">
              Selecting a category will remember the merchant rule automatically.
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Note (Optional)
            </label>
            <div className="relative">
              <span className="absolute top-3 left-3.5 pointer-events-none text-ql-muted">
                <FileText className="w-4 h-4" />
              </span>
              <textarea
                rows={2}
                placeholder="Additional memo or details..."
                {...register("note")}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ql-border bg-ql-surface text-ql-text text-sm focus:ring-ql-primary/30 focus:border-ql-primary focus:outline-none focus:ring-2 transition"
              />
            </div>
            {errors.note && <p className="text-ql-error text-xs mt-1">{errors.note.message}</p>}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-ql-border/60">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : initialData ? (
                "Save Changes"
              ) : (
                "Record Expense"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
