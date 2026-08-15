import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[9px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring tabular-nums whitespace-nowrap select-none font-mono',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#5B7FA3] text-white',
        secondary:
          'border-[#3A3A3A] bg-[#292929] text-[#B5B5B5]',
        destructive:
          'border-[#A84A4A]/40 bg-[#292424] text-[#A84A4A]',
        outline: 'text-[#B5B5B5] border-[#3A3A3A]',
        accent: 'border-[#4A5D70] bg-[#29323C] text-[#F2F2F2]',
        ok: 'border-[#3A3A3A] bg-[#242424] text-[#F2F2F2]',
        warn: 'border-[#C89040]/30 bg-[rgba(200,144,64,0.1)] text-[#C89040]',
        bad: 'border-[#A84A4A]/30 bg-[rgba(168,74,74,0.1)] text-[#A84A4A]',
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
