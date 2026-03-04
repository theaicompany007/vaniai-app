import { NextResponse } from 'next/server';

/**
 * Resend Webhook Handler
 * Receives email delivery events from Resend (bounced, delivered, complained, etc.)
 * Webhook registered at: https://vaniai.ngrok.app/api/webhooks/resend
 *
 * Events: email.sent, email.delivered, email.bounced, email.complained
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const eventType = payload?.type as string | undefined;

    if (!eventType) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    console.log(`[Resend webhook] ${eventType}`, {
      email_id: payload?.data?.email_id,
      to: payload?.data?.to,
      subject: payload?.data?.subject,
    });

    switch (eventType) {
      case 'email.bounced':
        // TODO: mark contact email as invalid or suppress future sends
        console.warn(`[Resend] Bounce for: ${payload?.data?.to}`);
        break;

      case 'email.complained':
        // TODO: add to suppression list
        console.warn(`[Resend] Spam complaint from: ${payload?.data?.to}`);
        break;

      case 'email.delivered':
        // Email successfully delivered — no action needed
        break;

      case 'email.sent':
        // Accepted by Resend — no action needed
        break;

      default:
        console.log(`[Resend webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[Resend webhook] Error:', e);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
