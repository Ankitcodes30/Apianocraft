import React, { useState } from 'react'

interface ResetButtonProps {
  onReset: () => void
  title?: string
  ariaLabel?: string
  dataTestId?: string
  className?: string
}

export const ResetButton: React.FC<ResetButtonProps> = ({
  onReset,
  title = 'Reset to Default',
  ariaLabel = 'Reset to Default',
  dataTestId,
  className = '',
}) => {
  const [clicked, setClicked] = useState(false)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onReset()
    setClicked(true)
    setTimeout(() => setClicked(false), 300)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={`inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer select-none ${
        clicked ? 'rotate-[-180deg] text-primary' : ''
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3 h-3"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  )
}
