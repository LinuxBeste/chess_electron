/**
 * MoveHistory — renders a grid of numbered moves (#, White, Black).
 *
 * Moves come in as a flat string array (e.g. ["e2-e4", "e7-e5", ...]).
 * Pairs are grouped into rows; the most recent move in each column
 * gets the `history-latest` highlight class for quick visual scanning.
 */

import { useEffect, useRef, Fragment, memo } from 'react';
import { t } from '../translate';
import logger from '../logger';

interface MoveHistoryProps {
  moves: string[];
}

const MoveHistory = memo(function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to the latest move as the game progresses */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]); // length tells us new moves arrived

  // Log move count changes for debugging
  useEffect(() => {
    const totalPairs = Math.ceil(moves.length / 2);
    if (moves.length === 0) {
      logger.debug('Move history rendered (empty)');
    } else {
      logger.debug('Move history updated', {
        totalMoves: moves.length,
        totalPairs,
        lastMove: moves[moves.length - 1],
      });
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
          {/* Group flat move array into (number, white, black) rows */}
          {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
            const wIdx = i * 2;
            const bIdx = i * 2 + 1;
            const isLastWhite = wIdx >= moves.length - 1;
            const isLastBlack = bIdx >= moves.length - 1;
            return (
              <Fragment key={i}>
                <div className="history-num">{i + 1}.</div>
                <div className={`history-move ${isLastWhite ? 'history-latest' : ''}`}>{moves[wIdx]}</div>
                {bIdx < moves.length ? (
                  <div className={`history-move ${isLastBlack ? 'history-latest' : ''}`}>{moves[bIdx]}</div>
                ) : (
                  <div />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default MoveHistory;
