<div align="center">

# **NuConnect**  
### *Chapter speaker CRM*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-292D3E?style=for-the-badge)](https://orm.drizzle.team/)
[![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?style=for-the-badge)](https://turso.tech/)

**Send invites · Enforce eligibility · Track speakers · Sync your form**

</div>

---

## Overview

**NuConnect** is a lightweight CRM built for chapter speaker coordination. Manage firm contacts, send semester invite emails, enforce a **1-year eligibility rule**, and keep in-house **speaker logs**—all in one place. Optionally receive scheduling submissions from a Google Form via webhook.

NuConnect uses Turso/libSQL through Drizzle ORM so writes persist correctly on serverless hosts such as Vercel.

---

## ✨ Features

| Area | Description |
|------|-------------|
| **Firms** | Add firms with contact email and name; edit and delete as needed. |
| **Find Leads** | Search the open web for candidate firms (via a free Google Programmable Search Engine) and add the ones you want straight into Firms. See [Lead search setup](#lead-search-setup). |
| **Invites** | Per semester: see who is eligible (1-year rule), who was already invited, and send invite emails in batch or on a schedule. |
| **Eligibility rule** | A firm that spoke in Spring 2026 cannot be invited again until Spring 2027 (same semester, next year). |
| **Speaker logs** | Log who spoke when and mark thank-you sent. Logging a speaker automatically records an event for eligibility. |
| **Scheduling form** | Receive submissions from a Google Form via webhook and view them in the app. |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure local development database
cp .env.example .env
# In .env, use a local file URL for development:
# TURSO_DATABASE_URL=file:./data/nuconnect.db
# TURSO_AUTH_TOKEN=

# 3. Create the database schema
npm run db:push

# 4. Configure Gmail if you plan to send email, then run the app
npm run dev
```

Then open **http://localhost:3000**.

---

## ☁️ Deploy on Vercel with Turso

NuConnect should be deployed to Vercel with a Turso/libSQL database. Do not rely on a local SQLite file in Vercel; serverless filesystem writes are not durable.

### 1. Create separate Turso databases

Create one Turso database for **Production** and a separate Turso database for **Preview** deployments. Keeping the databases separate prevents test or branch-preview data from changing live chapter data.

Example naming pattern:

- `nuconnect-production`
- `nuconnect-preview`

This project does **not** automatically import existing Render SQLite data. If you need historical Render data, export and import it deliberately before cutting over traffic.

### 2. Configure Vercel environment variables

Use the same variable names in both Vercel environments, but set different environment-scoped values:

| Variable | Production value | Preview value |
|----------|------------------|---------------|
| `TURSO_DATABASE_URL` | Production Turso database URL | Preview Turso database URL |
| `TURSO_AUTH_TOKEN` | Production Turso token | Preview Turso token |
| `GMAIL_USER` | Chapter Gmail account, if sending mail | Test or chapter Gmail account |
| `GMAIL_APP_PASSWORD` | Gmail app password | Preview/test Gmail app password |
| `GOOGLE_FORMS_WEBHOOK_SECRET` | Production webhook secret | Preview webhook secret |

Never commit real database URLs, auth tokens, app passwords, or webhook secrets.

### 3. Initialize each blank database

Run Drizzle against the selected Turso database after setting environment variables locally or in your shell. Initialize **Preview** and **Production** separately:

```bash
TURSO_DATABASE_URL="libsql://your-preview-database.turso.io" \
TURSO_AUTH_TOKEN="your-preview-token" \
npm run db:push

TURSO_DATABASE_URL="libsql://your-production-database.turso.io" \
TURSO_AUTH_TOKEN="your-production-token" \
npm run db:push
```

`npm run db:push` creates the schema for a blank database. Alternatively, use `npm run db:generate` and `npm run db:migrate` if you prefer checked-in migration files.

### 4. Deploy

Connect `BAPNuSigma/NuConnect` to Vercel and deploy from the intended branch. Set the environment variables above in Vercel before using the app.

---

## 📋 Setup (detailed)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set local values:

```bash
TURSO_DATABASE_URL=file:./data/nuconnect.db
TURSO_AUTH_TOKEN=
GMAIL_USER=
GMAIL_APP_PASSWORD=
GOOGLE_FORMS_WEBHOOK_SECRET=
```

A `file:` URL is supported for local development and automated validation without an auth token. Remote `libsql://` Turso databases require `TURSO_AUTH_TOKEN`.

### 3. Create the database schema

```bash
npm run db:push
```

> Or use `npm run db:generate` then `npm run db:migrate` if you prefer migrations.

### 4. Email

Set `GMAIL_USER` (chapter Gmail) and `GMAIL_APP_PASSWORD` ([App Password](https://myaccount.google.com/apppasswords)) if you plan to send invite emails.

### 5. Run the app

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

## 🔎 Lead search setup

The **Find Leads** page discovers candidate firms with Google's Programmable Search Engine — no paid lead-gen vendor involved. It's free up to 100 searches/day.

1. Create a search engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com/), set it to search the entire web, and copy its **Search engine ID**.
2. Create an API key for the **Custom Search JSON API** at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) (enable the API on the project first).
3. Set `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` in your `.env` (or Vercel environment variables).

Each result is checked against your existing Firms list by name so you don't re-add a firm you already track. Selecting a result and clicking **Find contact** scans that firm's own website for a public email or phone number — nothing is stored until you click **Add selected to Firms**.

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

<div align="center">

**NuConnect** — *Speaker CRM for chapters*

</div>
