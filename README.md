<div align="center">

# **NuConnect**  
### *Chapter speaker CRM*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-292D3E?style=for-the-badge)](https://orm.drizzle.team/)

**Send invites · Enforce eligibility · Track speakers · Sync your form**

</div>

---

## Overview

**NuConnect** is a lightweight CRM built for chapter speaker coordination. Manage firm contacts, send semester invite emails, enforce a **1-year eligibility rule**, and keep in-house **speaker logs**—all in one place. Optionally receive scheduling submissions from a Google Form via webhook.

---

## ✨ Features

| Area | Description |
|------|-------------|
| **Firms** | Add firms with contact email and name; edit and delete as needed. |
| **Invites** | Per semester: see who is eligible (1-year rule), who was already invited, and send invite emails in batch or on a schedule. |
| **Eligibility rule** | A firm that spoke in Spring 2026 cannot be invited again until Spring 2027 (same semester, next year). |
| **Speaker logs** | Log who spoke when and mark thank-you sent. Logging a speaker automatically records an event for eligibility. |
| **Scheduling form** | Receive submissions from a Google Form via webhook and view them in the app. |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create the database
mkdir -p data
npx drizzle-kit push

# 3. Configure environment (copy .env.example to .env and set Gmail or Resend)
# 4. Run the app
npm run dev
```

Then open **http://localhost:3000**.

---

## ☁️ Deploy on Render

**Step-by-step:** See **[docs/RENDER_SETUP.md](docs/RENDER_SETUP.md)** for exact fields to fill on the New Web Service form (build/start commands, env vars, disk, health check).

Summary:

1. **New → Web Service**, connect repo `BAPNuSigma/NuConnect`, branch `main`.

2. **Build command:** `npm install && npm run build`  
   **Start command:** `npx drizzle-kit push && npm start` (required so the DB exists before the app starts).

3. **Instance:** Use **Starter** ($7/mo) or higher — the Free tier doesn’t support the persistent disk.

4. **Environment variables:** Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` (or Resend keys). Optionally `GOOGLE_FORMS_WEBHOOK_SECRET`.

5. **Advanced → Add disk:** Mount path `data`, size 1 GB (so SQLite persists across deploys). Clear **Health Check Path** or set to `/`.

6. Click **Deploy Web Service**. Use the resulting URL for the app and for the Google Form webhook.

---

## 📋 Setup (detailed)

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
mkdir -p data
npx drizzle-kit push
```

> Or use `npx drizzle-kit generate` then `npx drizzle-kit migrate` if you prefer migrations.

### 3. Email (Gmail or Resend)

Copy `.env.example` to `.env` and set:

- **Gmail:** `GMAIL_USER` (chapter Gmail) and `GMAIL_APP_PASSWORD` ([App Password](https://myaccount.google.com/apppasswords)).
- **Resend:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

Invites are sent from the configured account.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📅 Semesters

Use **Invites** → **Add current semester** to create the current semester, or add via API:

```bash
POST /api/semesters
Content-Type: application/json

{ "year": 2026, "term": "spring" }   # or "fall"
```

---

## 📬 Google Form webhook

| Item | Value |
|------|--------|
| **URL** | `POST https://your-app-url/api/webhooks/google-forms` |
| **Body** | JSON with `firmName` and `semester` (or `semesterLabel`). Extra fields go to `rawPayload`. |
| **Auth** | If `GOOGLE_FORMS_WEBHOOK_SECRET` is set, send `Authorization: Bearer <secret>`. |

Use Google Apps Script on your form’s **Submit** trigger to POST the form response to this URL. See `docs/GOOGLE_FORMS_APPS_SCRIPT.md` for details.

---

## ⏰ Sending invites

- **Only new firms get emailed:** Each time you send, the app emails only firms that are eligible for the selected semester and do **not** already have an invite record. Already-sent firms stay marked and are not emailed again for that semester.

- **Manual trigger:** On the **Invites** page, choose a semester and click **Send all pending now**.

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack). |
| `npm run build` | Production build. |
| `npm run start` | Run production server. |
| `npm run db:push` | Push schema to DB (no migration files). |
| `npm run db:generate` | Generate migrations. |
| `npm run db:migrate` | Run migrations. |
| `npm run db:studio` | Open Drizzle Studio on the DB. |

---

## 📤 Push to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Initial commit: NuConnect CRM"
```

Create a new repository on [GitHub](https://github.com/new) (do **not** add a README or .gitignore there). Then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name. After pushing, connect the repo in Render to deploy.

---

<div align="center">

**NuConnect** — *Speaker CRM for chapters*

</div>
