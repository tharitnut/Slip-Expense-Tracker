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
import { ThemeToggle } from "@/components/ThemeToggle";

const registerSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password cannot exceed 72 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setErrorMessage(null);
    try {
      // 1. Register with JSON
      await api.post("/auth/register", {
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      // 2. Auto-login with urlencoded form
      const body = new URLSearchParams();
      body.append("username", data.email.trim().toLowerCase());
      body.append("password", data.password);

      const loginRes = await api.post<{ access_token: string }>("/auth/login", body);
      await login(loginRes.access_token);
      router.push("/transactions");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage("This email is already registered. Please sign in or use another email.");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Connection error. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ql-bg relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md p-8 sm:p-10 shadow-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-ql-primary text-white flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-serif font-semibold text-ql-text">Create Account</h1>
          <p className="text-ql-muted text-xs mt-1">Start tracking expenses with Slip Tracker</p>
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
              Password (min. 8 characters)
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

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-ql-muted mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-ql-surface text-ql-text text-sm transition ${
                errors.confirmPassword
                  ? "border-ql-error focus:ring-ql-error/30"
                  : "border-ql-border focus:border-ql-primary focus:ring-ql-primary/30"
              } focus:outline-none focus:ring-2`}
            />
            {errors.confirmPassword && (
              <p className="text-ql-error text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
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
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <div className="mt-8 text-center text-xs text-ql-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-ql-primary font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
