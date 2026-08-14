import type { AlertConfiguration, AlertEmailMessage } from './core';

export type AlertFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function emailBinding(source: unknown): SendEmail | null {
  try {
    if (!source || (typeof source !== 'object' && typeof source !== 'function')) return null;
    const binding = Reflect.get(source, 'ALERT_EMAIL');
    return binding !== null && (typeof binding === 'object' || typeof binding === 'function') &&
      typeof Reflect.get(binding, 'send') === 'function'
      ? binding as SendEmail
      : null;
  } catch {
    return null;
  }
}

async function sendWithCloudflare(
  message: AlertEmailMessage,
  source: unknown,
): Promise<void> {
  const binding = emailBinding(source);
  if (!binding) throw new Error('Cloudflare Email Sending binding is unavailable');
  await binding.send({
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The bounded delivery result is intentionally not read or logged.
  }
}

async function sendWithResend(
  message: AlertEmailMessage,
  config: AlertConfiguration,
  fetcher: AlertFetch,
): Promise<void> {
  if (!config.resendApiKey) throw new Error('Resend API key is unavailable');
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  await discardBody(response);
  if (!response.ok) throw new Error('Resend alert delivery failed');
}

export async function sendAlertEmail(
  message: AlertEmailMessage,
  config: AlertConfiguration,
  source: unknown,
  fetcher: AlertFetch = fetch,
): Promise<void> {
  if (config.provider === 'cloudflare') {
    await sendWithCloudflare(message, source);
    return;
  }
  await sendWithResend(message, config, fetcher);
}
