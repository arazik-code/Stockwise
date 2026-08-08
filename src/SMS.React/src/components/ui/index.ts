/**
 * The primitive kit.
 *
 * Pages import from here and nowhere else:
 *
 *     import { Page, Button, DataTable, StatusBadge } from '@/components/ui'
 *
 * Never reach into a primitive's file directly - the barrel is the public
 * surface, and after Phase 0 it is append-only (see CONTRACT.md). If something
 * you need is missing, it gets ADDED here and shown on /design first, rather
 * than reinvented in a page.
 */

export { cn } from './cn'

// Layout
export { Page } from './Page'
export type { PageProps } from './Page'

// Actions
export { Button, IconButton } from './Button'
export type { ButtonProps, IconButtonProps } from './Button'

// Form controls - every one wraps a NATIVE element. See the note in Field.tsx:
// PosPage's global key handler gates on tagName, so a div-based control would
// silently break scanning on a live till.
export { Input, Select, Textarea, Checkbox, Switch } from './Field'
export type { InputProps, SelectProps, TextareaProps, CheckboxProps, SwitchProps } from './Field'

// Surfaces
export { Card, CardHeader, CardTitle, CardDescription, CardFooter, Surface } from './Card'
export type { CardProps, SurfaceProps } from './Card'

// Overlays. Modal/Sheet default closeOnEsc to FALSE - read the note in Modal.tsx.
export { Modal, Sheet } from './Modal'
export type { ModalProps, SheetProps } from './Modal'
export { ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'
export { Popover, DropdownMenu, Tooltip } from './Popover'
export type { PopoverProps, DropdownItem, TooltipProps } from './Popover'

// Status
export { Badge, StatusDot } from './Badge'
export type { BadgeProps, StatusDotProps } from './Badge'
export { StatusBadge } from './StatusBadge'
export type { StatusBadgeProps } from './StatusBadge'

// Navigation
export { Tabs } from './Tabs'
export type { TabsProps, TabItem } from './Tabs'

// Data
export { DataTable, VirtualTable, shouldVirtualize, VIRTUALIZE_THRESHOLD } from './DataTable'
export type { DataTableProps, VirtualTableProps, Column, SortState } from './DataTable'

// Feedback states - loading, empty AND error. All three are required on every
// list by the contract; the third is the one this codebase never had.
export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'
export {
  Skeleton, SkeletonText, SkeletonTable, SkeletonCards, SkeletonStats,
  EmptyState, ErrorState, ErrorBanner,
} from './States'
export type { SkeletonProps, EmptyStateProps, ErrorStateProps } from './States'

export { showToast, dismissToast, ToastViewport } from './Toast'
export type { ToastType, ToastOptions } from './Toast'

// Display
export { StatCard, ProgressBar, CountUp, useDataPulse } from './StatCard'
export type { StatCardProps, ProgressBarProps } from './StatCard'
export { Pagination, Avatar, KeyHint, SectionHeader, Toolbar } from './Misc'
export type { PaginationProps } from './Misc'

// Charts
export { ChartFrame, BarChart, DonutChart, Sparkline, BreakdownRow } from './charts'
export type { ChartFrameProps, BarChartProps, BarDatum, DonutSlice } from './charts'
