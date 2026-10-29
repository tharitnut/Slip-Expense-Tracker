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

