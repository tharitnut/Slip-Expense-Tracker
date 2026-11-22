"use client";

import { Modal } from "@/components/ui";
import { Keyboard, Navigation, Zap } from "lucide-react";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  label: string;
  description: string;
}

const navigationShortcuts: ShortcutItem[] = [
  { key: "D", label: "Dashboard", description: "View monthly summary and trends" },
  { key: "T", label: "Transactions", description: "Open expense ledger table" },
  { key: "U", label: "Scan Slip", description: "Upload bank transfer slip" },
  { key: "C", label: "Categories", description: "Manage expense categories" },
];

const actionShortcuts: ShortcutItem[] = [
  { key: "N", label: "New Expense", description: "Open transaction creator" },
  { key: "M", label: "Toggle Theme", description: "Switch light / dark mode" },
  { key: "?", label: "Shortcuts", description: "Toggle this cheatsheet modal" },
  { key: "Esc", label: "Dismiss", description: "Close any open dialog" },
];

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" maxWidth="max-w-md">
      <div className="space-y-6 pt-1">
        {/* Navigation Group */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-ql-border/60">
            <Navigation className="w-3.5 h-3.5 text-ql-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ql-muted">
              Navigation
            </h4>
          </div>
          <div className="space-y-2">
            {navigationShortcuts.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-ql-bg/80 transition-colors"
              >
                <div>
                  <span className="font-medium text-ql-text">{item.label}</span>
                  <p className="text-[11px] text-ql-muted">{item.description}</p>
                </div>
                <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 text-xs font-mono font-semibold text-ql-text bg-ql-bg border border-ql-border rounded shadow-xs">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Group */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-ql-border/60">
            <Zap className="w-3.5 h-3.5 text-ql-accent" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ql-muted">
              Actions & Settings
            </h4>
          </div>
          <div className="space-y-2">
            {actionShortcuts.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-ql-bg/80 transition-colors"
              >
                <div>
                  <span className="font-medium text-ql-text">{item.label}</span>
                  <p className="text-[11px] text-ql-muted">{item.description}</p>
                </div>
                <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 text-xs font-mono font-semibold text-ql-text bg-ql-bg border border-ql-border rounded shadow-xs">
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className="pt-3 border-t border-ql-border/60 flex items-center gap-2 text-[11px] text-ql-muted">
          <Keyboard className="w-3.5 h-3.5 text-ql-muted shrink-0" />
          <span>Shortcuts are automatically paused while typing in form inputs.</span>
        </div>
      </div>
    </Modal>
  );
}
