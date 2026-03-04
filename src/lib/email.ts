import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@vaniai.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/** World-class shared layout: Vani logo + "Vani AI - Sales Intelligence Platform" + "Don't app, just talk." */
function vaniEmailLayout(options: {
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}) {
  const { body, ctaLabel, ctaUrl, footer } = options;
  const ctaHtml =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;background:#00d9ff;color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel} →</a>`
      : '';
  const footerHtml = footer
    ? `<p style="color:#6b7280;font-size:12px;margin-top:28px;">${footer}</p>`
    : '';
  return `
    <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
          <div style="width:44px;height:44px;background:linear-gradient(135deg,#0d0d14 0%,#12121a 100%);border-radius:12px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,217,255,0.2);">
            <span style="color:#00d9ff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">V</span>
          </div>
          <div>
            <div style="font-size:17px;font-weight:600;color:#fff;letter-spacing:-0.3px;">Vani AI - Sales Intelligence Platform</div>
            <div style="font-size:13px;color:#00d9ff;font-weight:500;margin-top:2px;">Don't app, just talk.</div>
          </div>
        </div>
      </div>
      ${body}
      ${ctaHtml ? `<div style="margin-top:24px;">${ctaHtml}</div>` : ''}
      ${footerHtml}
    </div>
  `;
}

export async function sendWelcomeEmail(to: string, orgName: string) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h1 style="font-size:24px;font-weight:600;color:#fff;margin:0 0 8px;">Welcome, ${orgName}!</h1>
        <p style="color:#8892a4;margin:0 0 24px;line-height:1.5;">Your 14-day trial has started. Here's how to make the most of your Vani AI agents:</p>
        <div style="background:#0d0d14;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0 0 12px;font-size:14px;"><strong style="color:#00d9ff;">Vigil</strong> <span style="color:#8892a4;">— Real-time buying signals from your target accounts</span></p>
          <p style="margin:0 0 12px;font-size:14px;"><strong style="color:#a78bfa;">Vivek</strong> <span style="color:#8892a4;">— Deep research on any company or market</span></p>
          <p style="margin:0 0 12px;font-size:14px;"><strong style="color:#34d399;">Varta</strong> <span style="color:#8892a4;">— Pitches, proposals, and briefs in seconds</span></p>
          <p style="margin:0 0 12px;font-size:14px;"><strong style="color:#fb923c;">Vidya</strong> <span style="color:#8892a4;">— AI sales co-pilot for account intelligence</span></p>
          <p style="margin:0;font-size:14px;"><strong style="color:#60a5fa;">Vaahan</strong> <span style="color:#8892a4;">— Pipeline strategy and deal prioritization</span></p>
        </div>
      `,
      ctaLabel: 'Open Vani',
      ctaUrl: `${APP_URL}/home`,
      footer: "You're receiving this because you signed up for Vani AI.",
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Welcome to Vani AI — your sales intelligence platform',
      html,
    });
  } catch (e) {
    console.error('Failed to send welcome email:', e);
  }
}

export async function sendSubscriptionConfirmation(
  to: string,
  plan: string,
  amount: string
) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 12px;">Your ${plan} plan is active</h2>
        <p style="color:#8892a4;margin:0 0 8px;">Amount: <strong style="color:#e2e8f0;">${amount}/month</strong></p>
        <p style="color:#8892a4;margin:0;">Full access to all ${plan} features.</p>
      `,
      ctaLabel: 'Open Vani',
      ctaUrl: `${APP_URL}/home`,
      footer: 'You\'re receiving this because you subscribed to Vani AI.',
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: ${plan} plan activated`,
      html,
    });
  } catch (e) {
    console.error('Failed to send subscription confirmation:', e);
  }
}

export async function sendSignalDigest(to: string, orgName: string, signalCount: number) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 12px;">Vigil found ${signalCount} new signals</h2>
        <p style="color:#8892a4;margin:0;line-height:1.5;">Your AI signal agent detected <strong style="color:#e2e8f0;">${signalCount} buying signals</strong> for your target accounts.</p>
      `,
      ctaLabel: 'View Signals',
      ctaUrl: `${APP_URL}/home/signals`,
      footer: `Notification for ${orgName}.`,
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: ${signalCount} new signals for ${orgName}`,
      html,
    });
  } catch (e) {
    console.error('Failed to send signal digest:', e);
  }
}

export async function sendInviteEmail(
  to: string,
  orgName: string,
  inviterName: string,
  acceptUrl: string,
  role: string
) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h1 style="font-size:24px;font-weight:600;color:#fff;margin:0 0 8px;">You're invited to join ${orgName}</h1>
        <p style="color:#8892a4;margin:0 0 24px;line-height:1.5;">${inviterName} has invited you to join their team on Vani AI as <strong style="color:#e2e8f0;">${role}</strong>.</p>
      `,
      ctaLabel: 'Accept invite',
      ctaUrl: acceptUrl,
      footer: 'This link expires in 7 days. If you didn\'t expect this invite, you can ignore this email.',
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `You're invited to join ${orgName} on Vani AI`,
      html,
    });
  } catch (e) {
    console.error('Failed to send invite email:', e);
  }
}

