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
