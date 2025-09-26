'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { cn } from '@/lib/utils';
import type { Review } from '@/lib/types';

interface ReviewFormProps {
  orderId: string;
  orderItemId?: string;
  productId: string;
  productName: string;
  existingReview?: Review;
  onSubmitted(review: Review): void;
  disabledReason?: string | null;
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
  }, [existingReview?.id]);

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
  }, [existingReview?.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || existingReview) return;
    if (disabledReason) {
      setError(disabledReason);
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

      const payload = await response.json();

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
      <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm text-gray-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-semibold text-white">Your review</p>
          {statusLabel && (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                existingReview.status === 'published'
                  ? 'bg-green-500/20 text-green-300'
                  : existingReview.status === 'pending'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-neutral-700 text-neutral-200'
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div className="mb-2 flex items-center gap-2 text-yellow-400" aria-label={`Rating ${existingReview.rating} of 5`}>
          {ratingScale.map((value) => (
            <span key={value}>{value <= (existingReview?.rating ?? 0) ? '★' : '☆'}</span>
          ))}
        </div>
        {existingReview.title && <p className="mb-2 text-base font-semibold text-white">{existingReview.title}</p>}
        {existingReview.body && <p className="whitespace-pre-wrap text-sm text-gray-300">{existingReview.body}</p>}
        <dl className="mt-3 space-y-1 text-xs text-gray-400">
          {existingReview.submitted_at && (
            <div className="flex gap-2">
              <dt className="min-w-[90px] font-medium text-gray-500">Submitted</dt>
              <dd>{formatDate(existingReview.submitted_at) ?? existingReview.submitted_at}</dd>
            </div>
          )}
          {existingReview.published_at && (
            <div className="flex gap-2">
              <dt className="min-w-[90px] font-medium text-gray-500">Published</dt>
              <dd>{formatDate(existingReview.published_at) ?? existingReview.published_at}</dd>
            </div>
          )}
        </dl>
        {existingReview.admin_response && (
          <div className="mt-4 rounded-md border border-neutral-700 bg-neutral-950 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Merchant response</p>
            <p className="mt-1 text-sm text-gray-200">{existingReview.admin_response}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor={`rating-${productId}`}>
          Rate your experience
        </label>
        <div className="flex items-center gap-1" id={`rating-${productId}`}>
          {ratingScale.map((value) => (
            <button
              type="button"
              key={value}
              className={cn(
                'text-2xl transition-colors',
                value <= rating ? 'text-yellow-400' : 'text-neutral-600 hover:text-yellow-200'
              )}
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={value === rating}
            >
              {value <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor={`title-${productId}`}>
          Review title <span className="text-xs text-gray-500">(optional)</span>
        </label>
        <input
          id={`title-${productId}`}
          type="text"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder={`Share your thoughts on ${productName}`}
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white" htmlFor={`body-${productId}`}>
          Your review <span className="text-xs text-gray-500">(minimum 30 characters)</span>
        </label>
        <textarea
          id={`body-${productId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="Tell other shoppers about fit, quality, and performance."
          rows={4}
          minLength={30}
          required
          disabled={submitting}
        />
      </div>

      {disabledReason && (
        <p className="text-xs text-amber-300">{disabledReason}</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Reviews are screened for inappropriate language and links.</p>
        <button
          type="submit"
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          disabled={submitting || Boolean(disabledReason)}
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
