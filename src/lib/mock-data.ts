// ===== Mock data for WhiteOwl clone =====

export interface Signal {
  id: string;
  company: string;
  companyInitials: string;
  companyColor: string;
  score: number;
  tag: string;
  tagColor: 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
  source: string;
  postedAgo: string;
  publishedDate: string;
  segmentMatch: 'High' | 'Medium' | 'Low';
  title: string;
  summary: string;
  services: string[];
  aiRelevance: string;
  url: string;
  isBookmarked?: boolean;
}

export interface Account {
  id: string;
  name: string;
  contacts: number;
  industry: string;
  opportunityCount: number;
  signalCount: number;
  location: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  jobTitle: string;
  company: string;
  industry: string;
  location: string;
  opportunities: number;
}

export interface Opportunity {
  id: string;
  name: string;
  account: string;
  people: number;
  owner: string;
  stage: string;
  industry: string;
}

export interface ResearchTemplate {
  id: string;
  title: string;
  description: string;
  gradient: string;
}

// ===== SIGNALS =====
export const mockSignals: Signal[] = [
  {
    id: '1',
    company: 'JSW MG Motor India',
    companyInitials: 'JI',
    companyColor: '#ef4444',
    score: 4,
    tag: 'Expansion',
    tagColor: 'green',
    source: 'Thehindubusinessline',
    postedAgo: '1 week ago',
    publishedDate: 'Today',
    segmentMatch: 'High',
    title: 'JSW MG plans $441 million expansion to triple India\'s capacity - The HinduBusinessLine',
    summary: 'JSW MG Motor India has announced a $441 million investment to triple its manufacturing capacity in India, signaling major expansion in the EV and auto sector with immediate procurement needs.',
    services: ['GenAI Agentic Platform deployment', 'Multi-step workflow automation', 'Enterprise AI governance solutions'],
    aiRelevance: 'Strong alignment with AI-driven manufacturing optimization and supply chain automation services.',
    url: '#',
  },
  {
    id: '2',
    company: 'Godrej Enterprises Group',
    companyInitials: 'GE',
    companyColor: '#8b5cf6',
    score: 4.5,
    tag: 'Leadership Change',
    tagColor: 'blue',
    source: 'ETEnterpriseai',
    postedAgo: '19 days ago',
    publishedDate: 'Feb 9, 2026',
    segmentMatch: 'High',
    title: 'Godrej Enterprises Group: Pioneering the Intelligence-First Digital Transformation',
    summary: 'New CDIO appointment in February 2026 with explicit mandate to build intelligence-first enterprise using unified AI backbone - perfect alignment with our GenAI platform and governance solutions.',
    services: ['GenAI Agentic Platform deployment', 'AI agent fleet management', 'Multi-step workflow automation', 'Enterprise AI governance solutions'],
    aiRelevance: 'Perfect timing - new technology leadership actively seeking AI transformation partners.',
    url: '#',
  },
  {
    id: '3',
    company: 'Mondelez India',
    companyInitials: 'MI',
    companyColor: '#3b82f6',
    score: 4.5,
    tag: 'Tech Migration',
    tagColor: 'purple',
    source: 'Agro & Food Processing',
    postedAgo: '23 days ago',
    publishedDate: 'Feb 5, 2026',
    segmentMatch: 'High',
    title: 'Mondelez India Accelerates AI-Led Digital Supply Chain to Drive 2026 Growth',
    summary: 'Active 2026 AI-led supply chain transformation with explicit needs for agile systems, data infrastructure, and IoT integration signals immediate procurement readiness for AI platforms.',
    services: ['GenAI Agentic Platform deployment', 'AI agent fleet management', 'Multi-step workflow automation', 'Enterprise AI governance solutions', 'Specialized AI agent development'],
    aiRelevance: 'Active digital transformation with explicit AI supply chain needs.',
    url: '#',
  },
  {
    id: '4',
    company: 'Kraft Heinz',
    companyInitials: 'KH',
    companyColor: '#f59e0b',
    score: 4.5,
    tag: 'Challenges',
    tagColor: 'orange',
    source: 'InfotechLead',
    postedAgo: '13 days ago',
    publishedDate: 'Feb 15, 2026',
    segmentMatch: 'High',
    title: 'Kraft Heinz Accelerates AI and Digital Transformation With $600 mn Tech Investment Strategy',
    summary: 'Explicit $600M AI and digital transformation investment with focus on automation, analytics, and operational efficiency represents immediate high-intent buying signal from FMCG enterprise.',
    services: ['GenAI Agentic Platform deployment', 'AI agent fleet management', 'Multi-step workflow automation', 'Enterprise AI governance solutions'],
    aiRelevance: '$600M committed budget for AI/digital transformation — highest intent signal.',
    url: '#',
  },
  {
    id: '5',
    company: 'Tata Steel',
    companyInitials: 'TS',
    companyColor: '#0ea5e9',
    score: 3.5,
    tag: 'Expansion',
    tagColor: 'green',
    source: 'BusinessToday',
    postedAgo: '5 days ago',
    publishedDate: 'Feb 23, 2026',
    segmentMatch: 'Medium',
    title: 'Tata Steel Invests in Smart Factory Initiative Across Indian Plants',
    summary: 'Tata Steel rolling out smart factory initiatives with IoT, predictive maintenance, and AI-powered quality control across multiple Indian manufacturing plants.',
    services: ['GenAI Agentic Platform deployment', 'Specialized AI agent development', 'Enterprise AI governance solutions'],
    aiRelevance: 'Smart factory initiative aligns well with AI agent deployment for manufacturing.',
    url: '#',
  },
];

