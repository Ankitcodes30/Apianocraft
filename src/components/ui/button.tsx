import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[4px] text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer active:translate-y-[0.5px]',
  {
    variants: {
      variant: {
        default: 'bg-[#5B7FA3] text-white hover:bg-[#687F99] border border-[#5B7FA3]',
        destructive:
          'bg-[#292424] text-[#A84A4A] hover:bg-[#382828] hover:text-[#F2F2F2] border border-[#A84A4A]/60 font-semibold',
        outline:
          'border border-[#3A3A3A] bg-[#2B2B2B] text-[#D5D5D5] hover:bg-[#353535] hover:text-[#F2F2F2]',
        secondary:
          'bg-[#2B2B2B] text-[#D5D5D5] hover:bg-[#353535] hover:text-[#F2F2F2] border border-[#444444]',
        ghost: 'text-[#D5D5D5] hover:bg-[#2E2E2E] hover:text-[#F2F2F2]',
        link: 'text-[#5B7FA3] underline-offset-4 hover:underline',
        green: 'bg-[#6FA77A] text-white hover:bg-[#5B9667] font-semibold border border-[#6FA77A]',
        panic: 'bg-[#292424] text-[#A84A4A] hover:bg-[#382828] hover:text-[#F2F2F2] font-semibold border border-[#A84A4A]/60',
        on: 'bg-[#5B7FA3] border border-[#5B7FA3] text-white font-semibold',
      },
      size: {
        default: 'h-7 px-3 py-1 text-xs',
        sm: 'h-6 rounded-[4px] px-2 text-[11px]',
        lg: 'h-8 rounded-[4px] px-4 text-xs',
        icon: 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
