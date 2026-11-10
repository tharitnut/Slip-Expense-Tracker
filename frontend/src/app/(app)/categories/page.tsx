"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Category } from "@/types";
import { CategoryModal } from "@/components/CategoryModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Card, Button } from "@/components/ui";
import {
  Plus,
  Tag,
  Pencil,
  Trash2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Layers,
} from "lucide-react";

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  // Search filter
  const [search, setSearch] = useState("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Categories
  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  // Filtered categories
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await api.delete(`/categories/${deletingCategory.id}`);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
      setDeletingCategory(null);
    } catch {
      // error handled in toast / modal
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ql-border/60">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text tracking-tight">Spending Categories</h1>
          <p className="text-ql-muted text-sm mt-0.5">
            Organize transactions and configure auto-categorization tags
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAddModal}
          className="shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </Button>
      </div>

      {/* Search Bar */}
      {categories.length > 0 && (
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-ql-border bg-ql-surface text-sm text-ql-text placeholder:text-ql-muted focus:outline-none focus:ring-2 focus:ring-ql-primary/30 focus:border-ql-primary transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ql-muted hover:text-ql-text transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 bg-ql-border/60 rounded-xl" />
                <div className="w-12 h-5 bg-ql-border/40 rounded-lg" />
              </div>
              <div className="h-4 bg-ql-border/50 rounded w-28" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        /* Error State */
        <Card className="p-8 text-center space-y-3 border-ql-error/30">
          <AlertCircle className="w-8 h-8 text-ql-error mx-auto" />
          <h3 className="text-base font-semibold text-ql-text">Failed to load categories</h3>
          <p className="text-xs text-ql-muted">Please check your connection and try again.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </Button>
        </Card>
      ) : filteredCategories.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-ql-primary-light text-ql-primary flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-serif font-semibold text-ql-text">No categories found</h3>
            <p className="text-xs text-ql-muted mt-1 max-w-sm mx-auto">
              {search
                ? `No categories match "${search}". Try clearing search.`
                : "No categories exist yet. Create your first category to start organizing your spending."}
            </p>
          </div>
          {search ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearch("")}
            >
              Clear Search
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
            >
              <Plus className="w-4 h-4" />
              <span>Create Category</span>
            </Button>
          )}
        </Card>
      ) : (
        /* Categories Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <Card
              key={cat.id}
              className="group p-5 hover:border-ql-primary/40 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-ql-primary-light text-ql-primary flex items-center justify-center shrink-0 group-hover:bg-ql-primary group-hover:text-white transition-colors">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-ql-text text-sm truncate">
                    {cat.name}
                  </h3>
                  <span className="text-[11px] text-ql-muted">Category #{cat.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                <button
                  onClick={() => handleOpenEditModal(cat)}
                  title="Rename"
                  className="p-1.5 rounded-lg text-ql-muted hover:text-ql-primary hover:bg-ql-primary-light transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeletingCategory(cat)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-ql-muted hover:text-ql-error hover:bg-ql-error-light transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Rename Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialCategory={editingCategory}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Delete Category"
        message={
          deletingCategory
            ? `Are you sure you want to delete "${deletingCategory.name}"? Transactions assigned to this category will become Uncategorized. This action cannot be undone.`
            : ""
        }
      />
    </div>
  );
}
