import { useEffect, useRef } from 'react';

interface MoveHistoryProps {
  moves: string[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length]);

  if (moves.length === 0) {
    return (
      <div className="sidebar-panel" style={{ minHeight: 150, maxHeight: 'calc(50vh - 100px)' }}>
        <div className="empty-state">No moves yet</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="sidebar-panel" style={{ minHeight: 150, maxHeight: 'calc(50vh - 100px)' }}>
      <div className="history-grid">
        <div className="history-header">#</div>
        <div className="history-header">White</div>
        <div className="history-header">Black</div>
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
  );
}
