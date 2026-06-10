import * as React from 'react';

import { cn } from './cn';

export interface GalleryImage {
  src: string;
  alt?: string;
}

export interface ImageGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  images: GalleryImage[];
  /** Controlled active index. Falls back to internal state when omitted. */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** Thumbnail rail placement. `start`/`end` are RTL-aware. */
  thumbsPosition?: 'bottom' | 'start' | 'end';
  /** Aspect ratio class for the main image (e.g. 'aspect-square'). */
  aspect?: string;
}

/**
 * Product image gallery: large main image + thumbnail rail. Controlled or
 * uncontrolled. Thumbnail rail can sit at the bottom or the inline start/end
 * (which mirror under RTL). Dependency-light — plain <img>.
 */
export function ImageGallery({
  images,
  activeIndex,
  onActiveIndexChange,
  thumbsPosition = 'bottom',
  aspect = 'aspect-square',
  className,
  ...props
}: ImageGalleryProps) {
  const [internal, setInternal] = React.useState(0);
  const active = activeIndex ?? internal;
  const setActive = (i: number) => {
    onActiveIndexChange?.(i);
    if (activeIndex === undefined) setInternal(i);
  };

  const current = images[active] ?? images[0];
  const sideRail = thumbsPosition === 'start' || thumbsPosition === 'end';

  const thumbs = (
    <div
      role="tablist"
      aria-label="Product images"
      className={cn(
        'flex gap-2',
        sideRail ? 'flex-col' : 'flex-row flex-wrap',
        thumbsPosition === 'start' && 'order-first',
      )}
    >
      {images.map((img, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={img.alt ?? `Image ${i + 1}`}
          onClick={() => setActive(i)}
          className={cn(
            'h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-neutral-50 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            i === active ? 'border-primary' : 'border-border hover:border-neutral-300',
          )}
        >
          <img src={img.src} alt="" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={cn('flex gap-3', sideRail ? 'flex-row' : 'flex-col', className)}
      {...props}
    >
      <div
        className={cn(
          'flex-1 overflow-hidden rounded-lg border border-border bg-neutral-50',
          aspect,
        )}
      >
        {current && (
          <img
            src={current.src}
            alt={current.alt ?? ''}
            className="h-full w-full object-contain"
          />
        )}
      </div>
      {images.length > 1 && thumbs}
    </div>
  );
}
