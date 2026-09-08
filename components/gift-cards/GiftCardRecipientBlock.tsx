import type { GiftCardCustomization } from "@/lib/types/cartitem";

export const GIFT_CARD_MESSAGE_PREVIEW_LENGTH = 80;

/**
 * Truncates by code point, not UTF-16 code unit, so an astral character
 * (e.g. an emoji) at the boundary is never split into an unpaired surrogate.
 */
export function truncateGiftCardMessage(message: string): string {
  const codePoints = Array.from(message);
  if (codePoints.length <= GIFT_CARD_MESSAGE_PREVIEW_LENGTH) {
    return message;
  }
  return `${codePoints.slice(0, GIFT_CARD_MESSAGE_PREVIEW_LENGTH).join("")}…`;
}

export interface GiftCardRecipientBlockProps {
  customization: GiftCardCustomization;
  /** default: main tokens (checkout/confirmation/account); inverse: cart drawer */
  tone?: "default" | "inverse";
  /** default: compact (cart/checkout, truncated message); detail: account order page (full message) */
  variant?: "compact" | "detail";
}

export default function GiftCardRecipientBlock({
  customization,
  tone = "default",
  variant = "compact",
}: GiftCardRecipientBlockProps) {
  const toneClasses =
    tone === "inverse"
      ? { to: "text-on-inverse", rest: "text-muted-on-inverse" }
      : { to: "text-foreground", rest: "text-muted-foreground" };

  const wrapperClass = variant === "detail" ? "text-sm space-y-0.5" : "text-xs";

  const to = customization.recipientName
    ? `To: ${customization.recipientName} <${customization.recipientEmail}>`
    : `To: ${customization.recipientEmail}`;

  return (
    <div className={wrapperClass}>
      <p className={`mt-1 ${toneClasses.to}`}>{to}</p>
      {customization.deliveryDate && (
        <p className={`mt-1 ${toneClasses.rest}`}>Deliver: {customization.deliveryDate}</p>
      )}
      {customization.message && variant === "detail" && (
        <p className={`mt-1 ${toneClasses.rest} whitespace-pre-line`}>
          {customization.message}
        </p>
      )}
      {customization.message && variant !== "detail" && (
        <p className={`mt-1 ${toneClasses.rest}`} title={customization.message}>
          {truncateGiftCardMessage(customization.message)}
        </p>
      )}
    </div>
  );
}
