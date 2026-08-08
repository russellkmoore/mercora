import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAgent,
  hasAgentManagementPermission,
  hasPermission,
  requiredScopeForTool,
} from '../../../lib/mcp/auth';
import { CapabilitiesResponse, MCPToolResponse } from '../../../lib/mcp/types';
import { getCatalogCapabilities } from '../../../lib/mcp/catalog';
import { parseAgentContext } from '../../../lib/mcp/context';
import { createHttpErrorResponse } from '../../../lib/mcp/error-handler';
import { isPlainRecord } from '../../../lib/public-request-validation';

export async function GET(request: NextRequest) {
  // MCP Server Discovery endpoint
  try {
    const auth = await authenticateAgent(request);
    
    if (!auth.success) {
      return createHttpErrorResponse(auth.error?.message || 'Authentication failed', 401);
    }

    const capabilities: CapabilitiesResponse = await getCatalogCapabilities();

    const response: MCPToolResponse<CapabilitiesResponse> = {
      success: true,
      data: capabilities,
      context: {
        session_id: 'discovery',
        agent_id: auth.agentId!,
        processing_time_ms: 5
      },
      metadata: {
        can_fulfill_percentage: 95,
        estimated_satisfaction: 90,
        next_actions: ['Search for products', 'Create session', 'Get recommendations']
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('MCP capabilities error:', error);
    return createHttpErrorResponse(
      error instanceof Error ? error : new Error('Unknown error occurred'),
      500
    );
  }
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return createHttpErrorResponse('Invalid JSON body', 400);
  }

  if (!body || typeof body !== 'object') {
    return createHttpErrorResponse('Invalid JSON body', 400);
  }

  const tool = typeof body.tool === 'string' ? body.tool : '';
  if (!tool) return createHttpErrorResponse('tool is required', 400);
  if (body.params != null && !isPlainRecord(body.params)) {
    return createHttpErrorResponse('params must be an object', 400);
  }
  if (body.session_id != null && typeof body.session_id !== 'string') {
    return createHttpErrorResponse('session_id must be a string', 400);
  }
  const params: any = body.params ?? {};
  const session_id = body.session_id as string | undefined;
  const auth = await authenticateAgent(request, { isOrderOp: tool === 'place_order' });
  
  if (!auth.success) {
    return createHttpErrorResponse(auth.error?.message || 'Authentication failed', 401);
  }

  params.agent_context = parseAgentContext(request, auth.agentId) ?? { agentId: auth.agentId! };

  const managementTools = new Set([
    'create_agent',
    'list_agents',
    'get_agent_details',
    'update_agent_status',
    'rotate_agent_key',
  ]);
  if (managementTools.has(tool) && !hasAgentManagementPermission(auth.permissions)) {
    return createHttpErrorResponse(
      'Agent management requires admin or agents:manage permission',
      403,
    );
  }

  const requiredScope = requiredScopeForTool(tool);
  if (requiredScope && !hasPermission(auth.permissions, requiredScope)) {
    return createHttpErrorResponse(`This tool requires '${requiredScope}' permission`, 403);
  }

  try {

    // Route to appropriate tool handler
    switch (tool) {
      case 'search_products':
        const { searchProductsWithContext } = await import('../../../lib/mcp/tools/search');
        return NextResponse.json(await searchProductsWithContext(params, session_id || 'temp'));

      case 'assess_request':
        const { assessFulfillmentCapability } = await import('../../../lib/mcp/tools/assess');
        return NextResponse.json(await assessFulfillmentCapability(params, session_id || 'temp'));

      case 'get_recommendations':
        const { getRecommendations } = await import('../../../lib/mcp/tools/recommend');
        return NextResponse.json(await getRecommendations(params, session_id || 'temp'));

      case 'add_to_cart':
        const { addToCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await addToCart({ ...params, sessionId: session_id || 'temp' }, session_id || 'temp', auth.agentId!));

      case 'update_cart':
        const { updateCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await updateCart({ ...params, sessionId: session_id || 'temp' }, session_id || 'temp', auth.agentId!));

      case 'remove_from_cart':
        const { removeFromCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await removeFromCart({ ...params, sessionId: session_id || 'temp' }, session_id || 'temp', auth.agentId!));

      case 'get_cart':
        const { getCartEstimate } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await getCartEstimate(session_id || 'temp', auth.agentId!));

      case 'bulk_add_to_cart':
        const { bulkAddToCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await bulkAddToCart({ ...params, sessionId: session_id || 'temp' }, session_id || 'temp', auth.agentId!));

      case 'clear_cart':
        const { clearCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await clearCart(session_id || 'temp', auth.agentId!));

      case 'place_order':
        const { placeOrder } = await import('../../../lib/mcp/tools/order');
        return NextResponse.json(await placeOrder(params, session_id || 'temp', auth.agentId!));

      case 'create_payment_intent':
        const { createAgentPaymentIntent } = await import('../../../lib/mcp/tools/payment');
        return NextResponse.json(await createAgentPaymentIntent(params, session_id || 'temp', auth.agentId!));

      case 'get_order_status':
        const { getOrderStatus } = await import('../../../lib/mcp/tools/order');
        return NextResponse.json(await getOrderStatus(params.orderId, auth.agentId!));

      case 'get_shipping_options':
        const { getShippingOptions } = await import('../../../lib/mcp/tools/shipping');
        return NextResponse.json(await getShippingOptions(params, session_id || 'temp', auth.agentId!));

      case 'validate_payment':
        const { validatePayment } = await import('../../../lib/mcp/tools/payment');
        return NextResponse.json(await validatePayment(params, session_id || 'temp', auth.agentId!));

      case 'create_agent':
        const { createAgent } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await createAgent(params, session_id || 'temp', auth.agentId!, auth.permissions));

      case 'list_agents':
        const { listAgents } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await listAgents(params.page || 1, params.limit || 20, session_id || 'temp', auth.agentId!));

      case 'get_agent_details':
        const { getAgentDetails } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await getAgentDetails(params.agentId, session_id || 'temp', auth.agentId!));

      case 'update_agent_status':
        const { updateAgentStatus } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await updateAgentStatus(
          params.agentId,
          params.isActive,
          session_id || 'temp',
          auth.agentId!,
          auth.permissions,
        ));

      case 'rotate_agent_key':
        const { rotateAgentCredential } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await rotateAgentCredential(
          params.agentId,
          params.apiKeyTtlDays,
          session_id || 'temp',
          auth.agentId!,
          auth.permissions,
        ));

      default:
        return createHttpErrorResponse(
          `Unknown tool: ${tool}. Available tools: search_products, assess_request, get_recommendations, add_to_cart, update_cart, remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, create_payment_intent, place_order, get_order_status, get_shipping_options, validate_payment, create_agent, list_agents, get_agent_details, update_agent_status, rotate_agent_key`,
          400
        );
    }
  } catch (error) {
    console.error('MCP tool execution error:', error);
    return createHttpErrorResponse(
      error instanceof Error ? error : new Error('Unknown error occurred'),
      500
    );
  }
}
