"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { Category } from "@/types";
import { X, Loader2, Tag } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900">
            {initialCategory ? "Rename Category" : "Add New Category"}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Tag className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="e.g. Groceries, Entertainment, Education"
                autoFocus
                {...register("name")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${
                  errors.name ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
                } focus:outline-none focus:ring-2 text-slate-900 text-sm`}
              />
            </div>
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
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
              ) : initialCategory ? (
                "Save Changes"
              ) : (
                "Create Category"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

