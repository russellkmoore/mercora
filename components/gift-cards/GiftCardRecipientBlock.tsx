import type { GiftCardCustomization } from "@/lib/types/cartitem";

export const GIFT_CARD_MESSAGE_PREVIEW_LENGTH = 80;

export function truncateGiftCardMessage(message: string): string {
  // RED-phase stub: intentionally does not truncate yet.
  return message;
}

export interface GiftCardRecipientBlockProps {
  customization: GiftCardCustomization;
  tone?: "default" | "inverse";
  variant?: "compact" | "detail";
}

export default function GiftCardRecipientBlock({
  customization,
}: GiftCardRecipientBlockProps) {
  // RED-phase stub: only the To line, only the default tone, only compact sizing.
  return (
    <div className="text-xs">
      <p className="mt-1 text-foreground">To: {customization.recipientEmail}</p>
    </div>
  );
}
