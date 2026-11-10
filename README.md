# Slip Expense Tracker 🧾💸

[![CI Backend](https://github.com/tharitnut/Slip-Expense-Tracker/actions/workflows/backend.yml/badge.svg)](https://github.com/tharitnut/Slip-Expense-Tracker/actions/workflows/backend.yml)
[![CI Frontend](https://github.com/tharitnut/Slip-Expense-Tracker/actions/workflows/frontend.yml/badge.svg)](https://github.com/tharitnut/Slip-Expense-Tracker/actions/workflows/frontend.yml)

A modern full-stack personal finance web application built to streamline everyday spending. Users can log expenses manually or upload Thai bank transfer slips (via in-memory Tesseract OCR) to automatically extract transaction details, benefit from learned merchant categorization, and analyze spending through an interactive monthly dashboard designed with a minimalist **"Quiet Ledger"** aesthetic.

---

## 🌐 Live Deployments

- **Web Application**: [https://slip-expense-tracker-nine.vercel.app](https://slip-expense-tracker-nine.vercel.app) *(Hosted on Vercel)*
- **API Server & Swagger UI**: [https://slip-expense-tracker.onrender.com/docs](https://slip-expense-tracker.onrender.com/docs) *(Hosted on Render)*
- **Database**: PostgreSQL 16 on Neon Serverless Cloud

---

## ✨ Key Features

- **🎨 "Quiet Ledger" Design System & Dark Mode**:
  - **Calm, Elegant Aesthetic**: Inspired by classic accounting ledgers and paper slips. Uses warm off-white parchment tones (`#FAF8F4`), deep forest green (`#1F4D3A`), and champagne gold accents (`#B08D57`) without loud neon gradients.
  - **Signature Receipt Detail**: Subtle perforated dashed borders (`receipt-border`) applied to the summary KPI card and OCR slip confirmation review.
  - **Bilingual Typography**: **Noto Sans Thai** for crisp UI reading paired with **Fraunces** serif for page headers and financial totals, utilizing `tabular-nums` for right-aligned figures.
  - **🌙 Zero-FOUC Dark Mode**: Fully supported dark theme utilizing deep greenish-black tones (`#101512`), system preference detection, instant toggle (☀️ / 🌙), and zero flicker on page refresh via `useSyncExternalStore`.
- **📸 Bank Transfer Slip OCR (Privacy-First)**:
  - Powered by Tesseract OCR 5 with Thai (`tha`) and English (`eng`) language models.
  - Image preprocessing with Pillow (grayscale conversion, upscaling, contrast enhancement).
  - Regex-based bank parsers extracting Amount, Gregorian Date & Time (automatically converting Thai Buddhist Era `25xx` to `20xx`), Merchant / Payee, and Bank Slip Reference numbers.
  - **Privacy Guarantee**: Slip images are processed purely in-memory and are **never** stored on disk or in the database.
- **🛡️ Duplicate Slip Detection**:
  - Automatically prevents duplicate records (HTTP 409 Conflict) based on slip reference numbers (`slip_ref`).
  - Fallback fuzzy heuristic detection (matching amount, timestamp, and merchant).
- **🧠 Learned Auto-Categorization**:
  - Remembers user preferences: when you assign a category to a merchant, future transactions from that same merchant are auto-categorized automatically.
- **📊 Interactive Monthly Dashboard (Recharts)**:
  - 4 Key KPI metrics: Total Spending, Month-over-Month Delta (%), Transaction Count, and Daily Average.
  - Visual category breakdown donut chart with center total display and warm forest-gold palette.
  - Daily spending bar chart showing daily spending trends with minimal gridlines.
  - 12-month navigation selector.
  - Real-time cache synchronization with TanStack Query.
- **📥 CSV Data Export**:
  - Export transactions with one click.
  - Includes **UTF-8 BOM (`\ufeff`)** encoding to ensure Thai characters and text render cleanly in Microsoft Excel, Apple Numbers, and Google Sheets without encoding issues.
- **🔐 Secure Authentication & Data Isolation**:
  - User registration & login with JWT Bearer tokens and bcrypt password hashing.
  - Strict user-scoped database queries (users can never access or query another user's records; unauthorized access returns 404).

---

## 🛠️ Tech Stack

| Layer                 | Technologies                                                                                                                                                                                       |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**    | **Next.js 16** (App Router), **TypeScript**, **Tailwind CSS v4**, **TanStack Query v5**, **React Hook Form**, **Zod**, **Recharts**, **Lucide Icons**, **Noto Sans Thai & Fraunces** |
| **Backend**     | **FastAPI**, **SQLAlchemy 2**, **Pydantic v2**, **PyJWT**, **bcrypt**, **Tesseract OCR (pytesseract + Pillow)**                                                |
| **Database**    | **PostgreSQL 16** (Neon Hosted Database) · SQLite in-memory for testing                                                                                                                     |
| **DevOps & CI** | **Docker**, **GitHub Actions** (Automated SQLite & PostgreSQL CI matrix), **Render**, **Vercel**                                                                           |

---

## 📡 API Overview

| Method                         | Path                     | Description                                                                                 |
| :----------------------------- | :----------------------- | :------------------------------------------------------------------------------------------ |
| **POST**                 | `/auth/register`       | Register new user account; seeds 7 default categories                                       |
| **POST**                 | `/auth/login`          | OAuth2 form-data login → returns `{ access_token, token_type }`                          |
| **GET**                  | `/auth/me`             | Fetch authenticated user profile                                                            |
| **GET / POST**           | `/categories`          | List or create categories                                                                   |
| **PATCH / DELETE**       | `/categories/{id}`     | Rename category or delete (reassigns linked transactions to uncategorized)                  |
| **GET / POST**           | `/transactions`        | List paginated transactions (filters: `start`, `end`, `category_id`, `q`) or create |
| **GET / PATCH / DELETE** | `/transactions/{id}`   | Retrieve, update, or remove transaction record                                              |
| **GET**                  | `/transactions/export` | Download transactions as CSV with UTF-8 BOM (optional `month` filter)                     |
| **POST**                 | `/slips/parse`         | In-memory OCR scan of bank transfer slip image (<= 5MB)                                     |
| **GET**                  | `/summary/monthly`     | Monthly spending KPIs, category breakdown, and daily totals (`?month=YYYY-MM`)            |
| **GET**                  | `/health`              | Service health check                                                                        |

> Include header `Authorization: Bearer <token>` on all protected endpoints.

---

## 💻 Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+ & npm
- Tesseract OCR (with Thai `tha` and English `eng` language packs installed)

### 1. Backend Setup (FastAPI)

```bash
# 1. Navigate to backend
cd backend

# 2. Activate virtual environment
# Windows:
..\.venv\Scripts\Activate.ps1
# Linux/macOS:
source ../.venv/bin/activate

# 3. Install dependencies
pip install -r requirements-dev.txt

# 4. Copy environment variables
cp .env.example .env

# 5. Start development server
uvicorn app.main:app --reload
```

- API Base URL: `http://localhost:8000`
- Swagger Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 2. Frontend Setup (Next.js)

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

- Web Application: `http://localhost:3000`

---

## 🧪 Testing & Code Quality

### Backend Automated Tests (pytest)

Runs **51 comprehensive tests** covering authentication, CRUD, learned auto-categorization, duplicate detection heuristics, OCR parser logic, and CSV exports:

```bash
cd backend
pytest
```

### Frontend Typecheck & Build

Runs ESLint and compiles production Next.js static routes:

```bash
cd frontend
npm run lint
npm run build
```

---

## 🗺️ Project Milestones & Roadmap

- [X] **Phase 0 & A (Backend Hardening & CI)**: Auth, CRUD, auto-categorization rules, duplicate prevention, PostgreSQL test suite, and GitHub Actions CI.
- [X] **Phase B (Frontend Core)**: Next.js App Router, Tailwind UI, TanStack Query integration, Transactions table, Category manager, and mobile responsive layout.
- [X] **Phase C (Cloud Deployment)**: Render (Backend Docker Web Service) + Vercel (Frontend Next.js) + Neon (Serverless PostgreSQL 16).
- [X] **Phase D (Bank Slip OCR)**: In-memory Tesseract OCR engine, Thai transfer slip parsers, `POST /slips/parse`, and `/upload` UI with 1-click sample slip demo.
- [X] **Phase E (Dashboard & Extras)**: Monthly interactive Recharts analytics (Donut & Bar charts), real-time query invalidation, and UTF-8 BOM CSV Export.
- [X] **Phase F (Quiet Ledger Redesign & Dark Mode)**: Minimalist financial ledger design system, custom typography (Noto Sans Thai + Fraunces), signature receipt details, and zero-FOUC Dark Mode toggle.
