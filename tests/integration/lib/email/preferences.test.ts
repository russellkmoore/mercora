import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { applyTestMigrations } from "../../helpers/d1";
import { isEmailSuppressed, suppressEmail } from "@/lib/models/email-preferences";

beforeEach(async () => {
  await applyTestMigrations();
  await env.DB.exec("DELETE FROM email_preferences");
});

describe("email preferences in real D1", () => {
  it("records replayed POST semantics idempotently and matches normalized email", async () => {
    await suppressEmail(" Person@Example.COM ", "review_reminders");
    await suppressEmail("person@example.com", "review_reminders");
    expect(await isEmailSuppressed("PERSON@example.com", "review_reminders")).toBe(true);
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM email_preferences").first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("leaves populated-baseline recipients eligible when no row exists", async () => {
    expect(await isEmailSuppressed("eligible@example.com", "review_reminders")).toBe(false);
  });
});
