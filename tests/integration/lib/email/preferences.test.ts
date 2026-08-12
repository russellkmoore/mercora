import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { isEmailSuppressed, suppressEmail } from "@/lib/models/email-preferences";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/lib/db/schema";

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.exec("DELETE FROM email_preferences");
});

describe("email preferences in real D1", () => {
  it("records replayed POST semantics idempotently and matches normalized email", async () => {
    const database = drizzle(env.DB, { schema });
    await suppressEmail(" Person@Example.COM ", "review_reminders", database);
    await suppressEmail("person@example.com", "review_reminders", database);
    expect(await isEmailSuppressed("PERSON@example.com", "review_reminders", database)).toBe(true);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM email_preferences").first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("leaves populated-baseline recipients eligible when no row exists", async () => {
    const database = drizzle(env.DB, { schema });
    expect(await isEmailSuppressed("eligible@example.com", "review_reminders", database)).toBe(false);
  });
});
