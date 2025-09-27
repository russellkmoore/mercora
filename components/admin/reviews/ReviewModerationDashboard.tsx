"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRating } from "@/components/reviews/StarRating";
import type {
  Review,
  ReviewModerationMetrics,
  ReviewReminderCandidate,
  ReviewStatus,
} from "@/lib/types";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Flag,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldBan,
  Sparkles,
} from "lucide-react";

interface ReviewQueueResponse {
  data?: Review[];
  meta?: { total?: number };
  metrics?: ReviewModerationMetrics;
}

interface ReminderResponse {
  data?: ReviewReminderCandidate[];
}

type ApiErrorPayload = { error?: string } | null;
interface ReminderTriggerResponse {
  sent?: number;
  failed?: Array<{ error: string }>;
}

const limit = 20;

const statusOptions: Array<{ label: string; value: "all" | ReviewStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "Needs review", value: "needs_review" },
  { label: "Pending", value: "pending" },
  { label: "Published", value: "published" },
  { label: "Suppressed", value: "suppressed" },
  { label: "Auto rejected", value: "auto_rejected" },
];

const statusStyles: Record<ReviewStatus, string> = {
  pending: "bg-sky-500/20 text-sky-200",
  needs_review: "bg-yellow-500/20 text-yellow-200",
  published: "bg-emerald-500/20 text-emerald-200",
  suppressed: "bg-slate-500/20 text-slate-200",
  auto_rejected: "bg-rose-500/20 text-rose-200",
};

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function relativeTime(value?: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (Math.abs(diffMinutes) < 1) return "just now";
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60 * 24 * 365, "year"],
    [60 * 24 * 30, "month"],
    [60 * 24 * 7, "week"],
    [60 * 24, "day"],
    [60, "hour"],
    [1, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [minutes, unit] of units) {
    if (Math.abs(diffMinutes) >= minutes) {
      const value = Math.round(diffMinutes / minutes);
      return rtf.format(-value, unit);
    }
  }
  return "just now";
}

function moderationReasons(review: Review) {
  const reasons = review.automated_moderation?.reasons ?? [];
  const detected = review.automated_moderation?.detectedPhrases ?? [];
  const warnings = review.automated_moderation?.warnings ?? [];
  const tags = new Set<string>();
  reasons.forEach((reason) => tags.add(reason));
  warnings.forEach((warning) => tags.add(`warn:${warning}`));
  detected.forEach((phrase) => tags.add(`match:${phrase}`));
  return Array.from(tags);
}

