import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-helpers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PLANS, type PlanId } from '@/lib/billing';
import { sendSubscriptionConfirmation } from '@/lib/email';

const isDummy =
  process.env.RAZORPAY_DUMMY === 'true' || !process.env.RAZORPAY_KEY_ID;

async function validatePromoCode(
  admin: ReturnType<typeof getSupabaseAdmin>,
  code: string,
  planId: string
): Promise<{ valid: boolean; discountPaise: number; discountType: string; discountValue: number }> {
  const { data: promo } = await admin
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (!promo) return { valid: false, discountPaise: 0, discountType: '', discountValue: 0 };
  if (promo.expires_at && new Date(promo.expires_at) < new Date())
    return { valid: false, discountPaise: 0, discountType: '', discountValue: 0 };
  if (promo.max_uses && promo.current_uses >= promo.max_uses)
    return { valid: false, discountPaise: 0, discountType: '', discountValue: 0 };
  if (!promo.applicable_plans.includes(planId))
    return { valid: false, discountPaise: 0, discountType: '', discountValue: 0 };

  const plan = PLANS[planId as PlanId];
  let discountPaise = 0;
  if (promo.discount_type === 'percentage') {
    discountPaise = Math.round((plan.amount * promo.discount_value) / 100);
  } else {
    discountPaise = promo.discount_value;
  }

  return {
    valid: true,
    discountPaise,
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
  };
}

export async function POST(req: Request) {
  const { ctx, response } = await requireAuth();
  if (!ctx) return response!;

  const { plan_id, promo_code } = await req.json();

  if (!plan_id || !(plan_id in PLANS)) {
    return NextResponse.json({ error: 'Invalid plan_id' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const plan = PLANS[plan_id as PlanId];
  let discountPaise = 0;
  let promoCode: string | null = null;

  // Validate promo code if provided
  if (promo_code) {
    const result = await validatePromoCode(admin, promo_code, plan_id);
    if (result.valid) {
      discountPaise = result.discountPaise;
      promoCode = promo_code.toUpperCase();
      // Increment usage — try RPC first, fall back to manual select+update
      try {
        await admin.rpc('increment_promo_uses', { promo: promoCode });
      } catch {
        const { data } = await admin
          .from('promo_codes')
          .select('current_uses')
          .eq('code', promoCode!)
          .single();
        if (data) {
          await admin
            .from('promo_codes')
            .update({ current_uses: (data.current_uses as number) + 1 })
            .eq('code', promoCode!);
        }
      }
    }
  }

  const finalAmount = Math.max(0, plan.amount - discountPaise);

  if (isDummy) {
    // Insert dummy active subscription
    const { data: sub } = await admin
      .from('subscriptions')
      .insert({
        org_id: ctx.orgId,
        plan_id,
        status: 'active',
        is_dummy: true,
        amount: finalAmount,
        currency: 'INR',
        discount_amount: discountPaise,
        promo_code: promoCode,
        current_start: new Date().toISOString(),
        current_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .select()
      .single();

    // Upgrade org tier
    await admin
      .from('organizations')
      .update({ subscription_tier: plan_id, subscription_status: 'active' })
      .eq('id', ctx.orgId);

    // Get user email for confirmation
    const { data: members } = await admin
      .from('org_memberships')
      .select('user_id')
      .eq('org_id', ctx.orgId)
      .eq('role', 'admin')
      .single();

    if (members) {
      const { data: userData } = await admin.auth.admin.getUserById(members.user_id);
      if (userData?.user?.email) {
        sendSubscriptionConfirmation(
          userData.user.email,
          plan.name,
          `₹${(finalAmount / 100).toLocaleString('en-IN')}`
        ).catch(console.error);
      }
    }

    return NextResponse.json({ success: true, dummy: true, subscription_id: sub?.id });
  }

  // Real Razorpay integration
  try {
    const Razorpay = (await import('razorpay')).default;
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const planEnvKey = `RAZORPAY_PLAN_ID_${plan_id.toUpperCase()}`;
    const razorpayPlanId = process.env[planEnvKey];

    if (!razorpayPlanId) {
      return NextResponse.json(
        { error: `Missing ${planEnvKey} env variable` },
        { status: 500 }
      );
    }

    const subscription = await rzp.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: 12,
      quantity: 1,
    });

    await admin.from('subscriptions').insert({
      org_id: ctx.orgId,
      plan_id,
      razorpay_subscription_id: subscription.id,
      status: 'created',
      amount: finalAmount,
      currency: 'INR',
      discount_amount: discountPaise,
      promo_code: promoCode,
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      key: process.env.RAZORPAY_KEY_ID,
      amount: finalAmount,
      currency: 'INR',
    });
  } catch (e) {
    console.error('Razorpay error:', e);
    return NextResponse.json({ error: 'Payment provider error' }, { status: 500 });
  }
}
