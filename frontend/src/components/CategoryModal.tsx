"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { Category } from "@/types";
import { X, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui";

const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Category name is required")
    .max(60, "Category name cannot exceed 60 characters")
    .refine((val) => val.trim().length > 0, "Category name cannot be blank"),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: Category | null;
  onSuccess: () => void;
}

export function CategoryModal({
  isOpen,
  onClose,
  initialCategory,
  onSuccess,
}: CategoryModalProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        reset({ name: initialCategory.name });
      } else {
        reset({ name: "" });
      }
    }
  }, [isOpen, initialCategory, reset]);

  if (!isOpen) return null;

  const handleClose = () => {
    setApiError(null);
    onClose();
  };

  const onSubmit = async (data: CategoryFormData) => {
    setApiError(null);
    try {
      const trimmedName = data.name.trim();

      if (initialCategory) {
        await api.patch(`/categories/${initialCategory.id}`, { name: trimmedName });
      } else {
        await api.post("/categories", { name: trimmedName });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setApiError("A category with this name already exists.");
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError("Failed to save category. Please try again.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-ql-surface rounded-2xl shadow-lg border border-ql-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ql-border/60 bg-ql-bg/40">
          <h2 className="text-lg font-serif font-semibold text-ql-text">
            {initialCategory ? "Rename Category" : "New Category"}
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

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Category Name <span className="text-ql-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                <Tag className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. Groceries, Coffee, Commute"
                autoFocus
                {...register("name")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                  errors.name
                    ? "border-ql-error focus:ring-ql-error/30"
                    : "border-ql-border focus:ring-ql-primary/30 focus:border-ql-primary"
                } focus:outline-none focus:ring-2`}
              />
            </div>
            {errors.name && <p className="text-ql-error text-xs mt-1">{errors.name.message}</p>}
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
              ) : initialCategory ? (
                "Save Changes"
              ) : (
                "Create Category"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
