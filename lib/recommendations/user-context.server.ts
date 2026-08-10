import "server-only";

import { getOrdersByUserId } from "@/lib/models/mach/orders";
import type { RecsUserContext } from "./types";

const RECENT_PURCHASE_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000;
const MAX_RECENT_PURCHASES = 100;

export async function buildServerUserContext(
  userId: string | null | undefined,
): Promise<RecsUserContext | null> {
  if (!userId) return null;

  try {
    const orders = await getOrdersByUserId(userId);
    const cutoff = Date.now() - RECENT_PURCHASE_WINDOW_MS;
    const recentPurchases = orders
      .filter((order) => {
        const createdAt = order.created_at ? Date.parse(order.created_at) : Number.NaN;
        return Number.isFinite(createdAt) && createdAt >= cutoff;
      })
      .flatMap((order) => order.items ?? [])
      .map((item) => item.product_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map(String)
      .slice(0, MAX_RECENT_PURCHASES);

    return { orders, recentPurchases };
  } catch (error) {
    console.error("buildServerUserContext: failed to load orders", error);
    return null;
  }
}
