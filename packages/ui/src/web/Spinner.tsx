import * as React from 'react';

import { cn } from './cn';

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export function Spinner({ size = 'md', label, className, ...props }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label ?? 'Loading'}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-current', sizeClasses[size], className)}
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
