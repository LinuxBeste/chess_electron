/**
 * MoveHistory — renders a grid of numbered moves (#, White, Black).
 *
 * Moves come in as a flat string array (e.g. ["e2-e4", "e7-e5", ...]).
 * Pairs are grouped into rows; the most recent move in each column
 * gets the `history-latest` highlight class for quick visual scanning.
 */

import { useEffect, useRef } from 'react';
import { t } from '../translate';

interface MoveHistoryProps {
  moves: string[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll the container to show the latest move */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  if (moves.length === 0) {
    return (
      <div className="moves-panel">
        <h3 className="sidebar-title">{t('moveHistory.title')}</h3>
        <div className="sidebar-panel" style={{ minHeight: 150, maxHeight: 'calc(50vh - 100px)' }}>
          <div className="empty-state">{t('moveHistory.noMoves')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="moves-panel">
        <h3 className="sidebar-title">{t('moveHistory.title')}</h3>
      <div ref={scrollRef} className="sidebar-panel" style={{ minHeight: 150, maxHeight: 'calc(50vh - 100px)' }}>
      <div className="history-grid">
        <div className="history-header">{t('moveHistory.hash')}</div>
        <div className="history-header">{t('moveHistory.white')}</div>
        <div className="history-header">{t('moveHistory.black')}</div>
        {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
          const wIdx = i * 2;
          const bIdx = i * 2 + 1;
          const isLastWhite = wIdx >= moves.length - 1;
          const isLastBlack = bIdx >= moves.length - 1;
          return (
            <>
              <div className="history-num">{i + 1}.</div>
              <div className={`history-move ${isLastWhite ? 'history-latest' : ''}`}>{moves[wIdx]}</div>
              {bIdx < moves.length ? (
                <div className={`history-move ${isLastBlack ? 'history-latest' : ''}`}>{moves[bIdx]}</div>
              ) : (
                <div />
              )}
            </>
          );
        })}
      </div>
      </div>
    </div>
  );
}
