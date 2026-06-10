import * as React from 'react';

import { cn } from './cn';

export interface RangeSliderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  min: number;
  max: number;
  step?: number;
  /** Current [low, high] pair. */
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  /** Optional renderer for the live value labels (e.g. format as KWD). */
  formatValue?: (value: number) => React.ReactNode;
  /** Hide the value labels above the track. */
  hideLabels?: boolean;
}

/**
 * Dual-thumb range slider (price filter). Built from two overlaid native
 * range inputs — no external dependency. The fill is positioned with logical
 * `inset-inline-start`/`width` so it renders correctly in RTL and LTR.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  formatValue = (v) => v,
  hideLabels = false,
  className,
  ...props
}: RangeSliderProps) {
  const [low, high] = value;
  const span = Math.max(max - min, 1);
  const lowPct = ((low - min) / span) * 100;
  const highPct = ((high - min) / span) * 100;

  const setLow = (next: number) => onValueChange([Math.min(next, high), high]);
  const setHigh = (next: number) => onValueChange([low, Math.max(next, low)]);

  const thumb =
    'pointer-events-none absolute inset-x-0 top-1/2 m-0 h-0 w-full -translate-y-1/2 appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 ' +
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
    '[&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 ' +
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface';

  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {!hideLabels && (
        <div className="flex items-center justify-between text-sm text-foreground">
          <span>{formatValue(low)}</span>
          <span>{formatValue(high)}</span>
        </div>
      )}
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{ insetInlineStart: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(e) => setLow(Number(e.target.value))}
          aria-label="Minimum"
          className={thumb}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(e) => setHigh(Number(e.target.value))}
          aria-label="Maximum"
          className={thumb}
        />
      </div>
    </div>
  );
}
