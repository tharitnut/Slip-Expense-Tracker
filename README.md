# Slip Expense Tracker

A personal expense tracking web application. Record spending manually or automatically by uploading Thai bank transfer slips (via OCR), with automatic merchant-based categorization and monthly dashboard summaries.

## Features

- **Authentication**: Register / Login (JWT, bcrypt password hashing), user data isolation (users only see their own records).
- **Transactions Management**: Create, search, filter by month/category, and pagination (limit 20 per page).
- **Duplicate Slip Prevention**: Uses bank reference number (`slip_ref`, unique per user). If missing, falls back to matching amount + timestamp + merchant.
- **Learned Auto-Categorization**: When a user assigns a category to a merchant, subsequent transactions from that same merchant are auto-categorized.
- **Monthly Summary**: Total spending, month-over-month change (%), breakdown by category, and daily totals.
- **Validation**: Amount must be > 0 with at most 2 decimal places; transaction dates cannot be in the future.
- **Continuous Integration (CI)**: Automated GitHub Actions running backend tests (SQLite & PostgreSQL 16) and frontend quality checks (ESLint & Next.js production build).

## Tech Stack

- **Backend**: FastAPI · SQLAlchemy 2 · PostgreSQL (SQLite for local dev/testing) · Pydantic v2 · PyJWT · pytest
- **Frontend**: Next.js (App Router, TypeScript) · Tailwind CSS · TanStack Query · react-hook-form + zod · Lucide Icons

---

## Getting Started

### 1. Run Backend (FastAPI)

```bash
# Terminal 1: Navigate to backend and activate virtualenv
cd backend

# On Windows (PowerShell):
..\.venv\Scripts\Activate.ps1   # or .venv\Scripts\activate

# On Linux/macOS:
source ../.venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements-dev.txt

# Start backend server
uvicorn app.main:app --reload
```

- API Base URL: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 2. Run Frontend (Next.js)

```bash
# Terminal 2: Navigate to frontend and start dev server
cd frontend

# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev
```

- Web Application: `http://localhost:3000`

---

## Running Tests & Checks

### Backend Tests (pytest)

```bash
cd backend
pytest
```

Tests run against an in-memory SQLite database by default (or against PostgreSQL when `TEST_DATABASE_URL` is set).

### Frontend Checks (Lint & Build)

```bash
cd frontend
npm run lint
npm run build
```

---

## API Overview

| Method               | Path                               | Description                                                                |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| POST                 | `/auth/register`                 | `{email, password}` - Creates account and seeds default categories       |
| POST                 | `/auth/login`                    | Form-data `username`, `password` → `{access_token, token_type}`     |
| GET                  | `/auth/me`                       | Current user profile                                                       |
| GET / POST           | `/categories`                    | List or create categories                                                  |
| PATCH                | `/categories/{id}`               | Rename category (preserves transactions and learned rules)                 |
| DELETE               | `/categories/{id}`               | Deletes category; associated transactions become "Uncategorized"           |
| GET / POST           | `/transactions`                  | Filters: `start`, `end`, `category_id`, `q`, `limit`, `offset` |
| GET / PATCH / DELETE | `/transactions/{id}`             | Get, update, or delete transaction                                         |
| GET                  | `/summary/monthly?month=YYYY-MM` | Monthly spending breakdown & daily chart data                              |
| GET                  | `/health`                        | Health check endpoint                                                      |

> Include header `Authorization: Bearer <token>` on all protected endpoints.

---

## Architectural & Design Decisions

- **Store currency as `Numeric(12, 2)`**: Money values are stored as high-precision decimals in the database (never float) and serialized cleanly as numbers for the frontend.
- **Token Storage in `localStorage`**: For project scope and ease of integration across separate frontend/backend deployments, the JWT access token is kept in `localStorage`. We acknowledge that `httpOnly` cookies provide better mitigation against XSS, but `localStorage` was intentionally chosen for simplicity at this stage.
- **Privacy First**: Bank slip images (when OCR is integrated) are processed in-memory and never stored on disk.
- **Database Initialization**: Uses `Base.metadata.create_all()` on startup for simplicity in early phases.
- **Safe Test Isolation**: `TEST_DATABASE_URL` creates and drops all tables per test run and strictly verifies it does not match `DATABASE_URL` to prevent accidental data loss.

---

## Roadmap

- [X] **Phase 0 & A (Backend & CI)**: Auth, CRUD, learned auto-categorization, duplicate detection, PostgreSQL test support, and GitHub Actions CI.
- [ ] **Phase B (Frontend)**: Next.js App Router, Auth UI (completed), Transactions management & Category manager (in progress).
- [ ] **Phase C (Deployment)**: Render (Backend) + Vercel (Frontend) + Neon (Hosted PostgreSQL).
- [ ] **Phase D (OCR)**: Bank transfer slip scanning with Tesseract & bank-specific parsers.
- [ ] **Phase E (Dashboard & Extras)**: Monthly interactive charts (Recharts) and CSV Export.
