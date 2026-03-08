# Connect Google Forms to NuConnect (Apps Script)

Use this in **Google Apps Script** so that when someone submits your scheduling form, the response is sent to NuConnect and appears on the **Scheduling form** page.

## 1. Get your webhook URL

- **Local:** `http://localhost:3000/api/webhooks/google-forms`  
  (Or the port your app uses, e.g. 3001, 3002.)
- **Deployed:** `https://your-domain.com/api/webhooks/google-forms`

If you use a webhook secret (recommended in production), add it in your NuConnect `.env`:

```env
GOOGLE_FORMS_WEBHOOK_SECRET=your-random-secret
```

Then the script must send `Authorization: Bearer your-random-secret` in the request.

---

## 2. Code for BAP form: [2026 Fall Semester Speaker Sign-Up](https://forms.gle/kMLuHnfpX6umXUTC9)

Use this script if your form is the **2026 Fall Semester Speaker Sign-Up Sheet** (Firm Name, Discipline, Primary/Secondary Contact, Preferred date & location, Presentation topic, Recording OK, How did you hear about us). It sends `firmName` and `semester: "Fall 2026"` so NuConnect can match the submission, plus all other answers in the payload.

**Setup:** Open the form → **⋮** → **Script editor**. Paste the code below. Set `WEBHOOK_URL` (and `WEBHOOK_SECRET` if you use it). Add trigger: **Triggers** → **Add Trigger** → function `onFormSubmit`, event **From form** → **On form submit**.

```javascript
// ============ CONFIG — edit these ============
var WEBHOOK_URL = "https://your-nuconnect-url.com/api/webhooks/google-forms";
var WEBHOOK_SECRET = "";  // Same as GOOGLE_FORMS_WEBHOOK_SECRET in .env, or "" if not set
var FORM_SEMESTER = "Fall 2026";  // This form is for Fall 2026

// ============ Script (BAP 2026 Fall Speaker Sign-Up form) ============
function onFormSubmit(e) {
  if (!e || !e.response) return;
  var payload = buildPayloadBAP(e.response);
  sendToNuConnect(payload);
}

function buildPayloadBAP(response) {
  var itemResponses = response.getItemResponses();
  var payload = { firmName: "", semester: FORM_SEMESTER };

  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i];
    var title = (item.getItem().getTitle() || "").trim();
    var answer = item.getResponse();
    if (typeof answer === "string") answer = answer.trim();
    if (Array.isArray(answer)) answer = answer.join(", ");

    if (title.indexOf("Firm Name") !== -1) payload.firmName = answer;
    else if (title.indexOf("Discipline") !== -1) payload.discipline = answer;
    else if (title.indexOf("Primary Contact Name") !== -1) payload.primaryContactName = answer;
    else if (title.indexOf("Primary Contact Email") !== -1) payload.primaryContactEmail = answer;
    else if (title.indexOf("Secondary Contact Name") !== -1) payload.secondaryContactName = answer;
    else if (title.indexOf("Secondary Contact Email") !== -1) payload.secondaryContactEmail = answer;
    else if (title.indexOf("Presentation Topic") !== -1 || title.indexOf("Topic/Focus") !== -1) payload.presentationTopic = answer;
    else if (title.indexOf("date you are available") !== -1 || title.indexOf("choose the date") !== -1) payload.preferredDate = answer;
    else if (title.indexOf("location you would like") !== -1 || title.indexOf("choose the location") !== -1) payload.preferredLocation = answer;
    else if (title.indexOf("Virtual") !== -1 && title.indexOf("reason") !== -1) payload.virtualReason = answer;
    else if (title.indexOf("recording") !== -1) payload.recordingOk = answer;
    else if (title.indexOf("How did you hear") !== -1) payload.howDidYouHear = answer;
  }

  return payload;
}

function sendToNuConnect(payload) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  if (WEBHOOK_SECRET) options.headers = { "Authorization": "Bearer " + WEBHOOK_SECRET };
  var resp = UrlFetchApp.fetch(WEBHOOK_URL, options);
  if (resp.getResponseCode() >= 400) {
    console.error("Webhook error: " + resp.getResponseCode() + " " + resp.getContentText());
  }
}
```

