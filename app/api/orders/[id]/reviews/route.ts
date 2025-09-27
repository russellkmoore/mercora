import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getReviewsForOrder, submitReviewForOrderItem } from '@/lib/models';
import type { ReviewSubmissionPayload } from '@/lib/types';

function resolveStatusFromError(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes('not found')) return 404;
  if (normalized.includes('only review products from your own orders')) return 403;
  if (normalized.includes('only review items after the order has been delivered')) return 409;
  if (normalized.includes('already submitted')) return 409;
  if (normalized.includes('prohibited content')) return 422;
  if (normalized.includes('required') || normalized.includes('must be')) return 400;
  return 400;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const reviews = await getReviewsForOrder(orderId, userId);
    return NextResponse.json({ data: reviews });
  } catch (error) {
    console.error('Failed to fetch order reviews', error);
    return NextResponse.json({ error: 'Unable to load reviews.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    const payload = await request.json() as ReviewSubmissionPayload;
    const review = await submitReviewForOrderItem({
      ...payload,
      orderId,
      customerId: userId,
    });

    return NextResponse.json({ data: review });
  } catch (error) {
    console.error('Failed to submit review', error);
    const message = error instanceof Error ? error.message : 'Unable to submit review.';
    return NextResponse.json({ error: message }, { status: resolveStatusFromError(message) });
  }
}
