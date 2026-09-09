"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  GIFT_CARD_MESSAGE_MAX_LENGTH,
  GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH,
  validateGiftCardDeliveryDate,
  validateGiftCardMessage,
  validateGiftCardRecipientEmail,
  validateGiftCardRecipientName,
  type GiftCardFieldError,
} from "@/lib/gift-cards/customization";
import type { GiftCardCustomization } from "@/lib/types/cartitem";

interface GiftCardRecipientFormProps {
  available: boolean;
  onAdd: (customization: GiftCardCustomization) => void;
}

function emailErrorCopy(code: GiftCardFieldError): string {
  switch (code) {
    case "required":
      return "Recipient email is required.";
    case "too_long":
      return "Email must be 254 characters or fewer.";
    case "control_characters":
      return "Remove unsupported characters and try again.";
    default:
      return "Enter a valid email address.";
  }
}

function nameErrorCopy(code: GiftCardFieldError): string {
  return code === "too_long"
    ? "Name must be 100 characters or fewer."
    : "Remove unsupported characters and try again.";
}

function messageErrorCopy(code: GiftCardFieldError): string {
  return code === "too_long"
    ? "Message must be 500 characters or fewer."
    : "Remove unsupported characters and try again.";
}

function dateErrorCopy(): string {
  return "Choose a delivery date between today and one year from now.";
}

/**
 * Local-calendar-date string (YYYY-MM-DD) for a Date, built from local date
 * components rather than `toISOString()` — `toISOString()` always reports
 * the UTC calendar date, which is tomorrow's date for any shopper west of
 * UTC once local clock time crosses the UTC-midnight rollover (all US time
 * zones, most evenings).
 */
function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeDeliveryDateBounds(): { min: string; max: string } {
  const today = localIsoDate(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const maxDate = new Date(Date.UTC(year, month - 1, day));
  maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 1);
  return { min: today, max: maxDate.toISOString().slice(0, 10) };
}

export default function GiftCardRecipientForm({ available, onAdd }: GiftCardRecipientFormProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  const [sendToMyself, setSendToMyself] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [nameBlurred, setNameBlurred] = useState(false);
  const [message, setMessage] = useState("");
  const [messageBlurred, setMessageBlurred] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dateBlurred, setDateBlurred] = useState(false);

  const emailError = validateGiftCardRecipientEmail(recipientEmail);
  const nameError = validateGiftCardRecipientName(recipientName);
  const messageError = validateGiftCardMessage(message);
  const dateError = validateGiftCardDeliveryDate(deliveryDate);

  const showEmailError = emailBlurred && emailError !== null;
  const showNameError = nameBlurred && nameError !== null;
  const showMessageError = messageBlurred && messageError !== null;
  const showDateError = dateBlurred && dateError !== null;

  const emailErrorId = "gift-card-recipient-email-error";
  const nameErrorId = "gift-card-recipient-name-error";
  const messageErrorId = "gift-card-message-error";
  const dateErrorId = "gift-card-delivery-date-error";

  const { min: todayIso, max: maxDeliveryDate } = computeDeliveryDateBounds();

  const isDisabled =
    !available ||
    emailError !== null ||
    nameError !== null ||
    messageError !== null ||
    dateError !== null;

  const handleSendToMyselfChange = (checked: boolean) => {
    setSendToMyself(checked);
    if (checked) {
      if (user?.primaryEmailAddress) {
        setRecipientEmail(user.primaryEmailAddress.emailAddress);
      }
      if (typeof user?.fullName === "string" && user.fullName.length > 0) {
        setRecipientName(user.fullName);
      }
    }
  };

  const handleAdd = () => {
    const customization: GiftCardCustomization = { recipientEmail };
    if (recipientName.trim().length > 0) customization.recipientName = recipientName;
    if (message.trim().length > 0) customization.message = message;
    if (deliveryDate.trim().length > 0) customization.deliveryDate = deliveryDate;
    onAdd(customization);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Recipient details</h3>

      {isLoaded && isSignedIn && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="gift-card-send-to-myself"
            checked={sendToMyself}
            onCheckedChange={(checked) => handleSendToMyselfChange(checked === true)}
          />
          <Label htmlFor="gift-card-send-to-myself">Send to myself</Label>
        </div>
      )}

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
            {emailErrorCopy(emailError as GiftCardFieldError)}
          </p>
        )}
      </div>

      <div>
        <div className="flex justify-between">
          <Label htmlFor="gift-card-recipient-name">Recipient name (optional)</Label>
          <span
            className={`text-xs ${
              recipientName.length > GIFT_CARD_RECIPIENT_NAME_MAX_LENGTH
                ? "text-danger"
                : "text-muted-foreground"
            }`}
          >
            {recipientName.length}/100
          </span>
        </div>
        <Input
          id="gift-card-recipient-name"
          name="recipientName"
          placeholder="Jordan Smith"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          onBlur={() => setNameBlurred(true)}
          aria-invalid={showNameError}
          aria-describedby={showNameError ? nameErrorId : undefined}
        />
        {showNameError && (
          <p id={nameErrorId} role="alert" className="mt-1 text-xs text-danger">
            {nameErrorCopy(nameError as GiftCardFieldError)}
          </p>
        )}
      </div>

      <div>
        <div className="flex justify-between">
          <Label htmlFor="gift-card-message">Gift message (optional)</Label>
          <span
            className={`text-xs ${
              message.length > GIFT_CARD_MESSAGE_MAX_LENGTH ? "text-danger" : "text-muted-foreground"
            }`}
          >
            {message.length}/500
          </span>
        </div>
        <Textarea
          id="gift-card-message"
          name="message"
          rows={3}
          maxLength={GIFT_CARD_MESSAGE_MAX_LENGTH}
          placeholder="Add a personal note"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setMessageBlurred(true)}
          aria-invalid={showMessageError}
          aria-describedby={showMessageError ? messageErrorId : undefined}
        />
        {showMessageError && (
          <p id={messageErrorId} role="alert" className="mt-1 text-xs text-danger">
            {messageErrorCopy(messageError as GiftCardFieldError)}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="gift-card-delivery-date">Delivery date (optional)</Label>
        <input
          id="gift-card-delivery-date"
          type="date"
          name="deliveryDate"
          min={todayIso}
          max={maxDeliveryDate}
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          onBlur={() => setDateBlurred(true)}
          aria-invalid={showDateError}
          aria-describedby={showDateError ? dateErrorId : undefined}
          className="border-border placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger dark:bg-surface-elevated/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm"
        />
        {showDateError && (
          <p id={dateErrorId} role="alert" className="mt-1 text-xs text-danger">
            {dateErrorCopy()}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Leave blank to send as soon as payment completes, or pick a date to send it then.
        </p>
      </div>

      <Button className="w-full sm:w-auto" disabled={isDisabled} onClick={handleAdd}>
        Add to Cart
      </Button>
    </div>
  );
}
