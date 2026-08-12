-- O01 reservation: email preference and suppression state.
--
-- Absence of a row preserves the populated-baseline behavior: the recipient
-- has not opted out of an eligible non-transactional email category.
CREATE TABLE email_preferences (
  email TEXT NOT NULL COLLATE NOCASE,
  category TEXT NOT NULL,
  suppressed_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unsubscribe',
  PRIMARY KEY (email, category),
  CHECK (length(email) BETWEEN 3 AND 254),
  CHECK (category IN ('all_non_transactional', 'review_reminders')),
  CHECK (source IN ('unsubscribe', 'account'))
);

CREATE INDEX idx_email_preferences_category_email
  ON email_preferences(category, email);
