// Shared billing constants — imported by route files and UI components.
// Do NOT put these in an API route file (Next.js only allows HTTP handler exports there).

export const PLANS = {
  starter: {
    name: 'Starter',
    amount: 299900, // ₹2,999/month in paise
    currency: 'INR',
    interval: 'monthly',
    description: 'Perfect for individual sales professionals',
    features: {
      signals: 50,
      agent_runs: 20,
      documents: 10,
      seats: 2,
    },
    highlights: [
      '50 AI signals per month',
      '20 agent runs (Vigil, Vivek, Varta)',
      '10 generated documents',
      '2 team seats',
      'Basic Knowledge Base (50MB)',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    amount: 999900, // ₹9,999/month in paise
    currency: 'INR',
    interval: 'monthly',
    description: 'For growing sales teams',
    features: {
      signals: 500,
      agent_runs: 200,
      documents: 100,
      seats: 10,
    },
    highlights: [
      '500 AI signals per month',
      '200 agent runs',
      '100 generated documents',
      '10 team seats',
      'Unlimited Knowledge Base',
      'Priority support',
      'Custom Razorpay webhook alerts',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    amount: 2999900, // ₹29,999/month in paise
    currency: 'INR',
    interval: 'monthly',
    description: 'For large organizations with advanced needs',
    features: {
      signals: -1, // unlimited
      agent_runs: -1,
      documents: -1,
      seats: -1,
    },
    highlights: [
      'Unlimited signals',
      'Unlimited agent runs',
      'Unlimited documents & seats',
      'Dedicated account manager',
      'Custom AI model fine-tuning',
      'SLA guarantee',
      'On-premise deployment option',
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
