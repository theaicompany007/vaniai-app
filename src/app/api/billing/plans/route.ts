import { NextResponse } from 'next/server';
import { PLANS, formatAmount } from '@/lib/billing';

export async function GET() {
  const plans = Object.entries(PLANS).map(([id, plan]) => ({
    id,
    ...plan,
    formatted_amount: formatAmount(plan.amount),
  }));
  return NextResponse.json(plans);
}
