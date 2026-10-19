# Slip Expense Tracker - project context

Personal expense tracker. Users record spending manually or by uploading a Thai bank
transfer slip (OCR), get auto-categorisation and a monthly dashboard. Portfolio project,
target 2-3 weeks. UI language: English. Code, commits, identifiers: English.

## Stack
- Backend: FastAPI, SQLAlchemy 2, pydantic v2, PyJWT, bcrypt, PostgreSQL (SQLite for dev/tests)
- Frontend (to build): Next.js App Router + TypeScript + Tailwind, TanStack Query,
  react-hook-form + zod, Recharts
- Infra: Docker Compose locally; Render (API) + Vercel (web) + hosted Postgres

## Repo layout
slip-expense-tracker/
  docker-compose.yml  README.md  .gitignore
  backend/
    Dockerfile  requirements.txt  requirements-dev.txt  pytest.ini  .env.example
    app/  main.py config.py database.py models.py schemas.py security.py deps.py
      routers/  auth.py categories.py transactions.py summary.py
    tests/  conftest.py test_api.py          (26 tests, SQLite in-memory)
  frontend/                                  (does not exist yet)

## Data model
users(id, email unique lowercase, hashed_password, created_at)
categories(id, user_id, name)                unique(user_id, name)
transactions(id, user_id, category_id NULL, amount Numeric(12,2) > 0,
             occurred_at naive datetime, merchant NULL, note NULL,
             slip_ref NULL, source 'manual'|'slip', created_at)
             unique(user_id, slip_ref)       (NULLs allowed many times)
merchant_rules(id, user_id, merchant_key, category_id)   unique(user_id, merchant_key)
Every query is scoped by user_id. Another user's row = 404 (never 403).

## API (JWT: Authorization: Bearer <token>, except register/login/health)
POST /auth/register {email,password(8-72 bytes)} -> 201 user; seeds 7 default categories
POST /auth/login    form-data username(=email), password -> {access_token, token_type}
GET  /auth/me
GET|POST /categories            DELETE /categories/{id} (-> 204; its transactions become uncategorised)
GET|POST /transactions          GET /transactions?start&end(exclusive)&category_id&q&limit(1-200)&offset
                                -> {items,total,limit,offset}
GET|PATCH|DELETE /transactions/{id}
GET /summary/monthly?month=YYYY-MM
    -> {month,total,transaction_count,previous_month_total,change_percent|null,
        by_category[{category_id,category_name,total,percent}], daily[{date,total}]}
GET /health        Swagger UI at /docs
Money is sent/received as a JSON number (2 decimals max). Errors: 400 unknown category,
401 bad/missing token, 404 not found, 409 duplicate slip / duplicate name / email taken,
422 validation (amount <= 0, >2 decimals, occurred_at more than 1 day in the future).

## Business rules already implemented (do not break)
- Duplicate slip: same slip_ref for the user -> 409. If no slip_ref and source='slip':
  same amount + occurred_at + merchant -> 409. Manual entries are never blocked by the
  heuristic.
- Auto-categorise: if category_id is omitted and a merchant rule exists, the rule's
  category is used. Choosing a category for a merchant (create or PATCH) learns/updates the rule.
  Merchant key = lowercase, whitespace-collapsed.

## Conventions
- occurred_at: the frontend ALWAYS sends local wall-clock time WITHOUT timezone
  (e.g. 2026-10-05T12:30:00) so months/days bucket in Thai local time.
- Month strings are Gregorian YYYY-MM. Display dates may use Thai locale (Buddhist year);
  keep it consistent. Thai bank slips print Buddhist-era years (2569 = 2026) - convert in OCR parser.
- Python: type hints, small functions, new behaviour needs tests. Keep routers thin.
- Never commit secrets, .env, *.db, or real bank slips. Test slips are synthetic only.
- Privacy: uploaded slip images are processed in memory and NOT stored; do not log
  account numbers, full names or OCR raw text.
- Before finishing any task: run backend `pytest` (and frontend `npm run lint && npm run build`
  once the frontend exists). Do not change existing endpoint behaviour unless the task says so.

## Commands
backend:  cd backend && pip install -r requirements-dev.txt && pytest
          uvicorn app.main:app --reload          (http://localhost:8000/docs)
docker:   docker compose up --build
