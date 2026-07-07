import { Image } from 'lucide-react';

interface Props {
  label: string;
  className?: string;
}

// Generic placeholder with icon for missing images
export default function Placeholder({ label, className = '' }: Props) {
  return (
    <div className={`bg-surface-alt rounded-xl flex items-center justify-center text-muted ${className}`}>
      <div className="text-center px-4">
        {/* dimmed icon keeps placeholder visually quiet */}
        <Image size={28} className="mx-auto mb-2 opacity-40" />
        <span className="text-xs">{label}</span>
      </div>
    </div>
  );
}
