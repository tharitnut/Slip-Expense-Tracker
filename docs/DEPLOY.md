# Deployment Guide

This guide walks you through deploying the **Slip Expense Tracker** full-stack application to production using free-tier cloud providers:

- **Database**: PostgreSQL hosted on [Neon](https://neon.tech)
- **Backend API**: FastAPI Docker container hosted on [Render](https://render.com)
- **Frontend Web**: Next.js App Router hosted on [Vercel](https://vercel.com)

---

## Architecture Overview

```
                      +-----------------------------+
                      |   Vercel (Frontend Web)     |
                      |   Next.js App Router        |
                      +--------------+--------------+
                                     |
                       HTTPS REST API (JWT Bearer)
                                     |
                                     v
                      +-----------------------------+
                      |   Render (Backend API)      |
                      |   FastAPI via Dockerfile    |
                      +--------------+--------------+
                                     |
                           TLS Database Connection
                                     |
                                     v
                      +-----------------------------+
                      |   Neon (Serverless Postgres)|
                      |   PostgreSQL 16             |
                      +-----------------------------+
```

---

## Prerequisites

1. A [GitHub](https://github.com) account with this repository pushed.
2. A free account on [Neon](https://neon.tech).
3. A free account on [Render](https://render.com).
4. A free account on [Vercel](https://vercel.com).
5. A secure secret key for production JWT tokens:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

---

## Step 1: Provision Hosted Database (Neon)

1. Log in to [Neon Console](https://console.neon.tech).
2. Click **Create Project**:
   - **Project Name**: `slip-expense-tracker`
   - **Postgres Version**: `16`
   - **Region**: Choose the region closest to you (e.g., `Singapore` or `Frankfurt`).
3. Once created, navigate to **Dashboard** and copy the **Connection string**:
   - Select connection type: **Connection pooling** (or direct connection).
   - The connection string will look like:
     ```text
     postgresql://username:password@ep-cool-fog-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
   *(Keep this connection string safe for the backend configuration).*

---

## Step 2: Deploy Backend Web Service (Render)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Choose **Build and deploy from a Git repository** and select your `slip-expense-tracker` repo.
4. Fill in the service details:
   - **Name**: `slip-expense-tracker-api` (or your preferred name)
   - **Region**: Same or close to your Neon database region
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Instance Type**: `Free`
5. Scroll down to **Environment Variables** and add the following keys:
   | Key | Value | Description |
   | --- | --- | --- |
   | `ENV` | `production` | Enables production security checks (refuses dev default secrets) |
   | `DATABASE_URL` | `<neon-connection-string>` | Connection string copied from Neon in Step 1 |
   | `SECRET_KEY` | `<generated-secret-key>` | Secure random key generated using `secrets.token_urlsafe(48)` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | JWT expiration (1440 minutes = 24 hours) |
   | `CORS_ORIGINS` | `https://<your-vercel-app>.vercel.app` | Your Vercel frontend URL (**exact match, no trailing slash**) |

   > **Note on CORS_ORIGINS**: If you haven't deployed to Vercel yet, you can temporarily set `CORS_ORIGINS=http://localhost:3000`, then update it once Vercel assigns your production domain. Multiple origins can be separated by commas (e.g. `https://app.vercel.app,http://localhost:3000`).

6. Expand **Advanced**:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`
7. Click **Create Web Service**.
8. Wait for the build to finish. Once live, copy your backend URL (e.g. `https://slip-expense-tracker-api.onrender.com`).

> **Render Free Tier Cold Starts**:
> Render's free tier spins down instances after 15 minutes of inactivity. When a request comes in after idling, it may take 30–60 seconds for the backend to wake up. This is expected behavior on the free tier.

---

## Step 3: Deploy Frontend Web Application (Vercel)

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your `slip-expense-tracker` GitHub repository.
4. Configure the project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `frontend`
   - **Build and Output Settings**: Leave default (`npm run build`)
5. In the **Environment Variables** section, add:
   | Key | Value | Description |
   | --- | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://slip-expense-tracker-api.onrender.com` | Your Render backend URL (**no trailing slash**) |
6. Click **Deploy**.
7. Once deployed, note down your production Vercel domain (e.g. `https://slip-expense-tracker.vercel.app`).
8. **Final CORS configuration**: Go back to your Render Dashboard -> Service -> **Environment**, ensure `CORS_ORIGINS` contains this exact Vercel domain without trailing `/`, and click **Save Changes**.

---

## Post-Deploy Smoke-Test Checklist

Run through this checklist to ensure all components are functioning properly on the live internet:

- [ ] **Health Check**: Open `https://<render-backend>/health` in your browser. Verify it returns `{"status": "ok"}`.
- [ ] **API Documentation**: Open `https://<render-backend>/docs`. Verify Swagger UI loads correctly.
- [ ] **Frontend Home**: Open `https://<vercel-frontend>`. Verify automatic redirect to `/login`.
- [ ] **Registration**: Navigate to `/register` and create a new account with email and password. Verify successful creation and auto-login into `/transactions`.
- [ ] **CORS Verification**: Open Browser Developer Tools -> **Console** and **Network** tabs. Confirm there are **no CORS errors** when calling API endpoints.
- [ ] **Transaction Creation**: Click **Add Expense** and create a transaction (e.g. `150.00 THB`, merchant `Starbucks`, date & time). Verify it appears immediately in the table.
- [ ] **Category Management**: Go to `/categories`. Add a new category (e.g., `Coffee`), rename it to `Cafes & Coffee`, and verify changes reflect on the UI.
- [ ] **Auto-Categorization Test**: Add a transaction from merchant `Starbucks` without choosing a category. Verify it inherits `Cafes & Coffee` from learned merchant rules.
- [ ] **Session Persistence**: Refresh the browser page (`F5`). Verify you remain logged in and your state is retained.
- [ ] **Data Persistence Verification**:
  - Restart the backend service in the Render Dashboard (**Manual Deploy -> Trigger Deploy** or restart).
  - Refresh the frontend page.
  - Verify that your user account and all recorded transactions remain intact (proves data is saved to PostgreSQL on Neon, not temporary SQLite storage).
- [ ] **Security Verification**:
  - Verify that repository has no committed `.env` files or secrets.
  - Verify `SECRET_KEY` in Render environment variables is unique and not the development default.

