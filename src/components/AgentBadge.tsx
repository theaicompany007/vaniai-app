'use client';

interface AgentBadgeProps {
  agent: 'Vigil' | 'Vivek' | 'Varta' | 'Vidya' | 'Vaahan';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const AGENT_CONFIG = {
  Vigil:  { emoji: '🔭', color: '#00d9ff', description: 'Signal Intelligence' },
  Vivek:  { emoji: '🔬', color: '#8b5cf6', description: 'Deep Research' },
  Varta:  { emoji: '📝', color: '#f97316', description: 'Document Generator' },
  Vidya:  { emoji: '🧠', color: '#10b981', description: 'Knowledge Chat' },
  Vaahan: { emoji: '🚀', color: '#ec4899', description: 'Pipeline Strategist' },
};

export function AgentBadge({ agent, size = 'md', showLabel = true }: AgentBadgeProps) {
  const config = AGENT_CONFIG[agent];
  const isSmall = size === 'sm';

  return (
    <span
      style={{ borderColor: config.color + '40', backgroundColor: config.color + '15', color: config.color }}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        isSmall ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
      title={config.description}
    >
      <span>{config.emoji}</span>
      {showLabel && <span>{agent}</span>}
    </span>
  );
}