---

## 2b. Generic Apps Script code (any form)

1. Open your **Google Form**.
2. Click the **⋮** menu → **Script editor** (or **Extensions** → **Apps Script**).
3. Replace the default code with the script below.
4. **Edit the config** at the top:
   - `WEBHOOK_URL` — your NuConnect webhook URL (see above).
   - `WEBHOOK_SECRET` — leave as `""` if you didn’t set `GOOGLE_FORMS_WEBHOOK_SECRET`; otherwise the same value as in `.env`.
5. **Map your form questions** in `buildPayload()`. The example assumes:
   - A question titled **"Firm / Company name"** → `firmName`
   - A question titled **"Semester"** (e.g. "Spring 2026") → `semester`
   - Any other questions you want stored (they’ll appear in “Raw” in NuConnect).

   Use the exact question titles from your form, or use **Edit** → **Current project’s triggers** and inspect `e.response.getItemResponses()` in the execution log to see item titles.

6. **Add a trigger:** In the script editor, click **Triggers** (clock icon) → **Add Trigger**:
   - Function: `onFormSubmit`
   - Event: **From form** → **On form submit**
   - Save.

7. **Authorize** when prompted (first run). After that, each new form submission will POST to NuConnect.

```javascript
// ============ CONFIG — edit these ============
var WEBHOOK_URL = "https://your-nuconnect-url.com/api/webhooks/google-forms";
var WEBHOOK_SECRET = "";  // Same as GOOGLE_FORMS_WEBHOOK_SECRET in .env, or "" if not set

// ============ Script ============
function onFormSubmit(e) {
  if (!e || !e.response) return;
  var payload = buildPayload(e.response);
  if (!payload) return;
  sendToNuConnect(payload);
}

function buildPayload(response) {
  var itemResponses = response.getItemResponses();
  var payload = {};
  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i];
    var title = (item.getItem().getTitle() || "").trim();
    var answer = item.getResponse();
    if (typeof answer === "string") answer = answer.trim();
    // Map form question titles to fields NuConnect expects
    if (title.indexOf("Firm") !== -1 || title.indexOf("Company") !== -1) {
      payload.firmName = answer;
    } else if (title.indexOf("Semester") !== -1) {
      payload.semester = answer;  // e.g. "Spring 2026"
    } else {
      payload[title] = answer;     // Store everything else in raw payload
    }
  }
  return payload;
}

function sendToNuConnect(payload) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  if (WEBHOOK_SECRET) {
    options.headers = { "Authorization": "Bearer " + WEBHOOK_SECRET };
  }
  var resp = UrlFetchApp.fetch(WEBHOOK_URL, options);
  if (resp.getResponseCode() >= 400) {
    console.error("Webhook error: " + resp.getResponseCode() + " " + resp.getContentText());
  }
}
```

---

## 3. Field names NuConnect uses

The webhook matches submissions to **firms** and **semesters** in your app when the JSON has:

| JSON field   | Purpose |
|-------------|---------|
| `firmName`  | Matched to a firm by name (partial match). Also accepted: `company`, `firm`. |
| `semester` or `semesterLabel` | Matched to a semester by label (e.g. `"Spring 2026"`). |

Any other keys you send are stored in the raw payload and shown in the Scheduling table.

---

## 4. Testing

- Submit a test response on your Google Form.
- In NuConnect, open **Scheduling form** and confirm the row appears.
- If it doesn’t: check **Executions** in Apps Script (left sidebar) for errors, and ensure `WEBHOOK_URL` is reachable (for localhost, the form and NuConnect must be on the same machine or you need a tunnel like ngrok).
