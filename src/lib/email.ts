import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@vaniai.app';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

export async function sendWelcomeEmail(to: string, orgName: string) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Welcome to Vani — your AI sales intelligence platform',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
            <div style="width:40px;height:40px;background:#0d0d14;border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#00d9ff;font-size:20px;font-weight:bold;">V</span>
            </div>
            <span style="font-size:18px;font-weight:700;color:#fff;">Vani</span>
          </div>
          <h1 style="font-size:24px;font-weight:700;color:#fff;margin-bottom:8px;">Welcome, ${orgName}!</h1>
          <p style="color:#8892a4;margin-bottom:24px;">Your 14-day trial has started. Here's how to make the most of your Vani agents:</p>
          <div style="background:#0d0d14;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="margin:0 0 12px;"><strong style="color:#00d9ff;">⚡ Vigil</strong> <span style="color:#8892a4;">— Detects real-time buying signals from your target accounts</span></p>
            <p style="margin:0 0 12px;"><strong style="color:#a78bfa;">🔍 Vivek</strong> <span style="color:#8892a4;">— Deep research on any company or market</span></p>
            <p style="margin:0 0 12px;"><strong style="color:#34d399;">📄 Varta</strong> <span style="color:#8892a4;">— Generates pitches, proposals, and briefs in seconds</span></p>
            <p style="margin:0 0 12px;"><strong style="color:#fb923c;">💬 Vidya</strong> <span style="color:#8892a4;">— Your AI sales co-pilot for account intelligence</span></p>
            <p style="margin:0;"><strong style="color:#60a5fa;">📊 Vaahan</strong> <span style="color:#8892a4;">— Pipeline strategy and deal prioritization</span></p>
          </div>
          <a href="${APP_URL}/home" style="display:inline-block;background:#00d9ff;color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
            Open Vani →
          </a>
          <p style="color:#4a5568;font-size:12px;margin-top:32px;">You're receiving this because you signed up for Vani.</p>
        </div>
      `,
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
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Vani ${plan} plan activated`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
          <h2>Your Vani ${plan} subscription is active!</h2>
          <p>Amount: <strong>${amount}/month</strong></p>
          <p>You now have full access to all ${plan} features. <a href="${APP_URL}/home">Open Vani →</a></p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send subscription confirmation:', e);
  }
}

export async function sendSignalDigest(to: string, orgName: string, signalCount: number) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `🔔 Vani: ${signalCount} new signals detected for ${orgName}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
          <h2>Vigil found ${signalCount} new signals</h2>
          <p>Your AI signal agent has detected <strong>${signalCount} buying signals</strong> for your target accounts this week.</p>
          <a href="${APP_URL}/home/signals" style="display:inline-block;background:#00d9ff;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Signals →
          </a>
        </div>
      `,
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
    await resend.emails.send({
      from: FROM,
      to,
      subject: `You're invited to join ${orgName} on Vani`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
            <div style="width:40px;height:40px;background:#0d0d14;border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#00d9ff;font-size:20px;font-weight:bold;">V</span>
            </div>
            <span style="font-size:18px;font-weight:700;color:#fff;">Vani</span>
          </div>
          <h1 style="font-size:24px;font-weight:700;color:#fff;margin-bottom:8px;">You're invited to join ${orgName}</h1>
          <p style="color:#8892a4;margin-bottom:24px;">${inviterName} has invited you to join their team on Vani as <strong>${role}</strong>.</p>
          <a href="${acceptUrl}" style="display:inline-block;background:#00d9ff;color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
            Accept invite →
          </a>
          <p style="color:#4a5568;font-size:12px;margin-top:32px;">This link expires in 7 days. If you didn't expect this invite, you can ignore this email.</p>
        </div>
      `,
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
    await resend.emails.send({
      from: FROM,
      to,
      subject: `📊 Vani: Opportunity "${opportunityName}" moved to ${newStage}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <span style="font-size:18px;font-weight:700;color:#fff;">Vani</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px;">Opportunity stage updated</h2>
          <p style="color:#8892a4;margin-bottom:16px;"><strong style="color:#e2e8f0;">${opportunityName}</strong> moved from <strong>${oldStage}</strong> to <strong>${newStage}</strong>.</p>
          <a href="${APP_URL}/home/pipeline" style="display:inline-block;background:#00d9ff;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">View pipeline →</a>
          <p style="color:#4a5568;font-size:12px;margin-top:24px;">Notification for ${orgName}.</p>
        </div>
      `,
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
    await resend.emails.send({
      from: FROM,
      to,
      subject: `📈 Vani: Signal score updated — ${company}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <span style="font-size:18px;font-weight:700;color:#fff;">Vani</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px;">Signal score updated</h2>
          <p style="color:#8892a4;margin-bottom:16px;">Score for <strong style="color:#e2e8f0;">${company}</strong> is now <strong>${newScore}/5</strong>.</p>
          <a href="${APP_URL}/home/signals" style="display:inline-block;background:#00d9ff;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">View signals →</a>
          <p style="color:#4a5568;font-size:12px;margin-top:24px;">Notification for ${orgName}.</p>
        </div>
      `,
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
    await resend.emails.send({
      from: FROM,
      to,
      subject: `📬 Vani weekly digest — ${orgName}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#050509;color:#e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <span style="font-size:18px;font-weight:700;color:#fff;">Vani</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#fff;margin-bottom:16px;">Your weekly summary</h2>
          <p style="color:#8892a4;margin-bottom:12px;"><strong style="color:#e2e8f0;">${signalsCount}</strong> new signals detected this week.</p>
          <p style="color:#8892a4;margin-bottom:24px;"><strong style="color:#e2e8f0;">${opportunitiesUpdated}</strong> opportunity updates.</p>
          <a href="${APP_URL}/home" style="display:inline-block;background:#00d9ff;color:#000;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">Open Vani →</a>
          <p style="color:#4a5568;font-size:12px;margin-top:24px;">You're receiving this because you have weekly digest enabled for ${orgName}.</p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send weekly digest:', e);
  }
}

export async function sendTrialEndingReminder(to: string, orgName: string, daysLeft: number) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `⏰ Vani trial ending in ${daysLeft} days — ${orgName}`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
          <h2>Your trial ends in ${daysLeft} days</h2>
          <p>Upgrade now to keep access to all 5 Vani agents and your data.</p>
          <a href="${APP_URL}/settings/billing" style="display:inline-block;background:#00d9ff;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            View Plans →
          </a>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send trial reminder:', e);
  }
}
