'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollHintProps {
  children: React.ReactNode;
  /** Classes applied to the inner scrollable div (e.g. divide-y, border classes) */
  className?: string;
  /** Tailwind from-* gradient class. Defaults to 'from-card' */
  gradientFrom?: string;
  /** Max height for the scrollable area (e.g. '480px') */
  maxHeight?: string;
}

/**
 * Wraps content in a scrollable container and shows a bottom gradient + bounce arrow
 * when there is more content below. Disappears once the user scrolls to the bottom.
 */
export function ScrollHint({
  children,
  className,
  gradientFrom = 'from-card',
  maxHeight,
}: ScrollHintProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 16;
    setShowHint(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [check]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className={cn('overflow-y-auto sc-panel-scroll', className)}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
      {showHint && (
        <div
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 right-0 h-14',
            'flex items-end justify-center pb-2',
            'bg-gradient-to-t to-transparent',
            gradientFrom,
          )}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground/50 animate-bounce" />
        </div>
      )}
    </div>
  );
}
