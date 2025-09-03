import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent } from '../../../../../../lib/mcp/auth';
import { MCPToolResponse } from '../../../../../../lib/mcp/types';

interface TrackingResponse {
  orderId: string;
  trackingNumber?: string;
  status: string;
  location?: string;
  estimatedDelivery: string;
  history: Array<{
    date: string;
    status: string;
    location?: string;
    description: string;
  }>;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const orderId = request.nextUrl.searchParams.get('orderId');
    const trackingNumber = request.nextUrl.searchParams.get('trackingNumber');
    
    if (!orderId && !trackingNumber) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'orderId or trackingNumber parameter is required'
        }
      }, { status: 400 });
    }

    // Mock tracking data - in production, integrate with shipping provider
    const trackingData: TrackingResponse = {
      orderId: orderId || 'unknown',
      trackingNumber: trackingNumber || `VT${Date.now()}`,
      status: 'in_transit',
      location: 'Oakland, CA',
      estimatedDelivery: '2 business days',
      history: [
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'order_confirmed',
          description: 'Order confirmed and processing'
        },
        {
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'shipped',
          location: 'Warehouse, CA',
          description: 'Package shipped from warehouse'
        },
        {
          date: new Date().toISOString(),
          status: 'in_transit',
          location: 'Oakland, CA',
          description: 'Package in transit to destination'
        }
      ]
    };

    const response: MCPToolResponse<TrackingResponse> = {
      success: true,
      data: trackingData,
      context: {
        session_id: 'tracking',
        agent_id: auth.agentId!,
        processing_time_ms: Date.now() - Date.now()
      },
      metadata: {
        can_fulfill_percentage: 100,
        estimated_satisfaction: 95,
        next_actions: ['Monitor delivery progress', 'Prepare for package arrival']
      }
    };
    
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'TRACKING_ERROR',
        message: 'Failed to get tracking information',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Alternative POST method for tracking lookup
  const auth = await authenticateAgent(request);
  
  if (!auth.success) {
    return NextResponse.json({
      success: false,
      error: auth.error
    }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const { orderId, trackingNumber } = body;
    
    if (!orderId && !trackingNumber) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_IDENTIFIER',
          message: 'orderId or trackingNumber is required'
        }
      }, { status: 400 });
    }

    // Use the same logic as GET method
    const url = new URL(request.url);
    if (orderId) url.searchParams.set('orderId', orderId);
    if (trackingNumber) url.searchParams.set('trackingNumber', trackingNumber);
    
    const modifiedRequest = new NextRequest(url, { method: 'GET', headers: request.headers });
    return GET(modifiedRequest);
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'TRACKING_ERROR',
        message: 'Failed to get tracking information',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}