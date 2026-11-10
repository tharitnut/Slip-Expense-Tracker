"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Wallet, Loader2 } from "lucide-react";
import { Card, Button } from "@/components/ui";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ql-bg">
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
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
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
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
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
            disabled={isSubmitting}
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

        <div className="mt-8 text-center text-xs text-ql-muted">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-ql-primary font-medium hover:underline">
            Create account
          </Link>
        </div>
      </Card>
    </div>
  );
}
