import type { PieceType } from '../../types';
import { getPieceSvg } from '../chess';

interface PromotionDialogProps {
  color: 'white' | 'black';
  onSelect: (piece: PieceType) => void;
}

const pieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

export default function PromotionDialog({ color, onSelect }: PromotionDialogProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-card" style={{ padding: 24 }}>
        <div className="promo-title">Choose promotion piece</div>
        <div className="promo-row">
          {pieces.map((pt) => (
            <div key={pt} className="promo-piece" onClick={() => onSelect(pt)}>
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
