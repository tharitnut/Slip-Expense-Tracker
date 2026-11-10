"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Category, ParsedSlip } from "@/types";
import { Card, Button, Badge } from "@/components/ui";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Building2,
  Hash,
  Store,
  DollarSign,
  Calendar,
  Tag,
} from "lucide-react";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatToInputDateTime(isoStr?: string | null): string {
  if (!isoStr) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  return isoStr.slice(0, 16);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function UploadSlipPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
  });

  // Flow states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedSlip | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form states for confirmation
  const [amount, setAmount] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [merchant, setMerchant] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [slipRef, setSlipRef] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetAll = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsScanning(false);
    setParsedData(null);
    setIsSaved(false);
    setErrorMessage(null);
    setSubmitError(null);
    setAmount("");
    setOccurredAt("");
    setMerchant("");
    setCategoryId("");
    setNote("");
    setSlipRef("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleProcessFile = async (file: File) => {
    setErrorMessage(null);
    setSubmitError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("Image file is too large. Maximum size allowed is 5 MB.");
      return;
    }

    // Set file & preview
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsScanning(true);
    setParsedData(null);
    setIsSaved(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await api.post<ParsedSlip>("/slips/parse", formData);
      setParsedData(result);

      // Populate form fields
      setAmount(result.amount !== null && result.amount !== undefined ? String(result.amount) : "");
      setOccurredAt(formatToInputDateTime(result.occurred_at));
      setMerchant(result.merchant || "");
      setSlipRef(result.slip_ref || "");
      setNote("");
      setCategoryId("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to process slip with OCR. Please try another image or enter manually.");
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleLoadSampleSlip = async () => {
    setErrorMessage(null);
    try {
      const response = await fetch("/sample_slip.png");
      if (!response.ok) {
        throw new Error("Sample slip not found");
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], "sample_kbank_slip.png", { type: "image/png" });
      handleProcessFile(sampleFile);
    } catch {
      setErrorMessage("Could not load sample slip. Please upload an image directly.");
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const parsedNum = parseFloat(amount);
    if (isNaN(parsedNum) || parsedNum <= 0) {
      setSubmitError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!occurredAt) {
      setSubmitError("Please specify the transaction date and time.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = occurredAt.length === 16 ? `${occurredAt}:00` : occurredAt;

      await api.post("/transactions", {
        amount: parsedNum,
        occurred_at: formattedDate,
        merchant: merchant.trim() || null,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        note: note.trim() || null,
        source: "slip",
        slip_ref: slipRef.trim() || null,
      });

      // Invalidate queries so transactions list updates
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-summary"] });

      setIsSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to record transaction. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-ql-border/60">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text tracking-tight">Scan Transfer Slip</h1>
          <p className="text-ql-muted text-sm mt-0.5">
            Extract payee, date, amount, and reference code automatically from Thai slips
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-ql-primary bg-ql-primary-light border border-ql-primary/20 px-3 py-1.5 rounded-full w-fit">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>In-memory OCR • Never persisted</span>
        </div>
      </div>

      {/* Main Container */}
      {!parsedData && !isScanning && !isSaved && (
        <Card className="p-6 md:p-8 space-y-6">
          {/* Dropzone with signature dashed receipt styling */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer receipt-border rounded-2xl p-8 md:p-12 text-center transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-ql-primary bg-ql-primary-light/40 scale-[0.99]"
                : "bg-ql-bg/40 hover:bg-ql-bg/80 hover:border-ql-primary/60"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-ql-primary-light text-ql-primary flex items-center justify-center">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ql-text">
                Click to upload or drag & drop slip image
              </p>
              <p className="text-xs text-ql-muted mt-1 max-w-sm mx-auto">
                Supports KBank, SCB, PromptPay, and other Thai bank slips (JPEG, PNG, WebP up to 5MB)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Quick Demo Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-ql-border/40">
            <div className="text-xs text-ql-muted text-center sm:text-left">
              Want to test the OCR without uploading a personal bank slip?
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLoadSampleSlip}
              className="gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-ql-accent" />
              <span>Try sample slip</span>
            </Button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-ql-error-light border border-ql-error/20 text-ql-error text-xs flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to process slip</p>
                <p className="mt-0.5 text-ql-error/90">{errorMessage}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Scanning State */}
      {isScanning && (
        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
          {previewUrl && (
            <div className="relative w-44 h-56 rounded-xl overflow-hidden border border-ql-border shadow-xs">
              <Image
                src={previewUrl}
                alt="Scanning slip preview"
                fill
                unoptimized
                className="object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-ql-primary/10 backdrop-blur-[1px] animate-pulse flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-ql-primary animate-spin" />
              </div>
            </div>
          )}
          <div>
            <h3 className="text-base font-serif font-semibold text-ql-text">Analyzing Slip with OCR...</h3>
            <p className="text-xs text-ql-muted max-w-sm mt-1">
              Parsing Thai Buddhist era year, bank identifiers, merchant name, and transfer amount.
            </p>
          </div>
        </Card>
      )}

      {/* Review & Confirmation State (Signature Receipt Card) */}
      {parsedData && !isSaved && (
        <Card variant="receipt" padding="none" className="overflow-hidden bg-ql-surface">
          {/* Header of review */}
          <div className="p-5 border-b border-ql-border/60 bg-ql-bg/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-ql-primary text-white flex items-center justify-center font-bold text-sm">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-serif font-semibold text-ql-text">Review Slip Details</h2>
                <p className="text-xs text-ql-muted">
                  Confirm the extracted information before adding to your records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {parsedData.bank && (
                <Badge variant="primary" className="gap-1">
                  <Building2 className="w-3 h-3" />
                  <span>{parsedData.bank}</span>
                </Badge>
              )}
              {parsedData.slip_ref && (
                <Badge variant="default" className="font-mono gap-1 text-[11px]">
                  <Hash className="w-3 h-3" />
                  <span>{parsedData.slip_ref}</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Missing fields notice if any */}
          {parsedData.missing_fields && parsedData.missing_fields.length > 0 && (
            <div className="m-5 p-3.5 rounded-xl bg-ql-accent-light border border-ql-accent/30 text-ql-accent text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-ql-accent" />
              <div>
                <p className="font-semibold text-ql-text">Attention needed</p>
                <p className="mt-0.5 text-ql-muted">
                  The OCR engine could not automatically extract:{" "}
                  <strong>{parsedData.missing_fields.join(", ")}</strong>. Please review and fill them in manually.
                </p>
              </div>
            </div>
          )}

          {/* Submit error alert (e.g. duplicate slip) */}
          {submitError && (
            <div className="m-5 p-4 rounded-xl bg-ql-error-light border border-ql-error/20 text-ql-error text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Cannot Record Expense</p>
                <p className="mt-0.5 text-ql-error/90">{submitError}</p>
              </div>
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Slip Preview */}
            <div className="md:col-span-5 flex flex-col items-center">
              {previewUrl && (
                <div className="w-full max-w-[260px] bg-ql-bg/60 rounded-xl border border-ql-border p-2">
                  <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-ql-surface border border-ql-border/40">
                    <Image
                      src={previewUrl}
                      alt="Uploaded Slip"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between px-1 text-xs">
                    <span className="text-ql-muted truncate max-w-[150px]">
                      {selectedFile?.name || "slip.png"}
                    </span>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="text-ql-primary hover:underline font-medium cursor-pointer"
                    >
                      Change slip
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Confirmation Form */}
            <form onSubmit={handleSaveTransaction} className="md:col-span-7 space-y-4">
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
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-semibold text-ql-text tabular-nums bg-ql-surface focus:outline-none focus:ring-2 transition ${
                      parsedData.missing_fields.includes("amount")
                        ? "border-ql-accent bg-ql-accent-light/30 focus:ring-ql-accent/30"
                        : "border-ql-border focus:border-ql-primary focus:ring-ql-primary/30"
                    }`}
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
                  Transaction Date & Time <span className="text-ql-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ql-muted">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="datetime-local"
                    required
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-ql-text bg-ql-surface focus:outline-none focus:ring-2 transition ${
                      parsedData.missing_fields.includes("occurred_at")
                        ? "border-ql-accent bg-ql-accent-light/30 focus:ring-ql-accent/30"
                        : "border-ql-border focus:border-ql-primary focus:ring-ql-primary/30"
                    }`}
                  />
                </div>
              </div>

              {/* Merchant / Payee */}
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
                    maxLength={120}
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Cafe Amazon, 7-Eleven, Food Court"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ql-border text-sm text-ql-text bg-ql-surface focus:outline-none focus:border-ql-primary focus:ring-2 focus:ring-ql-primary/30 transition"
                  />
                </div>
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
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ql-border text-sm text-ql-text bg-ql-surface focus:outline-none focus:border-ql-primary focus:ring-2 focus:ring-ql-primary/30 transition cursor-pointer"
                  >
                    <option value="">Uncategorised (Auto-rule or None)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
                  Memo / Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full px-4 py-2.5 rounded-xl border border-ql-border text-sm text-ql-text bg-ql-surface focus:outline-none focus:border-ql-primary focus:ring-2 focus:ring-ql-primary/30 transition"
                />
              </div>

              {/* Slip Reference */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
                  Slip Reference Code
                </label>
                <input
                  type="text"
                  value={slipRef}
                  onChange={(e) => setSlipRef(e.target.value)}
                  placeholder="e.g. KBANK20261025..."
                  className="w-full px-4 py-2 rounded-xl border border-ql-border text-xs font-mono text-ql-text bg-ql-bg focus:outline-none focus:border-ql-primary focus:ring-2 focus:ring-ql-primary/30 transition"
                />
                <p className="text-[11px] text-ql-muted mt-1">
                  Unique bank reference identifier used for duplicate prevention.
                </p>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-ql-border/60">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={resetAll}
                  disabled={isSubmitting}
                >
                  Discard
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
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Expense</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      )}

      {/* Success State */}
      {isSaved && (
        <Card className="p-8 text-center flex flex-col items-center justify-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-ql-success-light text-ql-success flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-serif font-semibold text-ql-text">Expense Recorded Successfully</h2>
            <p className="text-xs text-ql-muted mt-1 max-w-md">
              The transfer slip has been parsed and logged as a verified transaction entry.
            </p>
          </div>

          {/* Quick Summary Pill */}
          <div className="bg-ql-bg/80 border border-ql-border rounded-xl px-6 py-3 text-sm text-ql-text flex items-center gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-ql-muted block">Amount</span>
              <span className="font-semibold text-ql-text tabular-nums">{formatCurrency(parseFloat(amount) || 0)}</span>
            </div>
            {merchant && (
              <div className="border-l border-ql-border pl-4">
                <span className="text-[10px] uppercase tracking-wider text-ql-muted block">Merchant</span>
                <span className="font-medium text-ql-text">{merchant}</span>
              </div>
            )}
            {slipRef && (
              <div className="border-l border-ql-border pl-4">
                <span className="text-[10px] uppercase tracking-wider text-ql-muted block">Ref</span>
                <span className="font-mono text-xs text-ql-muted">{slipRef}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={resetAll}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Scan Another Slip</span>
            </Button>
            <Link href="/transactions">
              <Button variant="primary" size="md" className="gap-2">
                <span>View Transactions</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
