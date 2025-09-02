import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../lib/mcp/auth';
import { CapabilitiesResponse, MCPToolResponse } from '../../../lib/mcp/types';
import { createHttpErrorResponse } from '../../../lib/mcp/error-handler';

export async function GET(request: NextRequest) {
  // MCP Server Discovery endpoint
  try {
    const auth = await authenticateAgent(request);
    
    if (!auth.success) {
      return createHttpErrorResponse(auth.error?.message || 'Authentication failed', 401);
    }

    // Simple capabilities response for now
    const capabilities: CapabilitiesResponse = {
      categories: ['Tents & Shelters', 'Sleeping Systems', 'Backpacks', 'Lighting', 'Cooking & Stoves'],
      price_ranges: {
        'Tents & Shelters': { min: 89, max: 899 },
        'Sleeping Systems': { min: 79, max: 549 },
        'Backpacks': { min: 89, max: 449 }
      },
      shipping_regions: ['Continental US', 'Alaska & Hawaii', 'Canada'],
      specialties: ['Ultralight backpacking gear', 'Car camping essentials', 'Hiking equipment']
    };

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
    return createHttpErrorResponse(error, 500);
  }
}

export async function POST(request: NextRequest) {
  // MCP Tool execution endpoint
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return createHttpErrorResponse(auth.error?.message || 'Authentication failed', 401);
  }

  try {
    const body = await request.json();
    const { tool, params, session_id } = body;

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
        return NextResponse.json(await addToCart({ ...params, sessionId: session_id }, session_id || 'temp'));

      case 'update_cart':
        const { updateCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await updateCart({ ...params, sessionId: session_id }, session_id || 'temp'));

      case 'remove_from_cart':
        const { removeFromCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await removeFromCart({ ...params, sessionId: session_id }, session_id || 'temp'));

      case 'get_cart':
        const { getCartEstimate } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await getCartEstimate(session_id || 'temp', auth.agentId!));

      case 'bulk_add_to_cart':
        const { bulkAddToCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await bulkAddToCart({ ...params, sessionId: session_id }, session_id || 'temp'));

      case 'clear_cart':
        const { clearCart } = await import('../../../lib/mcp/tools/cart');
        return NextResponse.json(await clearCart(session_id || 'temp', auth.agentId!));

      case 'place_order':
        const { placeOrder } = await import('../../../lib/mcp/tools/order');
        return NextResponse.json(await placeOrder(params, session_id || 'temp'));

      case 'get_order_status':
        const { getOrderStatus } = await import('../../../lib/mcp/tools/order');
        return NextResponse.json(await getOrderStatus(params.orderId, auth.agentId!));

      case 'get_shipping_options':
        const { getShippingOptions } = await import('../../../lib/mcp/tools/shipping');
        return NextResponse.json(await getShippingOptions(params, session_id || 'temp'));

      case 'validate_payment':
        const { validatePayment } = await import('../../../lib/mcp/tools/payment');
        return NextResponse.json(await validatePayment(params, session_id || 'temp'));

      case 'create_agent':
        const { createAgent } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await createAgent(params, session_id || 'temp', auth.agentId!));

      case 'list_agents':
        const { listAgents } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await listAgents(params.page || 1, params.limit || 20, session_id || 'temp', auth.agentId!));

      case 'get_agent_details':
        const { getAgentDetails } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await getAgentDetails(params.agentId, session_id || 'temp', auth.agentId!));

      case 'update_agent_status':
        const { updateAgentStatus } = await import('../../../lib/mcp/tools/agent');
        return NextResponse.json(await updateAgentStatus(params.agentId, params.isActive, session_id || 'temp', auth.agentId!));

      default:
        return createHttpErrorResponse(
          `Unknown tool: ${tool}. Available tools: search_products, assess_request, get_recommendations, add_to_cart, update_cart, remove_from_cart, get_cart, bulk_add_to_cart, clear_cart, place_order, get_order_status, get_shipping_options, validate_payment, create_agent, list_agents, get_agent_details, update_agent_status`,
          400
        );
    }
  } catch (error) {
    console.error('MCP tool execution error:', error);
    return createHttpErrorResponse(error, 500);
  }
}