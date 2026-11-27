import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileCheck2 } from "lucide-react";

/**
 * Split editorial shell for authentication pages:
 * displays a calm Quiet Ledger receipt preview on desktop alongside the form.
 */
export function AuthEditorialShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-ql-bg relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Desktop Editorial Preview */}
        <div className="hidden lg:flex lg:col-span-6 flex-col gap-6 pr-4">
          <div className="space-y-3">
            <h2 className="text-3xl font-serif font-semibold text-ql-text tracking-tight leading-snug">
              Thai bank slips, turned into a quiet monthly ledger.
            </h2>
            <p className="text-sm text-ql-muted leading-relaxed max-w-md">
              Upload transfer slips from KBank, SCB, or PromptPay, auto-categorize merchants, and review monthly spending in one place.
            </p>
          </div>

          <div className="receipt-border rounded-2xl bg-ql-surface/85 p-6 space-y-4 max-w-md">
            <div className="flex items-center justify-between text-xs text-ql-muted pb-3 border-b border-ql-border/60">
              <span className="font-mono">Sample ledger · Nov 2026</span>
              <span className="inline-flex items-center gap-1 text-ql-accent font-medium">
                <FileCheck2 className="w-3.5 h-3.5" />
                In-memory OCR
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ql-text">Café Amazon</p>
                  <p className="text-xs text-ql-muted">Food · Verified slip</p>
                </div>
                <span className="font-medium text-ql-text tabular-nums">-THB 85.00</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ql-text">MEA Electricity</p>
                  <p className="text-xs text-ql-muted">Bills &amp; Utilities · Verified slip</p>
                </div>
                <span className="font-medium text-ql-text tabular-nums">-THB 890.00</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ql-text">Tops Market</p>
                  <p className="text-xs text-ql-muted">Shopping · Verified slip</p>
                </div>
                <span className="font-medium text-ql-text tabular-nums">-THB 480.00</span>
              </div>
            </div>

            <div className="pt-3 border-t border-dashed border-ql-border flex items-baseline justify-between">
              <span className="text-xs text-ql-muted">Monthly budget remaining</span>
              <span className="text-base font-serif font-semibold text-ql-primary tabular-nums">
                THB 5,668.00
              </span>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="lg:col-span-6 flex justify-center w-full">{children}</div>
      </div>
    </div>
  );
}
