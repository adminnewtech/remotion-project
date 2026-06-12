/**
 * @elite/ui/web — web React components (Tailwind className-based, shadcn-style).
 *
 * Web-only: these import React and emit DOM. The mobile app must NOT import
 * from here — it consumes `@elite/ui` (tokens + status + formatters) instead.
 */
export { cn, type ClassValue } from './cn';

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from './Card';
export { Badge, type BadgeProps, type BadgeTone, type BadgeVariant } from './Badge';
export { StatusBadge, type StatusBadgeProps } from './StatusBadge';
export { Input, type InputProps } from './Input';
export { Select, type SelectProps, type SelectOption } from './Select';
export { Modal, type ModalProps } from './Modal';
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  type TableProps,
} from './Table';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Spinner, type SpinnerProps } from './Spinner';
export { Avatar, type AvatarProps } from './Avatar';
export { PriceTag, type PriceTagProps } from './PriceTag';
export { Rating, type RatingProps } from './Rating';
// `Stars` is a read-only display alias of `Rating` for review/score surfaces.
export { Rating as Stars } from './Rating';

// --- Added components (storefront + admin) ---
export { Skeleton, type SkeletonProps, ProductCardSkeleton, type ProductCardSkeletonProps } from './Skeleton';
export { Tabs, type TabsProps, type TabItem } from './Tabs';
export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem } from './Breadcrumbs';
export { Alert, type AlertProps, type AlertTone } from './Alert';
export {
  ToastProvider,
  type ToastProviderProps,
  useToast,
  type ToastContextValue,
  type ToastOptions,
} from './Toast';
export {
  Drawer,
  type DrawerProps,
  type DrawerSide,
  Sheet,
  type SheetProps,
} from './Drawer';
export { Pagination, type PaginationProps } from './Pagination';
export { RangeSlider, type RangeSliderProps } from './RangeSlider';
export { Chip, type ChipProps, FilterChip, type FilterChipProps } from './Chip';
export { QuantityStepper, type QuantityStepperProps } from './QuantityStepper';
export { ImageGallery, type ImageGalleryProps, type GalleryImage } from './ImageGallery';
export { RatingInput, type RatingInputProps } from './RatingInput';
export { KpiCard, type KpiCardProps, type KpiTrend, StatCard, type StatCardProps } from './KpiCard';

// --- OSALPHA "Gold" admin primitives ---
export {
  StatusPill,
  type StatusPillProps,
  type StatusTone,
  PayChip,
  type PayChipProps,
  ProgressBar,
  type ProgressBarProps,
  Sparkline,
  type SparklineProps,
  type SparkSeries,
  Checklist,
  type ChecklistProps,
  type ChecklistItem,
} from './osalpha';
