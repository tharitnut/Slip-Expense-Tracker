"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Category, ParsedSlip } from "@/types";
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Scan Bank Slip</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Upload a Thai transfer slip to automatically extract amount, date, and merchant details.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-full w-fit">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>In-memory OCR • Never stored</span>
        </div>
      </div>

      {/* Main Container */}
      {!parsedData && !isScanning && !isSaved && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/70"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">
                Click to upload or drag & drop bank slip
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports KBank, SCB, PromptPay, and other Thai transfer slips (PNG, JPG, WebP up to 5MB)
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              Want to see it in action without uploading your personal bank slip?
            </div>
            <button
              type="button"
              onClick={handleLoadSampleSlip}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Try with a sample slip</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to process slip</p>
                <p className="text-xs mt-0.5 text-red-600">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scanning State */}
      {isScanning && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
          {previewUrl && (
            <div className="relative w-48 h-60 rounded-xl overflow-hidden border border-slate-200 shadow-md">
              <Image
                src={previewUrl}
                alt="Scanning slip preview"
                fill
                unoptimized
                className="object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] animate-pulse flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-900">Scanning slip with OCR...</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Extracting transaction amount, date, merchant, and bank reference code in Thai & English.
            </p>
          </div>
        </div>
      )}

      {/* Review & Confirmation State */}
      {parsedData && !isSaved && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Header of review */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Review & Confirm Expense</h2>
                <p className="text-xs text-slate-500">
                  Verify the extracted details below before adding to your records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {parsedData.bank && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{parsedData.bank}</span>
                </span>
              )}
              {parsedData.slip_ref && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>{parsedData.slip_ref}</span>
                </span>
              )}
            </div>
          </div>

          {/* Missing fields notice if any */}
          {parsedData.missing_fields && parsedData.missing_fields.length > 0 && (
            <div className="m-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Some fields need your attention</p>
                <p className="mt-0.5 text-amber-700">
                  The OCR engine could not automatically extract:{" "}
                  <strong>{parsedData.missing_fields.join(", ")}</strong>. Please review and fill them in manually.
                </p>
              </div>
            </div>
          )}

          {/* Submit error alert (e.g. duplicate slip) */}
          {submitError && (
            <div className="m-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Cannot Save Transaction</p>
                <p className="mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Left: Slip Preview */}
            <div className="md:col-span-5 flex flex-col items-center">
              {previewUrl && (
                <div className="w-full max-w-[280px] bg-slate-100 rounded-2xl border border-slate-200 p-2 shadow-sm">
                  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-200/60">
                    <Image
                      src={previewUrl}
                      alt="Uploaded Slip"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between px-1">
                    <span className="text-xs text-slate-500 truncate max-w-[170px]">
                      {selectedFile?.name || "slip.png"}
                    </span>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Amount (THB) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 transition ${
                      parsedData.missing_fields.includes("amount")
                        ? "border-amber-400 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-200"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Transaction Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="datetime-local"
                    required
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 transition ${
                      parsedData.missing_fields.includes("occurred_at")
                        ? "border-amber-400 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-200"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />
                </div>
              </div>

              {/* Merchant / Payee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Merchant / Payee
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Store className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    maxLength={120}
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Cafe Amazon, 7-Eleven, Food Court"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Tag className="w-4 h-4" />
                  </span>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional memo..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              {/* Slip Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Slip Reference Code
                </label>
                <input
                  type="text"
                  value={slipRef}
                  onChange={(e) => setSlipRef(e.target.value)}
                  placeholder="e.g. KBANK20261025..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used by the duplicate detector to prevent recording the same slip twice.
                </p>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-sm hover:shadow disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Expense</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success State */}
      {isSaved && (
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-8 shadow-sm text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Expense Recorded Successfully!</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              The bank slip has been parsed and saved as a verified transaction.
            </p>
          </div>

          {/* Quick Summary Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 text-sm text-slate-700 flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-400 block">Amount</span>
              <span className="font-bold text-slate-900">THB {parseFloat(amount).toFixed(2)}</span>
            </div>
            {merchant && (
              <div className="border-l border-slate-200 pl-4">
                <span className="text-xs text-slate-400 block">Merchant</span>
                <span className="font-medium text-slate-800">{merchant}</span>
              </div>
            )}
            {slipRef && (
              <div className="border-l border-slate-200 pl-4">
                <span className="text-xs text-slate-400 block">Ref</span>
                <span className="font-mono text-xs text-slate-600">{slipRef}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Scan Another Slip</span>
            </button>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-sm hover:shadow"
            >
              <span>View in Transactions</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
