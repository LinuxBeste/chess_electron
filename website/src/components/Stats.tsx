import { useEffect, useState, useRef } from 'react';
import { Swords, Users, Download } from 'lucide-react';

interface StatBoxProps {
  icon: React.ElementType;
  end: number;
  suffix: string;
  label: string;
}

function StatBox({ icon: Icon, end, suffix, label }: StatBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = end / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
              setCount(end);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10 text-accent mx-auto mb-3">
        <Icon size={22} />
      </div>
      <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-text">
        {count}{suffix}
      </div>
      <div className="text-muted text-sm mt-1">{label}</div>
    </div>
  );
}

export default function Stats() {
  return (
    <section className="py-20 md:py-24 px-6 border-y border-border">
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10">
        <StatBox icon={Swords} end={1245} suffix="+" label="Games played" />
        <StatBox icon={Users} end={480} suffix="+" label="Active players" />
        <StatBox icon={Download} end={320} suffix="+" label="Downloads" />
      </div>
    </section>
  );
}
