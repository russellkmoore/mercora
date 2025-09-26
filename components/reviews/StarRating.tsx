'use client';

import { cn } from '@/lib/utils';

const sizeStyles: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-base',
  lg: 'text-2xl',
};

interface StarRatingProps {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

export function StarRating({ value, size = 'sm', className, ariaLabel }: StarRatingProps) {
  const safeValue = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
  const width = `${(safeValue / 5) * 100}%`;

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Rated ${safeValue.toFixed(1)} out of 5 stars`}
      className={cn('relative inline-flex select-none text-neutral-600', sizeStyles[size], className)}
    >
      <span aria-hidden="true">★★★★★</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden text-yellow-400"
        style={{ width }}
      >
        ★★★★★
      </span>
    </span>
  );
}
