"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Wallet, Loader2, ArrowRight } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { AuthEditorialShell } from "@/components/AuthEditorialShell";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      // Backend expects OAuth2 form-data / application/x-www-form-urlencoded
      const body = new URLSearchParams();
      body.append("username", data.email.trim().toLowerCase());
      body.append("password", data.password);

      const res = await api.post<{ access_token: string }>("/auth/login", body);
      await login(res.access_token);
      if (data.email.trim().toLowerCase() === "demo@example.com") {
        await seedDemoData();
      }
      router.push("/transactions");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage("Incorrect email or password");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Connection error. Please try again.");
      }
    }
  };

  const seedDemoData = async () => {
    try {
      const txRes = await api.get<{
        items: { merchant: string | null; category_id: number | null }[];
        total: number;
      }>("/transactions?limit=100");

      const catsRes = await api.get<{ id: number; name: string }[]>("/categories");
      const catMap = new Map(catsRes.map((c) => [c.name, c.id]));

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const todayDay = now.getDate();

      interface SeedItem {
        dayOffset: number;
        time: string;
        amount: number;
        merchant: string;
        cat: string | null;
        note: string;
        source: "manual" | "slip";
        ref?: string;
      }

      // Realistic seed transactions with safe past/present dates
      const seedItems: SeedItem[] = [
        { dayOffset: 0, time: "08:30:00", amount: 85.0, merchant: "Café Amazon", cat: "Food", note: "Iced Americano", source: "slip", ref: "DEMO-SLIP-01" },
        { dayOffset: 1, time: "09:15:00", amount: 62.0, merchant: "BTS Skytrain", cat: "Transportation", note: "Rabbit card top-up", source: "manual" },
        { dayOffset: 1, time: "19:45:00", amount: 150.0, merchant: "Somchai K. (PromptPay)", cat: null, note: "Dinner transfer with friend", source: "slip", ref: "DEMO-SLIP-05" },
        { dayOffset: 2, time: "18:40:00", amount: 480.0, merchant: "Tops Market", cat: "Shopping", note: "Groceries & fresh fruits", source: "slip", ref: "DEMO-SLIP-02" },
        { dayOffset: 3, time: "12:15:00", amount: 135.0, merchant: "Somtam Jay So", cat: "Food", note: "Team lunch", source: "manual" },
        { dayOffset: 4, time: "14:20:00", amount: 890.0, merchant: "MEA Electricity", cat: "Bills & Utilities", note: "Monthly utilities", source: "slip", ref: "DEMO-SLIP-03" },
        { dayOffset: 5, time: "20:00:00", amount: 280.0, merchant: "Major Cineplex", cat: "Entertainment", note: "Weekend movie", source: "manual" },
        { dayOffset: 6, time: "11:30:00", amount: 245.0, merchant: "Boots Pharmacy", cat: "Health", note: "Vitamins & personal care", source: "slip", ref: "DEMO-SLIP-04" },
      ];

      if (txRes.total === 0) {
        for (const item of seedItems) {
          const targetDay = Math.max(1, todayDay - item.dayOffset);
          const dayStr = String(targetDay).padStart(2, "0");

          await api.post("/transactions", {
            amount: item.amount,
            occurred_at: `${y}-${m}-${dayStr}T${item.time}`,
            merchant: item.merchant,
            category_id: item.cat ? (catMap.get(item.cat) ?? null) : null,
            note: item.note,
            source: item.source,
            slip_ref: item.ref ?? null,
          });
        }
      } else {
        // Ensure any missing seed items (e.g. Uncategorized item) are backfilled
        const existingMerchants = new Set(txRes.items.map((t) => t.merchant));
        for (const item of seedItems) {
          if (!existingMerchants.has(item.merchant)) {
            const targetDay = Math.max(1, todayDay - item.dayOffset);
            const dayStr = String(targetDay).padStart(2, "0");
            try {
              await api.post("/transactions", {
                amount: item.amount,
                occurred_at: `${y}-${m}-${dayStr}T${item.time}`,
                merchant: item.merchant,
                category_id: item.cat ? (catMap.get(item.cat) ?? null) : null,
                note: item.note,
                source: item.source,
                slip_ref: item.ref ?? null,
              });
            } catch {
              // Ignore duplicates or network errors
            }
          }
        }
      }

      // Set realistic budget target for the month
      const budgetKey = `budget_${y}-${m}`;
      if (!localStorage.getItem(budgetKey)) {
        localStorage.setItem(budgetKey, "8000");
        window.dispatchEvent(new Event("storage"));
      }
    } catch {
      // Non-critical background seed
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    setErrorMessage(null);
    const demoEmail = "demo@example.com";
    const demoPassword = "demouser123";

    try {
      const doLogin = async () => {
        const body = new URLSearchParams();
        body.append("username", demoEmail);
        body.append("password", demoPassword);
        return await api.post<{ access_token: string }>("/auth/login", body);
      };

      let res: { access_token: string };
      try {
        res = await doLogin();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // If demo account doesn't exist yet, auto-register
          await api.post("/auth/register", {
            email: demoEmail,
            password: demoPassword,
          });
          res = await doLogin();
        } else {
          throw err;
        }
      }

      await login(res.access_token);
      await seedDemoData();
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to log in with demo account.");
      } else {
        setErrorMessage("Connection error. Please try again.");
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <AuthEditorialShell>
      <Card className="w-full max-w-md p-8 sm:p-10 shadow-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-ql-primary text-white flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text">Slip Tracker</h1>
          <p className="text-ql-muted text-xs mt-1">Sign in to your expense tracker</p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-ql-error-light border border-ql-error/20 text-ql-error text-xs">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ql-muted mb-1.5">
              Email address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              {...register("email")}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                errors.email
                  ? "border-ql-error focus:ring-ql-error/30"
                  : "border-ql-border focus:border-ql-primary focus:ring-ql-primary/30"
              } focus:outline-none focus:ring-2`}
            />
            {errors.email && <p className="text-ql-error text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-ql-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                errors.password
                  ? "border-ql-error focus:ring-ql-error/30"
                  : "border-ql-border focus:border-ql-primary focus:ring-ql-primary/30"
              } focus:outline-none focus:ring-2`}
            />
            {errors.password && <p className="text-ql-error text-xs mt-1">{errors.password.message}</p>}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting || isDemoLoading}
            className="w-full mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ql-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-ql-surface px-2.5 text-ql-muted">
              Or test drive
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={isSubmitting || isDemoLoading}
          onClick={handleDemoLogin}
          className="w-full flex items-center justify-center gap-2 border-ql-border text-ql-text hover:bg-ql-primary-light"
        >
          {isDemoLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparing Demo Account...
            </>
          ) : (
            <>
              <span>Explore Demo Account</span>
              <ArrowRight className="w-4 h-4 text-ql-muted" />
            </>
          )}
        </Button>

        <div className="mt-8 text-center text-xs text-ql-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-ql-primary font-medium hover:underline">
            Create account
          </Link>
        </div>
      </Card>
    </AuthEditorialShell>
  );
}
