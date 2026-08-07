import { relations } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** App-wide settings (key-value). Keys: open_semester_id, etc. */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Semesters: e.g. "Spring 2026", "Fall 2026" */
export const semesters = sqliteTable("semesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  term: text("term", { enum: ["spring", "fall"] }).notNull(),
  label: text("label").notNull(), // e.g. "Spring 2026"
  startDate: text("start_date"), // ISO date when semester starts (optional)
  endDate: text("end_date"), // ISO date when semester ends (optional)
  speakerCapacity: integer("speaker_capacity"), // max speaker slots; null = unlimited. Recruitment closes when remaining = 0
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Organizations (companies). One row per company, regardless of how many contacts
 * (firms rows) exist there. Eligibility (the 1-year rule) is computed per organization
 * so multiple contacts at the same company can't bypass it.
 */
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(), // trimmed+lowercased name, used to find-or-create
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/** Firms (contacts/leads) that can be invited to speak */
export const firms = sqliteTable("firms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // organization name
  organizationId: integer("organization_id").references(() => organizations.id),
  discipline: text("discipline"),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"), // legacy; prefer contactFirstName + contactLastName
  title: text("title"),
  practiceArea: text("practice_area"),
  firmType: text("firm_type"),
  industryFocus: text("industry_focus"),
  location: text("location"),
  alumniConnection: text("alumni_connection"),
  personalizedNote: text("personalized_note"),
  source: text("source"), // lead channel, e.g. "Alumni LinkedIn", "Excel Import", "Career Fair"
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/** When a firm spoke (which semester). Used for 1-year eligibility. */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  semesterId: integer("semester_id").notNull().references(() => semesters.id),
  eventDate: text("event_date"), // ISO date when they actually spoke
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/** Outcome for a speaker log: confirm (form filled), spoke (actually spoke), cancel, rescheduled */
export const speakerLogOutcomes = ["confirm", "spoke", "cancel", "rescheduled"] as const;
export type SpeakerLogOutcome = (typeof speakerLogOutcomes)[number];

/** In-house speaker logs: who came, when, outcome, thank-you status, notes */
export const speakerLogs = sqliteTable("speaker_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  semesterId: integer("semester_id").notNull().references(() => semesters.id),
  eventId: integer("event_id").references(() => events.id),
  logDate: text("log_date").notNull(), // when they came / event date
  outcome: text("outcome", { enum: ["confirm", "spoke", "cancel", "rescheduled"] }).default("confirm"), // confirm when form filled; e-board toggles to spoke
  thankYouSent: integer("thank_you_sent", { mode: "boolean" }).default(false),
  thankYouSentAt: text("thank_you_sent_at"), // ISO date
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/** Scheduling form submissions (from Google Form webhook or CSV import) */
export const schedulingSubmissions = sqliteTable("scheduling_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firmId: integer("firm_id").references(() => firms.id),
  firmName: text("firm_name"), // in case not matched to a firm
  semesterId: integer("semester_id").references(() => semesters.id),
  submittedAt: text("submitted_at").notNull(),
  rawPayload: text("raw_payload"), // JSON from form
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/** Invites sent to firms (so we don't double-send) */
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firmId: integer("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  semesterId: integer("semester_id").notNull().references(() => semesters.id),
  sentAt: integer("sent_at", { mode: "timestamp" }).$defaultFn(() => new Date()), // email sent date
  emailId: text("email_id"), // from Resend or provider
  inByStatus: text("in_by_status"), // e.g. invited, replied, scheduled, declined
  followUpDate: text("follow_up_date"), // ISO date
  replied: integer("replied", { mode: "boolean" }).default(false), // tied to form responses
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  firms: many(firms),
}));

export const firmsRelations = relations(firms, ({ one, many }) => ({
  organization: one(organizations, { fields: [firms.organizationId], references: [organizations.id] }),
  events: many(events),
  speakerLogs: many(speakerLogs),
  invites: many(invites),
}));

export const semestersRelations = relations(semesters, ({ many }) => ({
  events: many(events),
  speakerLogs: many(speakerLogs),
  invites: many(invites),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  firm: one(firms, { fields: [events.firmId], references: [firms.id] }),
  semester: one(semesters, { fields: [events.semesterId], references: [semesters.id] }),
}));

export const speakerLogsRelations = relations(speakerLogs, ({ one }) => ({
  firm: one(firms, { fields: [speakerLogs.firmId], references: [firms.id] }),
  semester: one(semesters, { fields: [speakerLogs.semesterId], references: [semesters.id] }),
  event: one(events, { fields: [speakerLogs.eventId], references: [events.id] }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  firm: one(firms, { fields: [invites.firmId], references: [firms.id] }),
  semester: one(semesters, { fields: [invites.semesterId], references: [semesters.id] }),
}));

export const schedulingSubmissionsRelations = relations(schedulingSubmissions, ({ one }) => ({
  firm: one(firms, { fields: [schedulingSubmissions.firmId], references: [firms.id] }),
  semester: one(semesters, { fields: [schedulingSubmissions.semesterId], references: [semesters.id] }),
}));
