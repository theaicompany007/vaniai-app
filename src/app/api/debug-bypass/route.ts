/**
 * Temporary: returns BYPASS_USAGE_LIMITS as seen by the Node process at runtime.
 * Use to verify container env is visible: curl http://localhost:3100/api/debug-bypass
 * Remove this file once bypass is confirmed working.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const value = process.env['BYPASS_USAGE_LIMITS'];
  return NextResponse.json({
    BYPASS_USAGE_LIMITS: value ?? '(not set)',
    rawType: typeof value,
    wouldBypass: value === 'true',
  });
}
