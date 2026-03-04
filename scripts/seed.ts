/**
 * Seed Script — Creates demo org + sample data for local development
 * Run: npx ts-node --project tsconfig.seed.json scripts/seed.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = 'demo@kcube-consulting.com';
const DEMO_ORG_NAME = 'Kcube Consulting Demo';

async function seed() {
  console.log('🌱 Starting seed...\n');

  // 1. Create or find demo user
  console.log('Creating demo user...');
  const { data: existingUser } = await admin.auth.admin.listUsers();
  let userId = existingUser?.users.find((u) => u.email === DEMO_EMAIL)?.id;

  if (!userId) {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: 'DemoPassword123!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create user: ${error.message}`);
    userId = newUser.user.id;
    console.log(`✅ Created user: ${DEMO_EMAIL} (id: ${userId})`);
  } else {
    console.log(`ℹ️  User already exists: ${DEMO_EMAIL} (id: ${userId})`);
  }

  // 2. Create or find demo org
  console.log('\nCreating demo organization...');
  const { data: existingOrg } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', 'kcube-consulting-demo')
    .single();

  let orgId = existingOrg?.id;

  if (!orgId) {
    const { data: org, error } = await admin
      .from('organizations')
      .insert({
        name: DEMO_ORG_NAME,
        slug: 'kcube-consulting-demo',
        owner_user_id: userId,
        subscription_tier: 'pro',
        subscription_status: 'active',
        trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create org: ${error.message}`);
    orgId = org!.id;
    console.log(`✅ Created org: "${DEMO_ORG_NAME}" (id: ${orgId})`);
  } else {
    console.log(`ℹ️  Org already exists (id: ${orgId})`);
  }

  // 3. Create org membership
  await admin.from('org_memberships').upsert(
    { org_id: orgId, user_id: userId, role: 'admin' },
    { onConflict: 'org_id,user_id' }
  );
  console.log('✅ Org membership created (admin)');

  // 4. Seed signals
  console.log('\nSeeding signals...');
  const signals = [
    {
      org_id: orgId,
      company: 'Tata Consultancy Services',
      company_initials: 'TC',
      company_color: '#0051a2',
      score: 4.5,
      tag: 'Tech Adoption',
      tag_color: 'cyan',
      source: 'Economic Times',
      posted_ago: '2 hours ago',
      title: 'TCS announces ₹10,000 Cr GenAI investment for enterprise clients',
      summary: 'TCS has announced a major GenAI capability buildout targeting Fortune 500 clients. The initiative includes new AI labs across India and a partner ecosystem for LLM deployment.',
      services: ['AI/GenAI', 'Cloud', 'Data Analytics'],
      ai_relevance: 'Strong opportunity for our AI/GenAI platform — TCS ecosystem partners could benefit from our rapid deployment framework.',
      url: 'https://economictimes.indiatimes.com',
      is_bookmarked: false,
      generated_by: 'Vigil',
    },
    {
      org_id: orgId,
      company: 'Mahindra & Mahindra',
      company_initials: 'MM',
      company_color: '#e53e3e',
      score: 4.0,
      tag: 'Expansion',
      tag_color: 'blue',
      source: 'Business Standard',
      posted_ago: '5 hours ago',
      title: 'Mahindra Electric expands EV manufacturing with $2B smart factory investment',
      summary: 'Mahindra Group is building 3 new smart factories for EV production with IoT, predictive maintenance, and digital twin capabilities as core requirements.',
      services: ['Digital Transformation', 'Cloud', 'ERP'],
      ai_relevance: 'Smart factory initiative aligns with our Industry 4.0 and SAP ERP capabilities — direct entry point.',
      url: 'https://business-standard.com',
      is_bookmarked: true,
      generated_by: 'Vigil',
    },
    {
      org_id: orgId,
      company: 'HDFC Bank',
      company_initials: 'HB',
      company_color: '#004c8f',
      score: 3.8,
      tag: 'Leadership',
      tag_color: 'purple',
      source: 'Moneycontrol',
      posted_ago: 'Yesterday',
      title: 'HDFC Bank appoints new Chief Digital Officer from Google Cloud',
      summary: 'HDFC Bank has hired a new CDO from Google Cloud with a mandate to accelerate digital transformation across all banking verticals including core banking modernization.',
      services: ['Cloud', 'Data Analytics', 'Digital Transformation'],
      ai_relevance: 'New CDO from cloud background = immediate appetite for cloud-native banking solutions. Perfect timing for outreach.',
      url: 'https://moneycontrol.com',
      is_bookmarked: false,
      generated_by: 'Vigil',
    },
    {
      org_id: orgId,
      company: 'Reliance Retail',
      company_initials: 'RR',
      company_color: '#1a73e8',
      score: 4.2,
      tag: 'Funding',
      tag_color: 'green',
      source: 'Mint',
      posted_ago: '3 days ago',
      title: 'Reliance Retail raises $1.5B for omnichannel tech platform overhaul',
      summary: 'Reliance Retail is deploying $1.5B to build a unified commerce platform integrating 18,000 stores with e-commerce, loyalty, and AI-driven personalization.',
      services: ['AI/GenAI', 'ERP', 'Data Analytics'],
      ai_relevance: 'Massive commerce platform build — our SAP/ERP integration expertise and GenAI personalization capabilities are directly applicable.',
      url: 'https://livemint.com',
      is_bookmarked: true,
      generated_by: 'Vigil',
    },
    {
      org_id: orgId,
      company: 'Wipro Technologies',
      company_initials: 'WT',
      company_color: '#7b61ff',
      score: 3.5,
      tag: 'M&A',
      tag_color: 'orange',
      source: 'CNBC TV18',
      posted_ago: '1 week ago',
      title: 'Wipro acquires AI startup Apexon to strengthen GenAI practice',
      summary: 'Wipro completed acquisition of Apexon (AI services firm) to bolster its GenAI consulting practice. Integration of 2,000+ AI specialists begins Q1 2025.',
      services: ['AI/GenAI', 'Digital Transformation'],
      ai_relevance: 'Post-acquisition integration creates opportunity — Wipro will need specialized AI tooling and platform licenses for the combined entity.',
      url: 'https://cnbctv18.com',
      is_bookmarked: false,
      generated_by: 'Vigil',
    },
  ];

  const { error: sigErr } = await admin.from('signals').insert(signals);
  if (sigErr) console.warn('⚠️ Signals seed warning:', sigErr.message);
  else console.log(`✅ Seeded ${signals.length} signals`);

  // 5. Seed accounts
  console.log('\nSeeding accounts...');
  const accounts = [
    { org_id: orgId, name: 'Tata Consultancy Services', industry: 'IT Services', location: 'Mumbai, India', website: 'https://tcs.com', description: 'Global IT services leader' },
    { org_id: orgId, name: 'Mahindra & Mahindra', industry: 'Manufacturing/Automotive', location: 'Pune, India', website: 'https://mahindra.com', description: 'Diversified industrial conglomerate' },
    { org_id: orgId, name: 'HDFC Bank', industry: 'Banking & Financial Services', location: 'Mumbai, India', website: 'https://hdfcbank.com', description: 'India\'s largest private sector bank' },
    { org_id: orgId, name: 'Reliance Retail', industry: 'Retail', location: 'Mumbai, India', website: 'https://relianceretail.com', description: 'India\'s largest retailer' },
    { org_id: orgId, name: 'Infosys', industry: 'IT Services', location: 'Bengaluru, India', website: 'https://infosys.com', description: 'Global consulting and technology services' },
  ];

  const { data: accountsData, error: accErr } = await admin
    .from('accounts')
    .insert(accounts)
    .select('id, name');
  if (accErr) console.warn('⚠️ Accounts seed warning:', accErr.message);
  else console.log(`✅ Seeded ${accounts.length} accounts`);

  // 6. Seed contacts
  console.log('\nSeeding contacts...');
  const contacts = [
    { org_id: orgId, name: 'Rajesh Kumar', avatar: 'RK', job_title: 'Chief Digital Officer', company: 'HDFC Bank', industry: 'Banking', location: 'Mumbai', email: 'r.kumar@hdfcbank.com' },
    { org_id: orgId, name: 'Priya Sharma', avatar: 'PS', job_title: 'VP Technology', company: 'Reliance Retail', industry: 'Retail', location: 'Mumbai', email: 'p.sharma@reliance.com' },
    { org_id: orgId, name: 'Arjun Mehta', avatar: 'AM', job_title: 'CTO', company: 'Mahindra Electric', industry: 'Manufacturing', location: 'Pune', email: 'a.mehta@mahindra.com' },
    { org_id: orgId, name: 'Divya Nair', avatar: 'DN', job_title: 'Head of AI Platforms', company: 'Tata Consultancy Services', industry: 'IT Services', location: 'Chennai', email: 'd.nair@tcs.com' },
    { org_id: orgId, name: 'Vikram Singh', avatar: 'VS', job_title: 'Chief Procurement Officer', company: 'Infosys', industry: 'IT Services', location: 'Bengaluru', email: 'v.singh@infosys.com' },
  ];

  const { error: conErr } = await admin.from('contacts').insert(contacts);
  if (conErr) console.warn('⚠️ Contacts seed warning:', conErr.message);
  else console.log(`✅ Seeded ${contacts.length} contacts`);

  // 7. Seed opportunities
  console.log('\nSeeding opportunities...');
  const opportunities = [
    { org_id: orgId, name: 'HDFC Bank Core Banking Modernization', account: 'HDFC Bank', owner: 'Raaj', stage: 'Proposal', industry: 'Banking', people: 3 },
    { org_id: orgId, name: 'Mahindra Smart Factory IoT Platform', account: 'Mahindra Electric', owner: 'Raaj', stage: 'Qualified', industry: 'Manufacturing', people: 5 },
    { org_id: orgId, name: 'Reliance Retail GenAI Personalization', account: 'Reliance Retail', owner: 'Raaj', stage: 'Discovery', industry: 'Retail', people: 2 },
    { org_id: orgId, name: 'TCS GenAI Partner Programme', account: 'TCS', owner: 'Raaj', stage: 'Negotiation', industry: 'IT Services', people: 4 },
    { org_id: orgId, name: 'Infosys Data Analytics Platform', account: 'Infosys', owner: 'Raaj', stage: 'Discovery', industry: 'IT Services', people: 2 },
  ];

  const { error: oppErr } = await admin.from('opportunities').insert(opportunities);
  if (oppErr) console.warn('⚠️ Opportunities seed warning:', oppErr.message);
  else console.log(`✅ Seeded ${opportunities.length} opportunities`);

  // 8. Seed a KB collection with sample content
  console.log('\nSeeding Knowledge Base collection...');
  const { data: kbCol } = await admin
    .from('kb_collections')
    .upsert({ org_id: orgId, name: 'Company Profile' }, { onConflict: 'org_id,name' })
    .select()
    .single();

  if (kbCol) {
    const kbContent = `
Kcube Consulting — Company Overview

Kcube Consulting is a boutique IT consulting firm headquartered in India, specializing in:

1. AI/GenAI Implementation: We help enterprises deploy large language models, build GenAI-powered workflows, and integrate AI into existing systems. Our flagship offering includes rapid MVP delivery in 6-8 weeks.

2. Cloud Migration & Infrastructure: End-to-end cloud migration (AWS, Azure, GCP) for mid-to-large enterprises. We specialize in lift-and-shift, re-platforming, and cloud-native transformation.

3. ERP Implementation: SAP and Oracle ERP rollouts for manufacturing, retail, and financial services sectors. 50+ successful implementations across India.

4. Digital Transformation Consulting: Digital strategy, process automation, and organizational change management for complex transformation programs.

5. Data Analytics & Business Intelligence: From data warehousing to real-time dashboards — Power BI, Tableau, custom analytics platforms.

Key Differentiators:
- Rapid delivery: 6-8 week MVP for AI projects
- Deep domain expertise in BFSI, Manufacturing, and Retail
- Proven track record: 200+ projects, 85% client retention
- Hybrid delivery model (onsite + offshore)

Recent Case Studies:
- Banking client: Deployed AI document processing, reduced manual review time by 70%
- Manufacturing client: SAP S/4HANA implementation for 5 plants, went live in 14 months
- Retail client: Built real-time inventory analytics saving ₹15Cr in overstock annually
    `.trim();

    // Insert a sample chunk without embedding (requires OpenAI key to embed)
    await admin.from('knowledge_chunks').insert({
      org_id: orgId,
      collection_id: kbCol.id,
      content: kbContent,
      source_file: 'company-profile.txt',
      metadata: { type: 'company-profile', seeded: true },
    });
    console.log('✅ Seeded KB collection "Company Profile"');
  }

  console.log('\n─────────────────────────────────────────');
  console.log('✅ Seed complete!');
  console.log(`\n📋 Demo credentials:`);
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: DemoPassword123!`);
  console.log(`   Org ID:   ${orgId}`);
  console.log('\nNote: KB chunks without embeddings won\'t show in search.');
  console.log('Run "Add to KB" from settings to properly embed content.\n');
}

seed().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