export default function ReviewModerationDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [metrics, setMetrics] = useState<ReviewModerationMetrics | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("needs_review");
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    review: Review;
    action: "publish" | "needs_review" | "suppressed";
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionNotify, setActionNotify] = useState(false);
  const [responseReview, setResponseReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseNotify, setResponseNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminders, setReminders] = useState<ReviewReminderCandidate[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String((page - 1) * limit));
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (flaggedOnly) {
        params.set("flagged", "true");
      }
      if (searchTerm) {
        params.set("search", searchTerm);
      }
      params.set("includeMetrics", "true");

      const response = await fetch(`/api/admin/reviews?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load review queue");
      }

      const payload = await response.json() as ReviewQueueResponse;
      setReviews(payload.data ?? []);
      setTotal(payload.meta?.total ?? 0);
      if (payload.metrics) {
        setMetrics(payload.metrics);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [flaggedOnly, page, searchTerm, statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / limit));
  }, [total]);

  const fetchReminders = useCallback(async () => {
    try {
      setLoadingReminders(true);
      setReminderError(null);
      const response = await fetch(`/api/admin/reviews/reminders?limit=25`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load reminder candidates");
      }
      const payload = await response.json() as ReminderResponse;
      setReminders(payload.data ?? []);
    } catch (err) {
      console.error(err);
      setReminderError(err instanceof Error ? err.message : "Unable to load reminders");
    } finally {
      setLoadingReminders(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, flaggedOnly]);

  const openActionDialog = (review: Review, action: "publish" | "needs_review" | "suppressed") => {
    setPendingAction({ review, action });
    setActionNotes(review.moderation_notes ?? "");
    setActionNotify(action === "publish");
  };

  const closeActionDialog = () => {
    setPendingAction(null);
    setActionNotes("");
    setActionNotify(false);
  };

  const handleActionConfirm = async () => {
    if (!pendingAction) return;
    const statusMap: Record<typeof pendingAction.action, ReviewStatus> = {
      publish: "published",
      needs_review: "needs_review",
      suppressed: "suppressed",
    };

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/reviews/${pendingAction.review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusMap[pendingAction.action],
          moderationNotes: actionNotes || undefined,
          notifyCustomer: actionNotify,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as ApiErrorPayload;
        throw new Error(payload?.error ?? "Unable to update review");
      }

      toast.success("Review status updated");
      closeActionDialog();
      fetchQueue();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update review");
    } finally {
      setSaving(false);
    }
  };

  const submitResponse = async () => {
    if (!responseReview) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/reviews/${responseReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: responseText,
          notifyCustomer: responseNotify,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as ApiErrorPayload;
        throw new Error(payload?.error ?? "Unable to send response");
      }
      toast.success("Response saved");
      setResponseReview(null);
      setResponseText("");
      setResponseNotify(true);
      fetchQueue();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send response");
    } finally {
      setSaving(false);
    }
  };

  const sendRemindersNow = async () => {
    try {
      setSendingReminders(true);
      const response = await fetch(`/api/admin/reviews/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: reminders.length }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as ApiErrorPayload;
        throw new Error(payload?.error ?? "Unable to send reminders");
      }
      const payload = await response.json() as ReminderTriggerResponse;
      const sentCount = payload?.sent ?? 0;
      const failedCount = payload?.failed?.length ?? 0;
      toast.success(
        `Sent ${sentCount} reminder${sentCount === 1 ? "" : "s"}`,
        failedCount
          ? {
              description: `${failedCount} reminder${failedCount === 1 ? "" : "s"} could not be delivered. Check logs for details.`,
            }
          : undefined
      );
      fetchReminders();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  const renderStatusBadge = (status: ReviewStatus) => (
    <Badge className={statusStyles[status]}>{status.replace("_", " ")}</Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review moderation</h1>
          <p className="text-sm text-muted-foreground">
            Triage incoming feedback, resolve flags, and keep the storefront trustworthy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="ghost" onClick={fetchReminders} disabled={loadingReminders}>
            <Mail className="mr-2 h-4 w-4" /> Refresh reminders
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-yellow-400" /> Needs attention
            </CardTitle>
            <CardDescription className="text-3xl font-semibold text-white">
              {metrics?.needs_review ?? 0}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4 text-emerald-400" /> Published reviews
            </CardTitle>
            <CardDescription className="text-3xl font-semibold text-white">
              {metrics?.published ?? 0}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Flag className="h-4 w-4 text-rose-400" /> Flagged items
            </CardTitle>
            <CardDescription className="text-3xl font-semibold text-white">
              {metrics?.flagged ?? 0}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-sky-400" /> Last publish
            </CardTitle>
            <CardDescription className="text-white">
              {metrics?.last_published_at ? relativeTime(metrics.last_published_at) : "No reviews yet"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Filter className="h-5 w-5 text-muted-foreground" /> Moderation queue
            </CardTitle>
            <CardDescription>
              Filter by status, search for keywords, and review the latest submissions.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchTerm(searchDraft.trim());
              setPage(1);
            }}
          >
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
              >
                <SelectTrigger className="w-48 border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="border border-neutral-700 bg-neutral-900 text-white">
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <Switch
                  id="flagged-toggle"
                  checked={flaggedOnly}
                  onCheckedChange={(checked) => setFlaggedOnly(checked)}
                />
                <Label htmlFor="flagged-toggle" className="text-sm text-muted-foreground">
                  Flagged only
                </Label>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="Search review text, product, or reason"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {reviews.length} of {total} review{total === 1 ? "" : "s"}
            </div>
          </form>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Moderation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id} className="align-top">
                    <TableCell className="max-w-[220px] whitespace-normal">
                      <div className="font-semibold text-white">
                        {review.product_name ?? review.product_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Order #{review.order_id}
                      </div>
                      {review.is_verified && (
                        <Badge variant="outline" className="mt-1 text-xs text-emerald-200">
                          Verified purchase
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{review.customer_id}</div>
                      {review.admin_response && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-emerald-200">
                          <MessageCircle className="h-3 w-3" /> Responded
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-sm text-white">{review.rating.toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(review.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm text-white">{relativeTime(review.submitted_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(review.submitted_at)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal">
                      <div className="space-y-2">
                        {review.body && (
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {review.body}
                          </div>
                        )}
                        {moderationReasons(review).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {moderationReasons(review).map((reason) => {
                              const [type, value] = reason.includes(":") ? reason.split(":") : ["reason", reason];
                              const label = type === "warn" ? value : type === "match" ? `Match: ${value}` : value;
                              return (
                                <Badge key={reason} variant="outline" className="text-xs text-amber-200">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        {review.flags?.length ? (
                          <div className="flex items-center gap-1 text-xs text-rose-300">
                            <ShieldBan className="h-3 w-3" /> {review.flags.length} flag
                            {review.flags.length === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog(review, "needs_review")}
                          title="Route this review back to manual moderation"
                          disabled={loading || saving}
                        >
                          Escalate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openActionDialog(review, "suppressed")}
                          title="Hide this review from the storefront"
                          disabled={loading || saving}
                        >
                          Hide
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openActionDialog(review, "publish")}
                          title="Approve and publish this review"
                          disabled={loading || saving}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setResponseReview(review);
                            setResponseText(review.admin_response ?? "");
                            setResponseNotify(true);
                          }}
                          title="Send a customer-facing reply without changing review status"
                          disabled={saving}
                        >
                          Reply
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reviews.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No reviews match the current filters.
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Loading reviews…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5 text-muted-foreground" /> Review reminders
          </CardTitle>
          <CardDescription>
            Delivered orders without feedback in the reminder window. Send a follow-up email in one click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reminderError && <p className="text-sm text-rose-400">{reminderError}</p>}
          {loadingReminders ? (
            <p className="text-sm text-muted-foreground">Checking for reminder candidates…</p>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding reminders right now.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {reminders.map((candidate) => (
                <div key={`${candidate.orderId}:${candidate.productId}`} className="rounded-lg border border-border p-4">
                  <div className="text-sm font-semibold text-white">
                    {candidate.productName ?? candidate.productId}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Order #{candidate.orderId}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Delivered {relativeTime(candidate.deliveredAt)}
                  </div>
                  {candidate.customerEmail && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" /> {candidate.customerEmail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={sendRemindersNow} disabled={sendingReminders || reminders.length === 0}>
              {sendingReminders ? "Sending…" : `Send ${reminders.length || ""} reminder${reminders.length === 1 ? "" : "s"}`}
            </Button>
            <Button variant="outline" onClick={fetchReminders} disabled={loadingReminders}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) {
            closeActionDialog();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "publish" && "Approve review"}
              {pendingAction?.action === "needs_review" && "Request moderator review"}
              {pendingAction?.action === "suppressed" && "Suppress review"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.review?.product_name ?? pendingAction?.review?.product_id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Label htmlFor="moderation-notes" className="text-sm text-muted-foreground">
              Moderation notes (visible to admins)
            </Label>
            <Textarea
              id="moderation-notes"
              rows={4}
              value={actionNotes}
              onChange={(event) => setActionNotes(event.target.value)}
              placeholder="Explain the decision for future context"
            />
            <div className="flex items-center gap-2">
              <Switch id="notify-customer" checked={actionNotify} onCheckedChange={setActionNotify} />
              <Label htmlFor="notify-customer" className="text-sm text-muted-foreground">
                Email the customer about this decision
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActionConfirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(responseReview)}
        onOpenChange={(open) => {
          if (!open) {
            setResponseReview(null);
            setResponseText("");
            setResponseNotify(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to customer</DialogTitle>
            <DialogDescription>
              Message will appear publicly beneath the review for {responseReview?.product_name ?? responseReview?.product_id}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={6}
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            placeholder="Thank you for the feedback!"
          />
          <div className="flex items-center gap-2">
            <Switch id="response-notify" checked={responseNotify} onCheckedChange={setResponseNotify} />
            <Label htmlFor="response-notify" className="text-sm text-muted-foreground">
              Email the customer when this response posts
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseReview(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitResponse} disabled={saving || !responseText.trim()}>
              {saving ? "Saving…" : "Send response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
