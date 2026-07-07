import { useEffect, useRef } from 'react';

type Variant = 'fade-up' | 'fade-left' | 'fade-right' | 'scale-up' | 'zoom-in';

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  once?: boolean;
}

// Wrapper that animates children into view on scroll
const variantStyles: Record<Variant, string> = {
  'fade-up': 'opacity-0 translate-y-8',
  'fade-left': 'opacity-0 -translate-x-16',
  'fade-right': 'opacity-0 translate-x-16',
  'scale-up': 'opacity-0 scale-95',
  'zoom-in': 'opacity-0 scale-75',
};

export default function ScrollReveal({ children, variant = 'fade-up', delay = 0, className = '', once = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // spring-like cubic-bezier for smooth entrance
          el.style.transition = `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`;
          el.classList.remove(
            'opacity-0',
            'translate-y-8',
            'translate-x-16',
            '-translate-x-16',
            'scale-95',
            'scale-75',
          );
          // fire once unless component opts into repeat reveals
          if (once) observer.unobserve(el);
        }
      },
      // trigger when 15% of element is visible
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, once]);

  return (
    // transition:none prevents flash before observer kicks in
    <div ref={ref} className={`${variantStyles[variant]} ${className}`} style={{ transition: 'none' }}>
      {children}
    </div>
  );
}
