/**
 * PromotionDialog — modal overlay asking the player to choose a
 * promotion piece when a pawn reaches the last rank.
 *
 * Excludes pawn and king from the choices (FIDE rules).
 * The order (queen first) reflects the most common choice.
 */

import { useEffect } from 'react';
import type { PieceType } from '../../types';
import { getPieceSvg } from '../chess';
import { t } from '../translate';
import logger from '../logger';

interface PromotionDialogProps {
  color: 'white' | 'black';
  onSelect: (piece: PieceType) => void;
}

// Pawn→queen is most common (~98%); order matches frequency (FIDE rules: no pawn/king)
const pieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

export default function PromotionDialog({ color, onSelect }: PromotionDialogProps) {
  useEffect(() => {
    logger.info('Promotion dialog shown', { color, options: pieces });
  }, [color]);

  function handleSelect(piece: PieceType) {
    logger.info('Promotion piece selected', { color, piece });
    onSelect(piece);
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('promotion.title')}
      onClick={(e) => e.stopPropagation()}
    >
      {' '}
      {/* block clicks from reaching board */}
      <div className="modal-card" style={{ padding: 24 }}>
        <div className="promo-title" id="promo-title">
          {t('promotion.title')}
        </div>
        <div className="promo-row">
          {pieces.map((pt) => (
            <div key={pt} className="promo-piece" onClick={() => handleSelect(pt)}>
              <span
                className="piece-char"
                style={{
                  fontSize: 36,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                  color: color === 'white' ? '#ffffff' : '#1a1a1a',
                }}
                dangerouslySetInnerHTML={{ __html: getPieceSvg(pt, color) }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
