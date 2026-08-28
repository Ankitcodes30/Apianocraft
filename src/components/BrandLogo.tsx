import * as React from 'react'

export const BrandLogo: React.FC = () => {
  return (
    <div
      className="flex items-center gap-2.5 mr-2 select-none group cursor-default"
      aria-label="Apianocraft Digital Piano Workstation Logo"
      title="Apianocraft Workstation"
    >
      <div className="relative flex items-center justify-center">
        <svg
          className="w-7 h-7 text-primary transition-transform duration-200 group-hover:scale-105"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Workstation Outer Chassis */}
          <rect
            x="2"
            y="4"
            width="28"
            height="24"
            rx="4"
            className="fill-primary/10 stroke-primary"
            strokeWidth="2"
          />
          {/* Piano Key Dividers */}
          <line
            x1="9"
            y1="12"
            x2="9"
            y2="24"
            className="stroke-primary/70"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="16"
            y1="12"
            x2="16"
            y2="24"
            className="stroke-primary/70"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="23"
            y1="12"
            x2="23"
            y2="24"
            className="stroke-primary/70"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Black Keys */}
          <rect x="11.5" y="12" width="3" height="6.5" rx="1" className="fill-primary stroke-none" />
          <rect x="18.5" y="12" width="3" height="6.5" rx="1" className="fill-primary stroke-none" />
          {/* Audio Waveform Top Accent */}
          <path
            d="M3 8c4.5 0 6.5-3 9.5-3s4.5 5 7.5 5 5.5-2 9-2"
            stroke="var(--color-electric-green, #35ed7e)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-base tracking-tight text-foreground font-sans">
            Apianocraft
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Audio Engine Online" />
        </div>
        <span className="text-[9px] font-extrabold text-primary tracking-widest uppercase opacity-90 mt-0.5">
          Workstation
        </span>
      </div>
    </div>
  )
}
