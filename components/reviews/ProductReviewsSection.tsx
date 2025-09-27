"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StarRating } from "@/components/reviews/StarRating";
import type { Review, ProductReviewEligibility } from "@/lib/types";
import type { NormalizedProductRating } from "@/lib/utils/ratings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatReviewDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getReviewTimestamp(review: Review): number {
  const candidate = review.published_at ?? review.submitted_at ?? review.created_at ?? null;
  if (!candidate) return 0;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

interface ProductReviewsSectionProps {
  reviews: Review[];
  ratingSummary: NormalizedProductRating | null;
  eligibility?: ProductReviewEligibility;
}

export function ProductReviewsSection({
  reviews,
  ratingSummary,
  eligibility,
}: ProductReviewsSectionProps) {
  const reviewList = useMemo(() => (Array.isArray(reviews) ? [...reviews] : []), [reviews]);
  const reviewCount = reviewList.length;

  const [ratingFilter, setRatingFilter] = useState<"all" | number>("all");
  const [sortBy, setSortBy] = useState<"recent" | "highest" | "lowest">("recent");

  const highlightPositive = useMemo(() => {
    return (
      reviewList
        .filter((review) => review.rating >= 4 && (review.body?.trim().length ?? 0) > 0)
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        })[0] ?? null
    );
  }, [reviewList]);

  const highlightCritical = useMemo(() => {
    const severe = reviewList
      .filter((review) => review.rating <= 2 && (review.body?.trim().length ?? 0) > 0)
      .sort((a, b) => {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return getReviewTimestamp(b) - getReviewTimestamp(a);
      });

    if (severe.length) {
      return severe[0];
    }

    return (
      reviewList
        .filter((review) => review.rating <= 3 && (review.body?.trim().length ?? 0) > 0)
        .sort((a, b) => {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        })[0] ?? null
    );
  }, [reviewList]);

  const highlightEntries = useMemo(() => {
    const entries: Array<{ key: string; tone: "positive" | "critical"; review: Review; label: string }> = [];
    if (highlightPositive) {
      entries.push({
        key: `positive-${highlightPositive.id}`,
        tone: "positive",
        review: highlightPositive,
        label: "Top positive review",
      });
    }
    if (highlightCritical && (!highlightPositive || highlightCritical.id !== highlightPositive.id)) {
      entries.push({
        key: `critical-${highlightCritical.id}`,
        tone: "critical",
        review: highlightCritical,
        label: "Top critical review",
      });
    }
    return entries;
  }, [highlightPositive, highlightCritical]);

  const sortedReviews = useMemo(() => {
    const list = [...reviewList];
    if (!list.length) return list;

    switch (sortBy) {
      case "highest":
        return list.sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        });
      case "lowest":
        return list.sort((a, b) => {
          if (a.rating !== b.rating) return a.rating - b.rating;
          return getReviewTimestamp(b) - getReviewTimestamp(a);
        });
      case "recent":
      default:
        return list.sort((a, b) => getReviewTimestamp(b) - getReviewTimestamp(a));
    }
  }, [reviewList, sortBy]);

  const filteredReviews = useMemo(() => {
    if (ratingFilter === "all") {
      return sortedReviews;
    }
    return sortedReviews.filter((review) => review.rating === ratingFilter);
  }, [sortedReviews, ratingFilter]);

  const ratingSelectValue = ratingFilter === "all" ? "all" : String(ratingFilter);

  const hasDistribution = Boolean(
    ratingSummary?.distribution &&
      [1, 2, 3, 4, 5].some((bucket) => (ratingSummary.distribution?.[bucket] ?? 0) > 0)
  );

  const lastPublishedLabel = ratingSummary?.lastPublishedAt
    ? formatReviewDate(ratingSummary.lastPublishedAt)
    : null;

  return (
    <div className="space-y-6">
      {eligibility?.canReview && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Share your experience</h2>
              <p className="text-sm text-gray-400">
                Reviews are limited to verified purchases—head to your order history to add yours.
              </p>
            </div>
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              Review your order
            </Link>
          </div>
        </div>
      )}

      {ratingSummary ? (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <StarRating value={ratingSummary.average} size="lg" />
              <div>
                <p className="text-3xl font-semibold text-white">{ratingSummary.average.toFixed(1)}</p>
                <p className="text-sm text-gray-400">
                  {ratingSummary.count} review{ratingSummary.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {lastPublishedLabel && (
              <p className="text-xs text-gray-500 sm:text-right">Last review {lastPublishedLabel}</p>
            )}
          </div>
          {hasDistribution && ratingSummary?.distribution && (
            <dl className="mt-4 space-y-2">
              {[5, 4, 3, 2, 1].map((bucket) => {
                const count = ratingSummary.distribution?.[bucket] ?? 0;
                const percent = ratingSummary.count > 0 ? Math.round((count / ratingSummary.count) * 100) : 0;
                return (
                  <div key={bucket} className="flex items-center gap-3 text-xs text-gray-300">
                    <dt className="w-10 font-medium text-gray-400">{bucket}★</dt>
                    <dd className="flex-1">
                      <div className="h-2 rounded-full bg-neutral-800">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </dd>
                    <span className="w-10 text-right text-gray-500">{count}</span>
                  </div>
                );
              })}
            </dl>
          )}
        </section>
      ) : (
        <p className="text-sm text-gray-500">
          No reviews yet — be the first to share your experience after delivery.
        </p>
      )}

      {highlightEntries.length > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Review highlights</h2>
            <p className="text-sm text-gray-400">Balanced perspective from shoppers at both ends of the rating scale.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {highlightEntries.map(({ key, tone, review, label }) => (
              <article
                key={key}
                className="rounded-md border border-neutral-700 bg-neutral-950 p-4"
                aria-label={label}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating value={review.rating} size="sm" />
                      <span className="text-sm font-semibold text-white">{review.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium ${tone === "positive" ? "text-green-300" : "text-amber-300"}`}
                  >
                    {tone === "positive" ? "Positive" : "Critical"}
                  </span>
                </div>
                {review.title && <h3 className="mt-3 text-base font-semibold text-white">{review.title}</h3>}
                {review.body && (
                  <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{review.body}</p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  {formatReviewDate(review.published_at ?? review.submitted_at ?? review.created_at) ?? "Recently updated"}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {reviewCount > 0 && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">All reviews</h2>
              <p className="text-sm text-gray-400">
                Showing {filteredReviews.length} of {reviewCount} review{reviewCount === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                value={ratingSelectValue}
                onValueChange={(value) => setRatingFilter(value === "all" ? "all" : Number(value))}
              >
                <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 sm:w-40">
                  <SelectValue placeholder="Filter rating" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  <SelectItem value="all" className="text-white hover:bg-neutral-700">
                    All ratings
                  </SelectItem>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem
                      key={`filter-${value}`}
                      value={String(value)}
                      className="text-white hover:bg-neutral-700"
                    >
                      {value} star{value === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 sm:w-40">
                  <SelectValue placeholder="Sort reviews" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  <SelectItem value="recent" className="text-white hover:bg-neutral-700">
                    Most recent
                  </SelectItem>
                  <SelectItem value="highest" className="text-white hover:bg-neutral-700">
                    Highest rated
                  </SelectItem>
                  <SelectItem value="lowest" className="text-white hover:bg-neutral-700">
                    Lowest rated
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {filteredReviews.length > 0 ? (
              filteredReviews.map((review) => {
                const submittedLabel =
                  formatReviewDate(review.published_at ?? review.submitted_at ?? review.created_at) ?? "Recently updated";

                return (
                  <article
                    key={review.id}
                    className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
                    aria-label={`Review rated ${review.rating} stars`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-sm font-semibold text-white">{review.rating.toFixed(1)}</span>
                        {review.is_verified && (
                          <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs font-medium text-green-200">
                            Verified purchase
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{submittedLabel}</p>
                    </div>
                    {review.title && (
                      <h3 className="mt-3 text-base font-semibold text-white">{review.title}</h3>
                    )}
                    {review.body && (
                      <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{review.body}</p>
                    )}
                    {review.media?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.media.map((media) => (
                          <a
                            key={media.id ?? media.url}
                            href={media.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-orange-300 underline"
                          >
                            View {media.type === "video" ? "video" : "photo"}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {review.admin_response && (
                      <div className="mt-4 rounded-md border border-neutral-700 bg-neutral-900 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-400">Merchant response</p>
                        <p className="mt-1 text-sm text-gray-200 whitespace-pre-wrap">{review.admin_response}</p>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-gray-400">No reviews match the selected filters yet.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
