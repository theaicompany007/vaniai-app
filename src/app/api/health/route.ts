import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Returns 200 for load balancer health checks (e.g. GCP). No auth required.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
