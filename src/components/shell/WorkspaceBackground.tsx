import React from 'react'

/**
 * Reusable PreOne OS Workspace Atmospheric Background
 *
 * Implements the approved PreOne ambient design language:
 * - Layer 1: Ambient soft atmospheric base washes (lavender, cyan, peach/rose)
 * - Layer 2: Tactile micro-dot matrix canvas at 2-3.5% opacity
 * - Layer 3: Controlled preschool & celestial motifs (orbital ring with golden satellite dot, cloud, star)
 * - Quiet center to ensure module cards have maximum contrast and zero visual interference
 * - Fully theme-aware (supports light and dark modes)
 */
export function WorkspaceBackground() {
  return (
    <div
      className="workspace-bg absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
      aria-hidden="true"
    >
      {/* ── Layer 1: Ambient Brand Radial Wash ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'var(--brand-ambient-wash)',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* ── Layer 2: Subtle Micro-Dot Matrix Canvas ── */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1.5px 1.5px, currentColor 1.5px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Layer 3: Controlled Preschool & Orbital Motifs ── */}
      {/* Upper-Right: Soft PreOne Orbital Ring & Golden Satellite Dot */}
      <div className="hidden sm:block absolute top-12 right-[6%] xl:right-[10%] w-60 h-60 opacity-45 dark:opacity-20 pointer-events-none">
        <svg viewBox="0 0 240 240" fill="none" className="w-full h-full">
          <ellipse
            cx="120"
            cy="120"
            rx="105"
            ry="44"
            stroke="#A855F7"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            transform="rotate(-22 120 120)"
          />
          {/* Orbiting celestial satellite dot */}
          <circle cx="195" cy="85" r="5" fill="#F59E0B" />
          <circle cx="193" cy="83" r="1.5" fill="#FFFFFF" opacity="0.75" />
          {/* Subtle twinkle star near orbit */}
          <path
            d="M210 60L211.5 63.5L215 65L211.5 66.5L210 70L208.5 66.5L205 65L208.5 63.5L210 60Z"
            fill="#FBBF24"
            opacity="0.8"
          />
        </svg>
      </div>

      {/* Lower-Left: Soft Pastel Cloud Form */}
      <div className="hidden lg:block absolute bottom-28 left-[8%] opacity-40 dark:opacity-15 transform-gpu animate-[pulse_12s_ease-in-out_infinite]">
        <svg width="130" height="78" viewBox="0 0 130 78" fill="none">
          <defs>
            <linearGradient id="workspaceCloudGrad" x1="15" y1="10" x2="115" y2="70" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#E9D5FF" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path
            d="M36 64h62a20 20 0 0 0 4-39.6 25 25 0 0 0-48-7.4A18 18 0 0 0 18 46a18 18 0 0 0 18 18z"
            fill="url(#workspaceCloudGrad)"
            filter="drop-shadow(0 4px 12px rgba(139, 92, 246, 0.06))"
          />
        </svg>
      </div>

      {/* Lower-Right: Tiny Star & Dot Composition */}
      <div className="hidden md:block absolute bottom-24 right-[8%] opacity-50 dark:opacity-25">
        <svg width="54" height="54" viewBox="0 0 60 60" fill="none">
          <path
            d="M30 10C30 18 36 24 44 24C36 24 30 30 30 38C30 30 24 24 16 24C24 24 30 18 30 10Z"
            fill="#C084FC"
          />
          <circle cx="48" cy="14" r="2" fill="#FBBF24" />
          <circle cx="18" cy="42" r="2.5" fill="#38BDF8" opacity="0.7" />
        </svg>
      </div>
    </div>
  )
}
