import * as React from 'react'

export const BrandLogo: React.FC = () => {
  return (
    <div
      className="flex items-center gap-2 select-none group cursor-default shrink-0"
      aria-label="Apianocraft Digital Keyboard Workstation"
      title="Apianocraft Workstation"
    >
      <div className="relative flex items-center justify-center">
        <svg
          className="w-6 h-6 text-[#5B7FA3]"
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
            rx="3"
            className="fill-[#242424] stroke-[#5B7FA3]"
            strokeWidth="1.5"
          />
          {/* Piano Key Dividers */}
          <line
            x1="9"
            y1="13"
            x2="9"
            y2="24"
            className="stroke-[#687F99]"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1="16"
            y1="13"
            x2="16"
            y2="24"
            className="stroke-[#687F99]"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1="23"
            y1="13"
            x2="23"
            y2="24"
            className="stroke-[#687F99]"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Black Keys */}
          <rect x="11.5" y="13" width="3" height="6" rx="0.5" className="fill-[#5B7FA3] stroke-none" />
          <rect x="18.5" y="13" width="3" height="6" rx="0.5" className="fill-[#5B7FA3] stroke-none" />
          {/* Waveform Accent */}
          <path
            d="M3 8.5c4.5 0 6.5-3 9.5-3s4.5 5 7.5 5 5.5-2 9-2"
            stroke="#6FA77A"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm tracking-tight text-[#F2F2F2] font-sans">
            Apianocraft
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6FA77A]" title="Audio Engine Online" />
        </div>
        <span className="text-[8px] font-bold text-[#808080] tracking-widest uppercase mt-0.5 font-mono">
          WORKSTATION
        </span>
      </div>
    </div>
  )
}
