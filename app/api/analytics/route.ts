import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

interface WebVitalMetric {
  name: string;
  value: number;
  id: string;
  delta?: number;
  entries?: any[];
  navigationType?: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
}

export async function POST(request: NextRequest) {
  try {
    const metric: WebVitalMetric = await request.json();
    
    // Log to console for development - in production you'd send to analytics service
    console.log('📊 Core Web Vitals:', {
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      rating: metric.rating,
      id: metric.id,
      timestamp: new Date().toISOString()
    });

    // In production, you would send this to your analytics service:
    // - Google Analytics
    // - DataDog
    // - New Relic
    // - Custom analytics dashboard
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to process metric' }, { status: 500 });
  }
}