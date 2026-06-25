import { ChevronUp, ChevronDown } from 'lucide-react';

interface SortOption {
  key: string;
  label: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder,
  sortOptions,
  sortKey,
  sortAsc,
  onSortChange,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  sortOptions?: SortOption[];
  sortKey?: string;
  sortAsc?: boolean;
  onSortChange?: (key: string, asc: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="flex-1 px-3 py-2 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]"
      />
      {sortOptions && onSortChange && (
        <>
          <select
            value={sortKey || ''}
            onChange={(e) => onSortChange(e.target.value, sortAsc ?? true)}
            className="px-2 py-2 text-xs bg-[#1a1a1a] border border-[#333] rounded-lg text-[#ccc] focus:outline-none focus:border-[#4a9eff] cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onSortChange(sortKey || sortOptions[0]?.key || '', !sortAsc)} // toggle sort direction, default to first option
            className="p-2 text-[#888] hover:text-[#ccc] bg-[#1a1a1a] border border-[#333] rounded-lg"
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </>
      )}
    </div>
  );
}
