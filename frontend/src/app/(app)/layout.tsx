"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import {
  Wallet,
  ReceiptText,
  ScanLine,
  Tags,
  LayoutDashboard,
  LogOut,
  Loader2,
  User as UserIcon,
  Keyboard,
} from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, token, isLoading, logout } = useAuth();
  const { toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      router.push("/login");
    }
  }, [isLoading, user, token, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl && activeEl.getAttribute("contenteditable") === "true");

      if (isTyping) return;

      // Ignore modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (key === "d") {
        e.preventDefault();
        router.push("/dashboard");
      } else if (key === "t") {
        e.preventDefault();
        router.push("/transactions");
      } else if (key === "u") {
        e.preventDefault();
        router.push("/upload");
      } else if (key === "c") {
        e.preventDefault();
        router.push("/categories");
      } else if (key === "m") {
        e.preventDefault();
        toggleTheme();
      } else if (key === "n") {
        e.preventDefault();
        if (pathname === "/transactions") {
          window.dispatchEvent(new CustomEvent("open-new-transaction"));
        } else {
          router.push("/transactions?action=new");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname, toggleTheme]);

  const navItems = [
    { label: "Transactions", href: "/transactions", icon: ReceiptText },
    { label: "Scan Slip", href: "/upload", icon: ScanLine },
    { label: "Categories", href: "/categories", icon: Tags },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-ql-bg pb-20 md:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-ql-surface focus:text-ql-text focus:border focus:border-ql-border focus:shadow-md text-xs font-medium"
      >
        Skip to main content
      </a>
      {/* Top Navbar for desktop & tablet */}
      <header className="sticky top-0 z-40 bg-ql-surface/90 backdrop-blur-md border-b border-ql-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/transactions" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-ql-primary text-white flex items-center justify-center transition-colors group-hover:bg-ql-primary-hover">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-base font-serif font-semibold tracking-tight text-ql-text">Slip Tracker</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "text-ql-primary font-semibold"
                        : "text-ql-muted hover:text-ql-text hover:bg-ql-bg/70 rounded-lg"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-ql-accent rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Keyboard shortcuts trigger */}
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-ql-muted hover:text-ql-text hover:bg-ql-bg/80 border border-ql-border/60 transition-colors cursor-pointer"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono font-semibold">?</span>
            </button>

            <ThemeToggle />

            {user ? (
              <div className="hidden sm:flex items-center gap-2 text-xs text-ql-muted bg-ql-bg border border-ql-border px-3 py-1.5 rounded-full">
                <UserIcon className="w-3 h-3 text-ql-muted" />
                <span className="font-medium max-w-[160px] truncate">{user.email}</span>
              </div>
            ) : null}

            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ql-error hover:text-ql-error/90 hover:bg-ql-error-light rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-[1100px] w-full mx-auto px-4 sm:px-6 py-6">
        {isLoading || !user ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center">
            <Loader2 className="w-7 h-7 text-ql-primary animate-spin mb-3" />
            <p className="text-ql-muted text-sm font-medium">Loading application...</p>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (thumb friendly) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ql-surface/95 backdrop-blur-md border-t border-ql-border px-2 py-1 flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                isActive ? "text-ql-primary font-semibold" : "text-ql-muted hover:text-ql-text"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-ql-accent mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Global Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        open={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
