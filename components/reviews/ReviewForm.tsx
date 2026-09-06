'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { cn } from '@/lib/utils';
import type { Review } from '@/lib/types';

interface ReviewSubmitResponse {
  data: Review;
  error?: string;
}

interface ReviewFormProps {
  orderId: string;
  orderItemId?: string;
  productId: string;
  productName: string;
  existingReview?: Review;
  onSubmitted(review: Review): void;
  disabledReason?: string | null;
  canSubmit?: boolean;
}

const ratingScale = [1, 2, 3, 4, 5];

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ReviewForm({
  orderId,
  orderItemId,
  productId,
  productName,
  existingReview,
  onSubmitted,
  disabledReason,
  canSubmit = true,
}: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setTitle(existingReview.title ?? '');
      setBody(existingReview.body ?? '');
    }
  }, [existingReview]);

  const statusLabel = useMemo(() => {
    if (!existingReview) return null;
    switch (existingReview.status) {
      case 'pending':
        return 'Pending moderation';
      case 'needs_review':
        return 'Queued for manual review';
      case 'published':
        return 'Published';
      case 'suppressed':
        return 'Suppressed';
      case 'auto_rejected':
        return 'Automatically rejected';
      default:
        return existingReview.status;
    }
  }, [existingReview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || existingReview) return;
    if (disabledReason) {
      setError(disabledReason);
      return;
    }
    if (!canSubmit) {
      setError('Reviews unlock once delivery is confirmed.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderItemId,
          productId,
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      });

      const payload = await response.json() as ReviewSubmitResponse;

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to submit review.');
      }

      const review: Review = payload.data;
      onSubmitted(review);
      setSuccess('Thanks! Your review is now awaiting moderation.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (existingReview) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-4 text-sm text-foreground">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">Your review</p>
          {statusLabel && (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                existingReview.status === 'published'
                  ? 'bg-success/20 text-success'
                  : existingReview.status === 'pending'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-border text-foreground'
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div className="mb-2 flex items-center gap-2 text-primary" aria-label={`Rating ${existingReview.rating} of 5`}>
          {ratingScale.map((value) => (
            <span key={value}>{value <= (existingReview?.rating ?? 0) ? '★' : '☆'}</span>
          ))}
        </div>
        {existingReview.title && <p className="mb-2 text-base font-semibold text-foreground">{existingReview.title}</p>}
        {existingReview.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{existingReview.body}</p>}
        <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
          {existingReview.submitted_at && (
            <div className="flex gap-2">
              <dt className="min-w-[90px] font-medium text-muted-foreground">Submitted</dt>
              <dd>{formatDate(existingReview.submitted_at) ?? existingReview.submitted_at}</dd>
            </div>
          )}
          {existingReview.published_at && (
            <div className="flex gap-2">
              <dt className="min-w-[90px] font-medium text-muted-foreground">Published</dt>
              <dd>{formatDate(existingReview.published_at) ?? existingReview.published_at}</dd>
            </div>
          )}
        </dl>
        {existingReview.admin_response && (
          <div className="mt-4 rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Merchant response</p>
            <p className="mt-1 text-sm text-foreground">{existingReview.admin_response}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface-elevated p-4">
      {!canSubmit && (
        <p className="text-xs text-warning">
          {disabledReason || 'Reviews unlock once delivery is confirmed.'}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={`rating-${productId}`}>
          Rate your experience
        </label>
        <div className="flex items-center gap-1" id={`rating-${productId}`}>
          {ratingScale.map((value) => (
            <button
              type="button"
              key={value}
              className={cn(
                'text-2xl transition-colors',
                value <= rating ? 'text-primary' : 'text-muted-foreground hover:text-primary/70'
              )}
              onClick={() => {
                if (!canSubmit) return;
                setRating(value);
              }}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={value === rating}
              disabled={!canSubmit}
            >
              {value <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={`title-${productId}`}>
          Review title <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <input
          id={`title-${productId}`}
          type="text"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={`Share your thoughts on ${productName}`}
          disabled={submitting || !canSubmit}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={`body-${productId}`}>
          Your review <span className="text-xs text-muted-foreground">(minimum 30 characters)</span>
        </label>
        <textarea
          id={`body-${productId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Tell other shoppers about fit, quality, and performance."
          rows={4}
          minLength={30}
          required
          disabled={submitting || !canSubmit}
        />
      </div>

      {disabledReason && canSubmit && (
        <p className="text-xs text-warning">{disabledReason}</p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Reviews are screened for inappropriate language and links.</p>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground"
          disabled={submitting || !canSubmit}
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
