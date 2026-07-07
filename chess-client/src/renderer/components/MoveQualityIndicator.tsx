import { t } from '../translate';

export type MoveQuality = 'excellent' | 'good' | 'inaccuracy';

// Badge showing move quality (excellent/good/inaccuracy) with color coding

const QUALITY_CONFIG: Record<MoveQuality, { label: string; color: string; bg: string; border: string }> = {
  excellent: {
    label: '!!',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.35)',
  },
  good: {
    label: '!',
    color: '#4f8ef7',
    bg: 'rgba(79,142,247,0.12)',
    border: 'rgba(79,142,247,0.35)',
  },
  inaccuracy: {
    label: '?!',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
  },
};

const QUALITY_LABELS: Record<MoveQuality, string> = {
  excellent: 'moveQuality.excellent',
  good: 'moveQuality.good',
  inaccuracy: 'moveQuality.inaccuracy',
};

interface MoveQualityIndicatorProps {
  quality: MoveQuality;
  bestMove?: string | null;
}

export default function MoveQualityIndicator({ quality, bestMove }: MoveQualityIndicatorProps) {
  const cfg = QUALITY_CONFIG[quality];

  return (
    <span
      title={t(QUALITY_LABELS[quality]) + (bestMove ? ` (${t('moveQuality.bestMove', { move: bestMove })})` : '')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 19,
        padding: '0 4px',
        borderRadius: 4,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '0.3px',
        marginLeft: 6,
        flexShrink: 0,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {cfg.label}
    </span>
  );
}