export async function sendOpportunityStageChange(
  to: string,
  orgName: string,
  opportunityName: string,
  oldStage: string,
  newStage: string
) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 12px;">Opportunity stage updated</h2>
        <p style="color:#8892a4;margin:0;line-height:1.5;"><strong style="color:#e2e8f0;">${opportunityName}</strong> moved from <strong>${oldStage}</strong> to <strong>${newStage}</strong>.</p>
      `,
      ctaLabel: 'View pipeline',
      ctaUrl: `${APP_URL}/home/pipeline`,
      footer: `Notification for ${orgName}.`,
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: Opportunity "${opportunityName}" moved to ${newStage}`,
      html,
    });
  } catch (e) {
    console.error('Failed to send opportunity stage email:', e);
  }
}

export async function sendSignalScoreUpdate(
  to: string,
  orgName: string,
  company: string,
  newScore: number
) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 12px;">Signal score updated</h2>
        <p style="color:#8892a4;margin:0;line-height:1.5;">Score for <strong style="color:#e2e8f0;">${company}</strong> is now <strong>${newScore}/5</strong>.</p>
      `,
      ctaLabel: 'View signals',
      ctaUrl: `${APP_URL}/home/signals`,
      footer: `Notification for ${orgName}.`,
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: Signal score updated — ${company}`,
      html,
    });
  } catch (e) {
    console.error('Failed to send signal score email:', e);
  }
}

export async function sendWeeklyDigest(
  to: string,
  orgName: string,
  payload: { signalsCount: number; opportunitiesUpdated: number }
) {
  try {
    const { signalsCount, opportunitiesUpdated } = payload;
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 16px;">Your weekly summary</h2>
        <p style="color:#8892a4;margin:0 0 8px;"><strong style="color:#e2e8f0;">${signalsCount}</strong> new signals detected this week.</p>
        <p style="color:#8892a4;margin:0;"><strong style="color:#e2e8f0;">${opportunitiesUpdated}</strong> opportunity updates.</p>
      `,
      ctaLabel: 'Open Vani',
      ctaUrl: `${APP_URL}/home`,
      footer: `Weekly digest for ${orgName}.`,
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: Weekly digest — ${orgName}`,
      html,
    });
  } catch (e) {
    console.error('Failed to send weekly digest:', e);
  }
}

export async function sendTrialEndingReminder(to: string, orgName: string, daysLeft: number) {
  try {
    const html = vaniEmailLayout({
      body: `
        <h2 style="font-size:20px;font-weight:600;color:#fff;margin:0 0 12px;">Your trial ends in ${daysLeft} days</h2>
        <p style="color:#8892a4;margin:0;line-height:1.5;">Upgrade to keep access to all Vani AI agents and your data.</p>
      `,
      ctaLabel: 'View plans',
      ctaUrl: `${APP_URL}/settings/billing`,
      footer: `Reminder for ${orgName}.`,
    });
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani AI: Trial ending in ${daysLeft} days — ${orgName}`,
      html,
    });
  } catch (e) {
    console.error('Failed to send trial reminder:', e);
  }
}
