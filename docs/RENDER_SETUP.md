# Render setup — step-by-step

Use this when you're on the **New Web Service** form and need to know exactly what to enter.

---

## 1. Main form (source, name, build, start)

| Field | What to enter |
|--------|----------------|
| **Source** | Your repo: `BAPNuSigma / NuConnect` (already connected). |
| **Name** | `NuConnect` (or any name you like). |
| **Project** | Optional. Create one if you want to group services. |
| **Language** | `Node`. |
| **Branch** | `main`. |
| **Region** | e.g. **Ohio (US East)**. |
| **Root Directory** | Leave **empty** (monorepo not used). |
| **Build Command** | `npm install && npm run build` (or keep Render’s `npm install; npm run build`). |
| **Start Command** | **Important:** use `npx drizzle-kit push && npm start` so the SQLite DB and schema exist before the app starts. |

---

## 2. Instance type & environment variables

### Instance type

- **Free** does **not** support persistent disks, and NuConnect needs a disk for SQLite.
- Choose **Starter** ($7/month) or higher so you can add a disk in Advanced.

### Environment variables

Click **“Add Environment Variable”** (or **“Add from .env”** and paste from your local `.env`). You need at least:

| Key | Value | Notes |
|-----|--------|--------|
| `GMAIL_USER` | Your chapter Gmail | e.g. `yourchapter@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password | From [Google App Passwords](https://myaccount.google.com/apppasswords) |

**If you use Resend instead of Gmail:**

| Key | Value |
|-----|--------|
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | e.g. `NuConnect <noreply@yourdomain.com>` |

**Optional:**

| Key | Value |
|-----|--------|
| `GOOGLE_FORMS_WEBHOOK_SECRET` | Secret for the Google Form webhook |

- **PORT:** Render usually sets `PORT` for you. You can leave the pre-filled value (e.g. `10008`) or leave it unset so Render assigns it.

---

## 3. Advanced (disk + health check)

Click **Advanced** to expand.

### Disk (required for SQLite)

- Click **“Add disk”**.
- **Mount Path:** `data`
- **Size:** 1 GB (or more if you prefer)
- **Name:** e.g. `nuconnect-data`

Without this disk, the database would be lost on every deploy.

### Health Check Path

- The app doesn’t have a `/healthz` route. Either:
  - **Clear** the Health Check Path field, or
  - Set it to `/` so Render pings the home page.

### Other Advanced options

- **Pre-Deploy Command:** Leave empty (or `$`). Schema is applied in the **Start Command** with `npx drizzle-kit push`.
- **Auto-Deploy:** “On Commit” is fine so each push to `main` deploys.
- **Secret Files:** Only if you need to mount a file (e.g. `.env`); usually env vars are enough.

---

## 4. Deploy

Click **“Deploy Web Service”**. After the first deploy, your app URL will look like:

`https://nuconnect-xxxx.onrender.com`

Use that URL for:

- Opening the app in a browser.
- Google Form webhook: `POST https://nuconnect-xxxx.onrender.com/api/webhooks/google-forms`

---

## Quick checklist

- [ ] **Start Command** is `npx drizzle-kit push && npm start`
- [ ] **Instance** is Starter or higher (for disk support)
- [ ] **Env vars** include `GMAIL_USER` and `GMAIL_APP_PASSWORD` (or Resend)
- [ ] **Advanced → Disk** added with mount path `data`, 1 GB
- [ ] **Health Check Path** cleared or set to `/`
