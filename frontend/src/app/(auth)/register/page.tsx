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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-md shadow-blue-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create an Account</h1>
          <p className="text-slate-500 text-sm mt-1">Start tracking your expenses effortlessly</p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              placeholder="name@example.com"
              {...register("email")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.email ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              } focus:outline-none focus:ring-2 transition text-slate-900 text-sm`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password (min. 8 characters)</label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.password ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              } focus:outline-none focus:ring-2 transition text-slate-900 text-sm`}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={`w-full px-4 py-2.5 rounded-xl border ${
                errors.confirmPassword ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              } focus:outline-none focus:ring-2 transition text-slate-900 text-sm`}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm hover:shadow flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
