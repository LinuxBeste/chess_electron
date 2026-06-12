import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  const delta = 2;
  const start = Math.max(1, page - delta);
  const end = Math.min(totalPages, page + delta);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center px-2 py-1 text-xs bg-[#222] text-[#888] rounded hover:bg-[#333] disabled:opacity-30"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={'dots' + i} className="px-1 text-xs text-[#555]">
            &hellip;
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-2.5 py-1 text-xs rounded ${
              p === page ? 'bg-[#4a9eff] text-white' : 'bg-[#222] text-[#888] hover:bg-[#333]'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center px-2 py-1 text-xs bg-[#222] text-[#888] rounded hover:bg-[#333] disabled:opacity-30"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
