import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, onValueChange, children, ...props }, ref) => {
    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      'inline-flex h-8 items-center justify-center rounded-md bg-secondary/40 p-0.5 text-muted-foreground gap-1',
      className
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context?.value === value

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) onClick(e)
      context?.onValueChange(value)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          isSelected
            ? 'bg-card text-foreground shadow-xs border border-border'
            : 'hover:bg-accent/40 hover:text-accent-foreground text-muted-foreground',
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const isSelected = context?.value === value

    if (!isSelected) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
