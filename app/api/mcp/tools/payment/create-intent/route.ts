import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAgent,
  hasPermission,
  requiredScopeForTool,
} from '../../../../../../lib/mcp/auth';
import { createAgentPaymentIntent } from '../../../../../../lib/mcp/tools/payment';

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const requiredScope = requiredScopeForTool('create_payment_intent')!;
  if (!hasPermission(auth.permissions, requiredScope)) {
    return NextResponse.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'This tool requires place:orders permission' },
    }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request body' } }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const sessionId = typeof input.session_id === 'string' ? input.session_id : '';
  if (!sessionId) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_REQUEST', message: 'session_id is required' } }, { status: 400 });
  }

  const result = await createAgentPaymentIntent({
    shippingAddress: input.shippingAddress,
    shippingMethodId: typeof input.shippingMethodId === 'string' ? input.shippingMethodId : undefined,
    shippingOption: typeof input.shippingOption === 'string' ? input.shippingOption : undefined,
    discountCodes: Array.isArray(input.discountCodes)
      ? input.discountCodes.filter((code): code is string => typeof code === 'string')
      : undefined,
    giftCardToken: typeof input.giftCardToken === 'string' ? input.giftCardToken : undefined,
  }, sessionId, auth.agentId!);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
