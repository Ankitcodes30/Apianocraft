import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 tabular-nums whitespace-nowrap select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        accent: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700/50',
        ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700/50',
        warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/50',
        bad: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
