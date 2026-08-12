import { and, eq, inArray } from "drizzle-orm";
import { getDbAsync } from "@/lib/db";
import { email_preferences } from "@/lib/db/schema/email-preferences";
import { normalizeEmail } from "@/lib/email/unsubscribe-token";
import type { EmailCategory } from "@/lib/email/policy";

export async function suppressEmail(email: string, category: EmailCategory): Promise<void> {
  const db = await getDbAsync();
  await db.insert(email_preferences).values({
    email: normalizeEmail(email), category, suppressed_at: new Date().toISOString(), source: "unsubscribe",
  }).onConflictDoNothing();
}

/** Fail closed: lookup/configuration errors suppress eligible mail. */
export async function isEmailSuppressed(email: string, category: EmailCategory): Promise<boolean> {
  try {
    const normalized = normalizeEmail(email);
    if (!normalized) return true;
    const db = await getDbAsync();
    const [row] = await db.select({ email: email_preferences.email }).from(email_preferences)
      .where(and(eq(email_preferences.email, normalized), inArray(email_preferences.category, [category, "all_non_transactional"])))
      .limit(1);
    return Boolean(row);
  } catch {
    return true;
  }
}
