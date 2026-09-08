"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validateGiftCardRecipientEmail } from "@/lib/gift-cards/customization";
import type { GiftCardFieldError } from "@/lib/gift-cards/customization";
import type { GiftCardCustomization } from "@/lib/types/cartitem";

interface GiftCardRecipientFormProps {
  available: boolean;
  onAdd: (customization: GiftCardCustomization) => void;
}

const EMAIL_ERROR_COPY: Record<GiftCardFieldError, string> = {
  required: "Recipient email is required.",
  invalid_format: "Enter a valid email address.",
  too_long: "Email must be 254 characters or fewer.",
  control_characters: "Remove unsupported characters and try again.",
  out_of_range: "Choose a delivery date between today and one year from now.",
};

export default function GiftCardRecipientForm({ available, onAdd }: GiftCardRecipientFormProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);

  const emailError = validateGiftCardRecipientEmail(recipientEmail);
  const showEmailError = emailBlurred && emailError !== null;
  const emailErrorId = "gift-card-recipient-email-error";

  const isDisabled = !available || emailError !== null;

  const handleAdd = () => {
    onAdd({ recipientEmail });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Recipient details</h3>

      <div>
        <Label htmlFor="gift-card-recipient-email">Recipient email</Label>
        <Input
          id="gift-card-recipient-email"
          type="email"
          inputMode="email"
          name="recipientEmail"
          placeholder="recipient@example.com"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          onBlur={() => setEmailBlurred(true)}
          aria-invalid={showEmailError}
          aria-describedby={showEmailError ? emailErrorId : undefined}
        />
        {showEmailError && (
          <p id={emailErrorId} role="alert" className="mt-1 text-xs text-danger">
            {EMAIL_ERROR_COPY[emailError as GiftCardFieldError]}
          </p>
        )}
      </div>

      <Button className="w-full sm:w-auto" disabled={isDisabled} onClick={handleAdd}>
        Add to Cart
      </Button>
    </div>
  );
}
