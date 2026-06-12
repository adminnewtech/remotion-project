'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export interface GalleryImage {
  id: string;
  url: string;
}

/**
 * Premium PDP gallery.
 *
 *  - Main stage: `aspect-square`, `object-contain` on a soft gradient so wildly
 *    varying catalog photos never crop or cause layout shift. Hovering the
 *    stage zooms toward the cursor (desktop); clicking opens a full-screen
 *    lightbox. Skeleton shimmer until each image paints.
 *  - Thumbnail strip: scroll-snap on mobile (swipeable feel), wraps on desktop.
 *    RTL-correct via logical properties.
 *
 * The active index is controlled so a parent (variant selection) can sync the
 * stage to a variant-specific image, but it also self-manages when uncontrolled.
 */
export function ProductGallery({
  images,
  alt,
  activeIndex,
  onActiveChange,
}: {
  images: GalleryImage[];
  alt: string;
  activeIndex?: number;
  onActiveChange?: (i: number) => void;
}) {
  const [internal, setInternal] = useState(0);
  const active = activeIndex ?? internal;
  const setActive = (i: number) => {
    onActiveChange?.(i);
    if (activeIndex == null) setInternal(i);
  };

  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const [lightbox, setLightbox] = useState(false);

  const current = images[active];

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-neutral-50 to-neutral-100 text-neutral-300">
        <PlaceholderIcon />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4">
      {/* Main stage */}
      <div className="flex-1">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          onMouseEnter={() => setZoom(true)}
          onMouseLeave={() => {
            setZoom(false);
            setOrigin('50% 50%');
          }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            const y = ((e.clientY - r.top) / r.height) * 100;
            setOrigin(`${x}% ${y}%`);
          }}
          aria-label={alt}
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-neutral-50 to-neutral-100"
        >
          <Image
            key={current.id}
            src={current.url}
            alt={alt}
            fill
            priority
            sizes="(max-width:1024px) 100vw, 45vw"
            onLoad={() => setLoaded((m) => ({ ...m, [active]: true }))}
            style={{ transformOrigin: origin }}
            className={`object-contain p-6 transition-[transform,opacity] duration-300 ${
              zoom ? 'scale-150' : 'scale-100'
            } ${loaded[active] ? 'opacity-100' : 'opacity-0'}`}
          />
          {!loaded[active] && (
            <div className="absolute inset-0 animate-pulse bg-neutral-100" aria-hidden />
          )}
          <span className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-black/55 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
            <ExpandIcon />
          </span>
        </button>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 lg:max-h-[28rem] lg:flex-col lg:overflow-y-auto lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${alt} ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-16 flex-shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-gradient-to-br from-neutral-50 to-neutral-100 transition lg:h-20 lg:w-20 ${
                i === active
                  ? 'border-primary ring-2 ring-primary/25'
                  : 'border-transparent hover:border-primary/40'
              }`}
            >
              <Image src={m.url} alt="" fill sizes="80px" className="object-contain p-2" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={images}
          index={active}
          alt={alt}
          onIndex={setActive}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  alt,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  alt: string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, images.length, onClose, onIndex]);

  const current = images[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        >
          <CloseIcon />
        </button>
      </div>
      <div
        className="relative flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        {current && (
          <Image src={current.url} alt={alt} fill sizes="100vw" className="object-contain p-4" />
        )}
        {images.length > 1 && (
          <>
            <NavButton
              side="start"
              onClick={() => onIndex((index - 1 + images.length) % images.length)}
            />
            <NavButton side="end" onClick={() => onIndex((index + 1) % images.length)} />
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-2 p-4" onClick={(e) => e.stopPropagation()}>
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`${alt} ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick }: { side: 'start' | 'end'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'start' ? 'Previous' : 'Next'}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 ${
        side === 'start' ? 'start-4' : 'end-4'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={side === 'start' ? 'rtl:rotate-180' : 'ltr:rotate-180'}
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  );
}

function PlaceholderIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
