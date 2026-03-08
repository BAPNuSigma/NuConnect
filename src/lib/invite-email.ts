import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const INVITE_EMAIL_SUBJECT_KEY = "invite_email_subject";
const INVITE_EMAIL_BODY_KEY = "invite_email_body";
const INVITE_EMAIL_YOUR_NAME_KEY = "invite_email_your_name";
const INVITE_EMAIL_EBOARD_POSITION_KEY = "invite_email_eboard_position";
const INVITE_EMAIL_SCHEDULING_LINK_KEY = "invite_email_scheduling_link";
const INVITE_EMAIL_SIGNATURE_ENABLED_KEY = "invite_email_signature_enabled";

const DEFAULT_SUBJECT = "Invitation to Present: Beta Alpha Psi: Nu Sigma Chapter – {{semester}}";
const DEFAULT_BODY = `<p>Dear {{contactName}},</p>
<p>I hope you are having a productive week.</p>
<p>My name is {{yourName}} and I serve as the {{eBoardPosition}} for the Beta Alpha Psi ("BAP") Nu Sigma Chapter at Fairleigh Dickinson University: Silberman College of Business.</p>
<p>We would be honored to invite {{firmName}} to present to our chapter this coming {{semester}}. This is a fantastic opportunity to network with high-achieving Accounting, Finance, and MIS students from our Madison, Teaneck, and Vancouver campuses, and to share insights into your firm and industry.</p>
<p><strong>About Our Chapter</strong></p>
<p>We are proud to share that our chapter was recognized as a 2023-2024 &amp; 2024-2025 Gold Chapter. We are currently one of only two chapters in New Jersey to hold this distinction.</p>
<p>To maintain membership in this internationally recognized honor society, our students must carry a minimum 3.20 GPA and actively participate in tutoring and community service. You will be speaking to a dedicated group of aspiring professionals eager to learn from your expertise.</p>
<p><strong>How to Secure Your Spot</strong></p>
<p>We have introduced a new scheduling form to make booking your presentation date easier. Please note that our meetings generally take place on Wednesdays from 4:30 PM – 5:30 PM EST.</p>
<p>You can view our specific availability and lock in your preferred date using the link below:</p>
<p><a href="{{schedulingLink}}">Scheduling Link</a></p>
<p>Once you select a date, we will follow up with a calendar invitation and further logistics. Please keep in mind that these dates are first come, first serve.</p>
<p>Thank you for your time and support of FDU students. We look forward to potentially welcoming you this semester!</p>
<p>Sincerely,</p>`;

export type InviteTemplateVars = {
  firmName: string;
  semesterLabel: string;
  contactName: string;
  yourName: string;
  eBoardPosition: string;
  schedulingLink: string;
};

/**
 * Replace {{firmName}}, {{semester}}, {{contactName}}, {{yourName}}, {{eBoardPosition}}, {{schedulingLink}} in a string.
 */
export function applyPlaceholders(
  text: string,
  vars: InviteTemplateVars
): string {
  return text
    .replace(/\{\{firmName\}\}/g, vars.firmName)
    .replace(/\{\{semester\}\}/g, vars.semesterLabel)
    .replace(/\{\{contactName\}\}/g, vars.contactName)
    .replace(/\{\{yourName\}\}/g, vars.yourName)
    .replace(/\{\{eBoardPosition\}\}/g, vars.eBoardPosition)
    .replace(/\{\{schedulingLink\}\}/g, vars.schedulingLink);
}

/**
 * Get template: subject and body are always the fixed BAP template; only yourName, eBoardPosition, schedulingLink come from DB.
 * {{semester}} in the subject is replaced with the semester you're recruiting for when sending.
 */
export async function getInviteTemplate(db: {
  query: {
    appSettings: {
      findFirst: (opts: { where: unknown; columns?: unknown }) => Promise<{ value: string } | undefined>;
    };
  };
}): Promise<{
  subject: string;
  body: string;
  yourName: string;
  eBoardPosition: string;
  schedulingLink: string;
  signatureEnabled: boolean;
}> {
  const [yourNameRow, eBoardRow, linkRow, signatureRow] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_YOUR_NAME_KEY), columns: { value: true } }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_EBOARD_POSITION_KEY), columns: { value: true } }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SCHEDULING_LINK_KEY), columns: { value: true } }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, INVITE_EMAIL_SIGNATURE_ENABLED_KEY), columns: { value: true } }),
  ]);
  return {
    subject: DEFAULT_SUBJECT,
    body: DEFAULT_BODY,
    yourName: yourNameRow?.value?.trim() ?? "",
    eBoardPosition: eBoardRow?.value?.trim() ?? "",
    schedulingLink: linkRow?.value?.trim() ?? "",
    signatureEnabled: signatureRow?.value === "true",
  };
}

const BAP_WEBSITE_URL = "https://bapfdu.wixsite.com/website";
const BAP_SOCIAL_URL = "https://linktr.ee/BAPFDU";

/**
 * Produce final subject and HTML body for an invite email using the template and vars.
 * Per-recipient vars: firmName, semesterLabel, contactName. Template supplies yourName, eBoardPosition, schedulingLink.
 * When signatureEnabled, appends BAP chapter signature (name, position, website & social links).
 */
export function buildInviteEmail(
  template: {
    subject: string;
    body: string;
    yourName: string;
    eBoardPosition: string;
    schedulingLink: string;
    signatureEnabled: boolean;
  },
  vars: Pick<InviteTemplateVars, "firmName" | "semesterLabel" | "contactName">
): { subject: string; html: string } {
  const allVars: InviteTemplateVars = {
    ...vars,
    yourName: template.yourName,
    eBoardPosition: template.eBoardPosition,
    schedulingLink: template.schedulingLink,
  };
  const subject = applyPlaceholders(template.subject, allVars);
  let html = applyPlaceholders(template.body, allVars);
  if (!/<\s*[a-z][\s\S]*>/i.test(html)) {
    html = html
      .split(/\n+/)
      .map((line) => `<p>${line.trim() || "&nbsp;"}</p>`)
      .join("\n");
  }
  if (template.signatureEnabled) {
    const name = template.yourName || "E-Board";
    const position = template.eBoardPosition
      ? `${template.eBoardPosition} of Beta Alpha Psi: Nu Sigma Chapter`
      : "Beta Alpha Psi: Nu Sigma Chapter";
    html += `
<p>${name}</p>
<p>${position}</p>
<p><a href="${BAP_WEBSITE_URL}">BAP: Nu Sigma Chapter Website</a></p>
<p><a href="${BAP_SOCIAL_URL}">BAP FDU Social Media Platforms</a></p>`;
  }
  return { subject, html };
}