// ===== ACCOUNTS =====
export const mockAccounts: Account[] = [
  { id: '1', name: 'Godrej Enterprises Group', contacts: 3, industry: 'Conglomerate', opportunityCount: 1, signalCount: 2, location: 'Mumbai, India' },
  { id: '2', name: 'Mondelez India', contacts: 2, industry: 'FMCG', opportunityCount: 1, signalCount: 1, location: 'Mumbai, India' },
  { id: '3', name: 'Kraft Heinz', contacts: 1, industry: 'FMCG', opportunityCount: 0, signalCount: 1, location: 'Chicago, USA' },
  { id: '4', name: 'JSW MG Motor India', contacts: 2, industry: 'Automotive', opportunityCount: 1, signalCount: 1, location: 'New Delhi, India' },
  { id: '5', name: 'Tata Steel', contacts: 4, industry: 'Manufacturing', opportunityCount: 2, signalCount: 3, location: 'Mumbai, India' },
];

// ===== CONTACTS =====
export const mockContacts: Contact[] = [
  { id: '1', name: 'Rajesh Kumar', avatar: 'RK', jobTitle: 'Chief Digital Officer', company: 'Godrej Enterprises', industry: 'Conglomerate', location: 'Mumbai', opportunities: 1 },
  { id: '2', name: 'Priya Sharma', avatar: 'PS', jobTitle: 'VP Engineering', company: 'Mondelez India', industry: 'FMCG', location: 'Mumbai', opportunities: 1 },
  { id: '3', name: 'Amit Patel', avatar: 'AP', jobTitle: 'CTO', company: 'JSW MG Motor', industry: 'Automotive', location: 'New Delhi', opportunities: 1 },
  { id: '4', name: 'Sarah Chen', avatar: 'SC', jobTitle: 'Head of AI', company: 'Kraft Heinz', industry: 'FMCG', location: 'Chicago', opportunities: 0 },
  { id: '5', name: 'Vikram Singh', avatar: 'VS', jobTitle: 'Digital Transformation Lead', company: 'Tata Steel', industry: 'Manufacturing', location: 'Mumbai', opportunities: 2 },
];

// ===== OPPORTUNITIES =====
export const mockOpportunities: Opportunity[] = [
  { id: '1', name: 'Godrej AI Platform Deployment', account: 'Godrej Enterprises', people: 3, owner: 'You', stage: 'Proposal', industry: 'Conglomerate' },
  { id: '2', name: 'Mondelez Supply Chain AI', account: 'Mondelez India', people: 2, owner: 'You', stage: 'Discovery', industry: 'FMCG' },
  { id: '3', name: 'JSW Smart Manufacturing', account: 'JSW MG Motor', people: 2, owner: 'You', stage: 'Qualification', industry: 'Automotive' },
  { id: '4', name: 'Tata Steel Predictive Maintenance', account: 'Tata Steel', people: 4, owner: 'You', stage: 'Negotiation', industry: 'Manufacturing' },
];

// ===== RESEARCH TEMPLATES =====
export const mockTemplates: ResearchTemplate[] = [
  { id: '1', title: 'Company Deep Dive', description: 'Comprehensive analysis of a company\'s AI readiness and digital transformation status', gradient: 'from-blue-500 to-cyan-400' },
  { id: '2', title: 'Industry Trends', description: 'Identify emerging trends and opportunities in a specific industry vertical', gradient: 'from-violet-500 to-purple-400' },
  { id: '3', title: 'Competitive Analysis', description: 'Compare target company against competitors in AI adoption and tech investment', gradient: 'from-orange-500 to-amber-400' },
  { id: '4', title: 'Stakeholder Mapping', description: 'Identify and profile key decision makers and influencers at a target account', gradient: 'from-emerald-500 to-teal-400' },
  { id: '5', title: 'Signal Summary', description: 'Generate a concise executive summary from collected signals and research data', gradient: 'from-pink-500 to-rose-400' },
  { id: '6', title: 'Pitch Generator', description: 'Create a tailored pitch based on company signals, needs, and your service offerings', gradient: 'from-indigo-500 to-blue-400' },
];
