export interface Category {
  id: number;
  name: string;
}

export interface Transaction {
  id: number;
  amount: number;
  occurred_at: string;
  merchant: string | null;
  note: string | null;
  category_id: number | null;
  slip_ref: string | null;
  source: "manual" | "slip";
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface ParsedSlip {
  amount: number | null;
  occurred_at: string | null;
  merchant: string | null;
  slip_ref: string | null;
  bank: string | null;
  missing_fields: string[];
}

export interface CategoryTotal {
  category_id: number | null;
  category_name: string;
  total: number;
  percent: number;
}

export interface DailyTotal {
  date: string;
  total: number;
}

export interface MonthlySummary {
  month: string;
  total: number;
  transaction_count: number;
  previous_month_total: number;
  change_percent: number | null;
  by_category: CategoryTotal[];
  daily: DailyTotal[];
}


