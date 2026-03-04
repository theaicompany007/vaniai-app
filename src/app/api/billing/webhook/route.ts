import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendSubscriptionConfirmation } from '@/lib/email';

export const runtime = 'nodejs';

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  // Skip verification in dummy mode
  const isDummy = process.env.RAZORPAY_DUMMY === 'true' || !process.env.RAZORPAY_KEY_ID;
  if (!isDummy && webhookSecret) {
    if (!verifyRazorpaySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event as string;
  const admin = getSupabaseAdmin();

  console.log(`Razorpay webhook: ${event}`);

  if (event === 'subscription.activated') {
    const sub = (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>;
    const rzpSubId = (sub?.entity as Record<string, unknown>)?.id as string;
    const planId = (sub?.entity as Record<string, unknown>)?.plan_id as string;

    if (rzpSubId) {
      // Update subscription status
      const { data: subscription } = await admin
        .from('subscriptions')
        .update({ status: 'active', current_start: new Date().toISOString() })
        .eq('razorpay_subscription_id', rzpSubId)
        .select('org_id, plan_id')
        .single();

      if (subscription) {
        // Upgrade org tier
        await admin
          .from('organizations')
          .update({ subscription_tier: subscription.plan_id, subscription_status: 'active' })
          .eq('id', subscription.org_id);

        // Send confirmation email
        const { data: member } = await admin
          .from('org_memberships')
          .select('user_id')
          .eq('org_id', subscription.org_id)
          .eq('role', 'admin')
          .single();

        if (member) {
          const { data: userData } = await admin.auth.admin.getUserById(member.user_id);
          if (userData?.user?.email) {
            sendSubscriptionConfirmation(
              userData.user.email,
              planId ?? subscription.plan_id,
              'See dashboard for details'
            ).catch(console.error);
          }
        }
      }
    }
  }

  if (event === 'subscription.charged') {
    const payment = (payload.payload as Record<string, unknown>)?.payment as Record<string, unknown>;
    const entity = (payment?.entity as Record<string, unknown>) ?? {};
    const rzpSubId = entity.subscription_id as string;
    const amount = entity.amount as number;
    const currency = (entity.currency as string) ?? 'INR';

    if (rzpSubId) {
      const { data: subscription } = await admin
        .from('subscriptions')
        .select('id, org_id')
        .eq('razorpay_subscription_id', rzpSubId)
        .single();

      if (subscription) {
        await admin.from('invoices').insert({
          org_id: subscription.org_id,
          subscription_id: subscription.id,
          razorpay_invoice_id: entity.id as string,
          amount,
          currency,
          status: 'paid',
          paid_at: new Date().toISOString(),
        });

        // Update subscription renewal dates
        await admin
          .from('subscriptions')
          .update({
            current_start: new Date().toISOString(),
            current_end: new Date(Date.now() + 30 * 86400000).toISOString(),
          })
          .eq('id', subscription.id);
      }
    }
  }

  if (event === 'subscription.cancelled' || event === 'subscription.completed') {
    const sub = (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>;
    const rzpSubId = (sub?.entity as Record<string, unknown>)?.id as string;

    if (rzpSubId) {
      const { data: subscription } = await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('razorpay_subscription_id', rzpSubId)
        .select('org_id')
        .single();

      if (subscription) {
        await admin
          .from('organizations')
          .update({ subscription_status: 'cancelled' })
          .eq('id', subscription.org_id);
      }
    }
  }

  if (event === 'subscription.halted' || event === 'subscription.paused') {
    const sub = (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown>;
    const rzpSubId = (sub?.entity as Record<string, unknown>)?.id as string;

    if (rzpSubId) {
      await admin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('razorpay_subscription_id', rzpSubId);
    }
  }

  return NextResponse.json({ received: true });
}
