import React from 'react'

export function AuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* ── Layer 1: Ambient Base Washes ── */}
      {/* Top Center Lavender Wash */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[56rem] h-[30rem] bg-gradient-to-b from-purple-400/15 via-indigo-300/10 to-transparent dark:from-purple-600/15 dark:via-indigo-900/10 rounded-full blur-3xl transform-gpu" />
      {/* Upper-Right Cyan Glow */}
      <div className="absolute top-12 -right-24 w-[32rem] h-[32rem] bg-cyan-300/15 dark:bg-cyan-600/10 rounded-full blur-3xl transform-gpu" />
      {/* Lower-Left Pink/Peach Accent */}
      <div className="absolute bottom-10 -left-24 w-[30rem] h-[30rem] bg-rose-200/15 dark:bg-rose-900/10 rounded-full blur-3xl transform-gpu" />

      {/* ── Layer 2: Subtle Micro-Dot Matrix Canvas ── */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1.5px 1.5px, currentColor 1.5px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Layer 3: Controlled Preschool & Orbital Compositions ── */}
      
      {/* Top-Left: Very subtle soft organic form */}
      <div className="hidden md:block absolute top-12 left-[6%] opacity-40 dark:opacity-15">
        <svg width="180" height="120" viewBox="0 0 180 120" fill="none">
          <path
            d="M30 90C15 70 20 40 45 25C70 10 110 15 135 35C160 55 165 85 145 105C125 125 45 110 30 90Z"
            fill="url(#organicBlobGrad)"
          />
          <defs>
            <linearGradient id="organicBlobGrad" x1="20" y1="20" x2="160" y2="110">
              <stop stopColor="#DDD6FE" stopOpacity="0.7" />
              <stop offset="1" stopColor="#E0E7FF" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Upper-Right: Soft PreOne Orbital Ring */}
      <div className="hidden sm:block absolute top-14 right-[8%] xl:right-[12%] w-64 h-64 opacity-50 dark:opacity-20 pointer-events-none">
        <svg viewBox="0 0 240 240" fill="none" className="w-full h-full">
          <ellipse
            cx="120"
            cy="120"
            rx="105"
            ry="46"
            stroke="#A855F7"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            transform="rotate(-24 120 120)"
          />
          {/* Orbiting celestial dot */}
          <circle cx="195" cy="85" r="5" fill="#F59E0B" />
          <circle cx="193" cy="83" r="1.5" fill="#FFFFFF" opacity="0.7" />
          {/* Subtle twinkle star near orbit */}
          <path
            d="M210 60L211.5 63.5L215 65L211.5 66.5L210 70L208.5 66.5L205 65L208.5 63.5L210 60Z"
            fill="#FBBF24"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Lower-Left: Small Pastel Cloud Form */}
      <div className="hidden lg:block absolute bottom-20 left-[10%] opacity-55 dark:opacity-20 transform-gpu animate-[pulse_10s_ease-in-out_infinite]">
        <svg width="130" height="78" viewBox="0 0 130 78" fill="none">
          <defs>
            <linearGradient id="lowerCloudGrad" x1="15" y1="10" x2="115" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#E9D5FF" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path
            d="M36 64h62a20 20 0 0 0 4-39.6 25 25 0 0 0-48-7.4A18 18 0 0 0 18 46a18 18 0 0 0 18 18z"
            fill="url(#lowerCloudGrad)"
            filter="drop-shadow(0 4px 10px rgba(139, 92, 246, 0.07))"
          />
        </svg>
      </div>

      {/* Lower-Right: Tiny Star & Dot Composition */}
      <div className="absolute bottom-24 right-[10%] xl:right-[15%] opacity-60 dark:opacity-30">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          {/* Twinkle Star */}
          <path
            d="M30 10C30 18 36 24 44 24C36 24 30 30 30 38C30 30 24 24 16 24C24 24 30 18 30 10Z"
            fill="#C084FC"
          />
          {/* Tiny companion dots */}
          <circle cx="48" cy="14" r="2" fill="#FBBF24" />
          <circle cx="18" cy="42" r="2.5" fill="#38BDF8" opacity="0.7" />
        </svg>
      </div>
    </div>
  )
}
