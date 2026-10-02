'use client'

import React from 'react'

export interface EmptyIllustrationProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
  primaryColor?: string
  accentColor?: string
}

/**
 * Common shared stroke & fill styling for whimsical preschool-grade line art
 */
const BASE_STROKE = '#64748B' // slate-500
const LIGHT_STROKE = '#94A3B8' // slate-400
const SOFT_FILL = 'rgba(241, 245, 249, 0.7)' // slate-100 / soft canvas
const BRAND_ACCENT = 'var(--primary, #7C3AED)'
const BRAND_SOFT = 'color-mix(in srgb, var(--primary, #7C3AED) 14%, transparent)'
const BRAND_SECONDARY = 'var(--accent, #3B82F6)'

// ── 1. Enquiries (Paper Airplane + Message Envelope) ─────────────────────────
export function EnquiriesIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Soft Envelope */}
      <rect x="22" y="34" width="52" height="36" rx="6" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      <path d="M22 38L48 56L74 38" stroke={LIGHT_STROKE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Paper Airplane */}
      <path
        d="M38 28L68 20L58 48L49 39L38 28Z"
        fill="#FFFFFF"
        stroke={BRAND_ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M49 39L68 20" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      {/* Trail sparkles */}
      <path d="M26 26C30 24 33 27 36 29" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 3" />
      <circle cx="76" cy="30" r="2" fill={BRAND_SECONDARY} />
      <circle cx="20" cy="56" r="1.5" fill={LIGHT_STROKE} />
    </svg>
  )
}

// ── 2. Follow-ups (Calendar + Gentle Reminder Clock) ─────────────────────────
export function FollowupsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Calendar Base */}
      <rect x="24" y="26" width="48" height="46" rx="8" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      <path d="M24 38H72" stroke={LIGHT_STROKE} strokeWidth="1.6" />
      {/* Calendar Pins */}
      <path d="M36 21V27" stroke={BRAND_ACCENT} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 21V27" stroke={BRAND_ACCENT} strokeWidth="2.2" strokeLinecap="round" />
      {/* Calendar Grid Dots */}
      <circle cx="34" cy="48" r="2" fill={LIGHT_STROKE} />
      <circle cx="44" cy="48" r="2" fill={LIGHT_STROKE} />
      <circle cx="54" cy="48" r="2" fill={LIGHT_STROKE} />
      <circle cx="34" cy="58" r="2" fill={LIGHT_STROKE} />
      {/* Clock badge */}
      <circle cx="62" cy="62" r="14" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="2" />
      <path d="M62 55V62L67 65" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Soft Sparkle */}
      <path d="M20 20L21.5 24L25.5 25.5L21.5 27L20 31L18.5 27L14.5 25.5L18.5 24L20 20Z" fill={BRAND_SECONDARY} opacity="0.8" />
    </svg>
  )
}

// ── 3. Applications (Preschool Clipboard & Pencil) ───────────────────────────
export function ApplicationsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Clipboard */}
      <rect x="28" y="24" width="40" height="52" rx="6" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Clip */}
      <rect x="40" y="20" width="16" height="8" rx="3" fill={SOFT_FILL} stroke={BASE_STROKE} strokeWidth="1.6" />
      <circle cx="48" cy="24" r="1.5" fill={BASE_STROKE} />
      {/* Application Sheet Lines */}
      <rect x="36" y="36" width="24" height="3" rx="1.5" fill={BRAND_ACCENT} opacity="0.7" />
      <rect x="36" y="44" width="20" height="2.5" rx="1.2" fill={LIGHT_STROKE} />
      <rect x="36" y="51" width="16" height="2.5" rx="1.2" fill={LIGHT_STROKE} />
      <rect x="36" y="58" width="22" height="2.5" rx="1.2" fill={LIGHT_STROKE} />
      {/* Pencil */}
      <g transform="rotate(35 68 58)">
        <rect x="64" y="38" width="6" height="24" rx="2" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" />
        <path d="M64 62L67 68L70 62Z" fill={SOFT_FILL} stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

// ── 4. Waiting List (Queue Cards / Gentle Hourglass) ─────────────────────────
export function WaitingListIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Stacked Queue Cards */}
      <rect x="34" y="24" width="38" height="28" rx="5" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.6" />
      <rect x="28" y="32" width="38" height="28" rx="5" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Card Content */}
      <circle cx="38" cy="44" r="4" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.5" />
      <rect x="46" y="41" width="14" height="2.5" rx="1.2" fill={BASE_STROKE} />
      <rect x="46" y="47" width="10" height="2" rx="1" fill={LIGHT_STROKE} />
      {/* Hourglass */}
      <g transform="translate(48, 48)">
        <path d="M8 8H26V11L20 18L26 25V28H8V25L14 18L8 11V8Z" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 25C13 22 21 22 22 25" fill={BRAND_ACCENT} />
      </g>
    </svg>
  )
}

// ── 5. Classroom Placements (Desk + Morning Sun) ─────────────────────────────
export function ClassroomsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Morning Sun */}
      <circle cx="68" cy="30" r="10" fill="color-mix(in srgb, #F59E0B 18%, transparent)" stroke="#F59E0B" strokeWidth="1.8" />
      <path d="M68 15V18M83 30H80M78 20L76 22M78 40L76 38" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Classroom Desk */}
      <rect x="26" y="52" width="44" height="6" rx="2" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      <path d="M32 58V74M64 58V74" stroke={BASE_STROKE} strokeWidth="1.8" strokeLinecap="round" />
      {/* Chair */}
      <path d="M42 42V52M54 42V52M40 42H56" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M43 52V70M53 52V70" stroke={BRAND_ACCENT} strokeWidth="1.6" strokeLinecap="round" />
      {/* Desk Book */}
      <path d="M40 48L48 50L56 48" stroke={BRAND_SECONDARY} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── 6. Students (Child Profile Card / School Backpack) ───────────────────────
export function StudentsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Student Badge Card */}
      <rect x="24" y="24" width="48" height="52" rx="8" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Lanyard Clip */}
      <rect x="42" y="20" width="12" height="6" rx="2" fill={SOFT_FILL} stroke={BASE_STROKE} strokeWidth="1.5" />
      {/* Student Avatar Outline */}
      <circle cx="48" cy="40" r="9" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <path d="M36 56C36 50 42 48 48 48C54 48 60 50 60 56" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      {/* Name line */}
      <rect x="36" y="61" width="24" height="3" rx="1.5" fill={BASE_STROKE} />
      <rect x="40" y="67" width="16" height="2" rx="1" fill={LIGHT_STROKE} />
      {/* Friendly Sparkles */}
      <circle cx="76" cy="36" r="2.5" fill={BRAND_SECONDARY} />
      <circle cx="20" cy="52" r="2" fill="#F59E0B" />
    </svg>
  )
}

// ── 7. Curriculum (Open Storybook) ───────────────────────────────────────────
export function CurriculumIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Open Book */}
      <path
        d="M48 64C40 60 30 60 22 63V35C30 32 40 32 48 36C56 32 66 32 74 35V63C66 60 56 60 48 64Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M48 36V64" stroke={BASE_STROKE} strokeWidth="1.8" strokeLinecap="round" />
      {/* Book Lines */}
      <path d="M28 41C34 39 40 39 44 41M28 48C34 46 40 46 44 48" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M52 41C56 39 62 39 68 41M52 48C56 46 62 46 68 48" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" />
      {/* Ribbon Bookmark */}
      <path d="M48 36V50L52 46L56 50V36" fill={BRAND_ACCENT} stroke={BRAND_ACCENT} strokeWidth="1.2" strokeLinejoin="round" />
      {/* Story Sparkles */}
      <path d="M48 18L49.5 22L53.5 23.5L49.5 25L48 29L46.5 25L42.5 23.5L46.5 22L48 18Z" fill="#F59E0B" />
    </svg>
  )
}

// ── 8. Attendance (Calendar + Clean Check) ───────────────────────────────────
export function AttendanceIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Calendar */}
      <rect x="24" y="26" width="48" height="46" rx="8" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      <path d="M24 38H72" stroke={LIGHT_STROKE} strokeWidth="1.6" />
      <path d="M36 21V27M60 21V27" stroke={BASE_STROKE} strokeWidth="2.2" strokeLinecap="round" />
      {/* Checkmark Circle */}
      <circle cx="48" cy="53" r="12" fill="color-mix(in srgb, #10B981 16%, transparent)" stroke="#10B981" strokeWidth="1.8" />
      <path d="M43 53L47 57L54 49" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="74" cy="24" r="2" fill={BRAND_ACCENT} />
    </svg>
  )
}

// ── 9. Health & Safety (Heart Shield / Cross) ────────────────────────────────
export function HealthIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Shield Base */}
      <path
        d="M48 24L68 32V50C68 64 48 74 48 74C48 74 28 64 28 50V32L48 24Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Gentle Red / Soft Cross */}
      <rect x="45" y="38" width="6" height="18" rx="2" fill="#EF4444" />
      <rect x="39" y="44" width="18" height="6" rx="2" fill="#EF4444" />
      <circle cx="74" cy="30" r="2.5" fill={BRAND_ACCENT} />
    </svg>
  )
}

// ── 10. Finance & Fee Plans (Wallet / Calculator / Ledger) ───────────────────
export function FinanceIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Ledger / Wallet Card */}
      <rect x="24" y="30" width="48" height="38" rx="8" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Flap */}
      <path d="M24 38H72" stroke={LIGHT_STROKE} strokeWidth="1.6" />
      {/* Coin / Badge */}
      <circle cx="48" cy="51" r="9" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <path d="M48 46V56M45 48H50C51 48 52 49 52 50C52 51 51 52 50 52H46C45 52 44 53 44 54C44 55 45 56 46 56H51" stroke={BRAND_ACCENT} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ── 11. Payments (Receipt with Stamp / Check) ────────────────────────────────
export function PaymentsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Receipt Sheet */}
      <path
        d="M30 22H66V74L60 70L54 74L48 70L42 74L36 70L30 74V22Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Receipt Lines */}
      <rect x="38" y="32" width="20" height="3" rx="1.5" fill={BASE_STROKE} />
      <rect x="38" y="39" width="16" height="2" rx="1" fill={LIGHT_STROKE} />
      <rect x="38" y="45" width="20" height="2" rx="1" fill={LIGHT_STROKE} />
      {/* Paid Stamp */}
      <rect x="44" y="52" width="22" height="12" rx="3" fill="color-mix(in srgb, #10B981 16%, transparent)" stroke="#10B981" strokeWidth="1.6" />
      <path d="M49 58L52 61L61 55" stroke="#10B981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── 12. Invoices (Document Stack with Currency Symbol) ───────────────────────
export function InvoicesIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Back Sheet */}
      <rect x="34" y="22" width="36" height="48" rx="5" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.6" />
      {/* Front Sheet */}
      <rect x="26" y="28" width="36" height="48" rx="5" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Invoice Details */}
      <rect x="32" y="36" width="16" height="3" rx="1.5" fill={BRAND_ACCENT} />
      <rect x="32" y="43" width="24" height="2" rx="1" fill={LIGHT_STROKE} />
      <rect x="32" y="49" width="20" height="2" rx="1" fill={LIGHT_STROKE} />
      <path d="M32 58H56" stroke={BASE_STROKE} strokeWidth="1.4" strokeDasharray="2 2" />
      <circle cx="54" cy="65" r="7" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.5" />
      <path d="M54 61V69M52 63H55C56 63 56.5 63.5 56.5 64C56.5 64.5 56 65 55 65H53C52 65 51.5 65.5 51.5 66C51.5 66.5 52 67 53 67H56" stroke={BRAND_ACCENT} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── 13. Communications (Speech Bubbles with Smile) ───────────────────────────
export function CommunicationsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Large Bubble */}
      <path
        d="M26 30C26 24.5 30.5 20 36 20H60C65.5 20 70 24.5 70 30V44C70 49.5 65.5 54 60 54H42L30 62V54H36C30.5 54 26 49.5 26 44V30Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Speech lines */}
      <rect x="36" y="30" width="24" height="3" rx="1.5" fill={BRAND_ACCENT} opacity="0.8" />
      <rect x="36" y="37" width="16" height="2.5" rx="1.2" fill={LIGHT_STROKE} />
      {/* Small Secondary Bubble */}
      <circle cx="68" cy="62" r="10" fill="#FFFFFF" stroke={BRAND_SECONDARY} strokeWidth="1.8" />
      <circle cx="65" cy="61" r="1.2" fill={BRAND_SECONDARY} />
      <circle cx="71" cy="61" r="1.2" fill={BRAND_SECONDARY} />
      <path d="M66 64C67 65.5 69 65.5 70 64" stroke={BRAND_SECONDARY} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── 14. Users (Educator & Team Outline) ───────────────────────────────────────
export function UsersIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Background User */}
      <circle cx="34" cy="40" r="7" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.5" />
      <path d="M22 58C22 52 28 50 34 50C40 50 46 52 46 58" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" />
      {/* Background User 2 */}
      <circle cx="62" cy="40" r="7" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.5" />
      <path d="M50 58C50 52 56 50 62 50C68 50 74 52 74 58" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" />
      {/* Foreground Primary User */}
      <circle cx="48" cy="36" r="9" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <path d="M34 62C34 54 40 50 48 50C56 50 62 54 62 62" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      {/* Preschool Glasses */}
      <rect x="42" y="34" width="4" height="3" rx="1" stroke={BASE_STROKE} strokeWidth="1.2" />
      <rect x="50" y="34" width="4" height="3" rx="1" stroke={BASE_STROKE} strokeWidth="1.2" />
      <path d="M46 35H50" stroke={BASE_STROKE} strokeWidth="1.2" />
    </svg>
  )
}

// ── 15. Setup (School Building & Building Blocks) ─────────────────────────────
export function SetupIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* School Building */}
      <path d="M48 20L26 34V68H70V34L48 20Z" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" strokeLinejoin="round" />
      {/* School Bell Tower / Clock */}
      <circle cx="48" cy="38" r="6" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.5" />
      <path d="M48 35V38L50 40" stroke={BRAND_ACCENT} strokeWidth="1.2" strokeLinecap="round" />
      {/* Door */}
      <rect x="42" y="52" width="12" height="16" rx="2" fill={SOFT_FILL} stroke={BASE_STROKE} strokeWidth="1.6" />
      {/* Windows */}
      <rect x="32" y="44" width="6" height="8" rx="1" fill="#FFFFFF" stroke={LIGHT_STROKE} strokeWidth="1.4" />
      <rect x="58" y="44" width="6" height="8" rx="1" fill="#FFFFFF" stroke={LIGHT_STROKE} strokeWidth="1.4" />
      {/* Flag */}
      <path d="M48 14V20M48 14L55 17L48 20" stroke={BRAND_ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── 16. Branding (School Crest & Artist Palette) ─────────────────────────────
export function BrandingIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Palette */}
      <path
        d="M48 22C32 22 22 34 22 48C22 62 34 72 46 72C50 72 52 70 52 67C52 65.5 51.5 64 51.5 62C51.5 59.5 54 58 57 58H62C71 58 76 52 76 44C76 32 62 22 48 22Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
      />
      {/* Paint Dots */}
      <circle cx="34" cy="38" r="4" fill={BRAND_ACCENT} />
      <circle cx="46" cy="32" r="3.5" fill={BRAND_SECONDARY} />
      <circle cx="58" cy="38" r="3.5" fill="#F59E0B" />
      <circle cx="34" cy="52" r="3.5" fill="#10B981" />
      {/* Brush */}
      <g transform="rotate(45 64 56)">
        <rect x="62" y="40" width="4" height="24" rx="2" fill={SOFT_FILL} stroke={BASE_STROKE} strokeWidth="1.4" />
        <path d="M62 64C62 67 66 67 66 64V60H62V64Z" fill={BRAND_ACCENT} />
      </g>
    </svg>
  )
}

// ── 17. Reports (Document + Bar Chart) ───────────────────────────────────────
export function ReportsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Document */}
      <rect x="26" y="24" width="44" height="52" rx="6" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Document Header Line */}
      <rect x="34" y="32" width="18" height="3" rx="1.5" fill={BRAND_ACCENT} />
      {/* Bar Chart inside Document */}
      <rect x="34" y="54" width="6" height="12" rx="1.5" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.4" />
      <rect x="44" y="46" width="6" height="20" rx="1.5" fill={BRAND_SOFT} stroke={BRAND_ACCENT} strokeWidth="1.5" />
      <rect x="54" y="40" width="6" height="26" rx="1.5" fill="color-mix(in srgb, #3B82F6 18%, transparent)" stroke="#3B82F6" strokeWidth="1.5" />
      {/* Baseline */}
      <path d="M32 68H64" stroke={BASE_STROKE} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// ── 18. Search Results Empty (Magnifying Glass + Question Sparkle) ───────────
export function SearchIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Document Base */}
      <rect x="28" y="26" width="38" height="46" rx="6" fill="#FFFFFF" stroke={LIGHT_STROKE} strokeWidth="1.6" />
      <rect x="36" y="34" width="22" height="3" rx="1.5" fill={SOFT_FILL} />
      <rect x="36" y="42" width="16" height="2" rx="1" fill={SOFT_FILL} />
      {/* Magnifying Glass */}
      <circle cx="54" cy="52" r="16" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="2.2" />
      <circle cx="54" cy="52" r="12" fill={BRAND_SOFT} />
      <path d="M66 64L76 74" stroke={BRAND_ACCENT} strokeWidth="3" strokeLinecap="round" />
      {/* Question mark in glass */}
      <path d="M51 48C51 46 53 45 54.5 45C56 45 57.5 46 57.5 47.5C57.5 49 56 50 54.5 51V53" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="54.5" cy="56.5" r="1" fill={BRAND_ACCENT} />
    </svg>
  )
}

// ── 19. Filter Results Empty (Funnel Filter with Clear Card) ─────────────────
export function FilterIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Funnel */}
      <path
        d="M26 28H70L54 48V66L42 60V48L26 28Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Filter sliders lines */}
      <path d="M34 36H62" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="42" cy="36" r="3" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <path d="M38 42H58" stroke={LIGHT_STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="52" cy="42" r="2.5" fill="#FFFFFF" stroke={LIGHT_STROKE} strokeWidth="1.5" />
    </svg>
  )
}

// ── 20. Notifications (Bell with Soft Spark) ─────────────────────────────────
export function NotificationsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Bell */}
      <path
        d="M48 24C41 24 36 29 36 36V48L30 56V60H66V56L60 48V36C60 29 55 24 48 24Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Clapper */}
      <path d="M43 60C43 63 45 65 48 65C51 65 53 63 53 60" stroke={BASE_STROKE} strokeWidth="1.8" />
      {/* Bell top loop */}
      <path d="M48 20V24" stroke={BASE_STROKE} strokeWidth="2" strokeLinecap="round" />
      {/* Soundwaves / Sparkles */}
      <path d="M68 32C71 35 71 41 68 44" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M28 32C25 35 25 41 28 44" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── 21. Documents (Clean Folder with Folded Sheet) ───────────────────────────
export function DocumentsIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Folder Back */}
      <path d="M24 32C24 28 27 26 31 26H44L49 31H68C72 31 75 34 75 38V66C75 70 72 73 68 73H31C27 73 24 70 24 66V32Z" fill={SOFT_FILL} stroke={LIGHT_STROKE} strokeWidth="1.6" />
      {/* Document Sheet */}
      <rect x="32" y="32" width="34" height="34" rx="4" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.6" />
      <rect x="38" y="40" width="16" height="2.5" rx="1.2" fill={BRAND_ACCENT} />
      <rect x="38" y="47" width="22" height="2" rx="1" fill={LIGHT_STROKE} />
      {/* Folder Front Flap */}
      <path d="M22 42C22 39 25 37 28 37H68C71 37 74 39 74 42L72 66C72 70 69 73 65 73H31C27 73 24 70 24 66L22 42Z" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
    </svg>
  )
}

// ── 22. Permission-Limited (Shield with Friendly Lock) ───────────────────────
export function PermissionIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Shield */}
      <path
        d="M48 22L68 30V48C68 62 48 72 48 72C48 72 28 62 28 48V30L48 22Z"
        fill="#FFFFFF"
        stroke={BASE_STROKE}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Friendly Lock */}
      <rect x="40" y="46" width="16" height="12" rx="3" fill={SOFT_FILL} stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <path d="M43 46V41C43 38.5 45 36.5 48 36.5C51 36.5 53 38.5 53 41V46" stroke={BRAND_ACCENT} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="48" cy="51" r="1.5" fill={BRAND_ACCENT} />
    </svg>
  )
}

// ── 23. Dependency Missing (Connected Puzzle Blocks) ─────────────────────────
export function DependencyIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill={BRAND_SOFT} />
      {/* Left Block */}
      <rect x="24" y="34" width="22" height="28" rx="5" fill="#FFFFFF" stroke={BASE_STROKE} strokeWidth="1.8" />
      <circle cx="35" cy="48" r="3" fill={LIGHT_STROKE} />
      {/* Right Block */}
      <rect x="52" y="34" width="22" height="28" rx="5" fill="#FFFFFF" stroke={BRAND_ACCENT} strokeWidth="1.8" />
      <circle cx="63" cy="48" r="3" fill={BRAND_ACCENT} />
      {/* Linking Bridge / Arrow */}
      <path d="M42 48H52" stroke={BRAND_SECONDARY} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M48 44L52 48L48 52" stroke={BRAND_SECONDARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── 24. Error State (Gentle Warning Triangle & Refresh Spark) ────────────────
export function ErrorStateIllustration({ size = 96, className = '', ...props }: EmptyIllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true" {...props}>
      <circle cx="48" cy="48" r="42" fill="color-mix(in srgb, #F59E0B 12%, transparent)" />
      {/* Soft Warning Triangle */}
      <path
        d="M48 24L72 66C73 68 72 70 70 70H26C24 70 23 68 24 66L48 24Z"
        fill="#FFFFFF"
        stroke="#F59E0B"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Exclamation */}
      <path d="M48 38V52" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="48" cy="60" r="1.5" fill="#D97706" />
      {/* Refresh Spark */}
      <path d="M72 32C74 34 75 37 75 40" stroke={BRAND_SECONDARY} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export const EMPTY_STATE_ILLUSTRATIONS = {
  enquiries: EnquiriesIllustration,
  followups: FollowupsIllustration,
  applications: ApplicationsIllustration,
  waitinglist: WaitingListIllustration,
  waitlist: WaitingListIllustration,
  classrooms: ClassroomsIllustration,
  classroom: ClassroomsIllustration,
  placements: ClassroomsIllustration,
  students: StudentsIllustration,
  curriculum: CurriculumIllustration,
  attendance: AttendanceIllustration,
  health: HealthIllustration,
  finance: FinanceIllustration,
  payments: PaymentsIllustration,
  invoices: InvoicesIllustration,
  communications: CommunicationsIllustration,
  users: UsersIllustration,
  setup: SetupIllustration,
  branding: BrandingIllustration,
  reports: ReportsIllustration,
  search: SearchIllustration,
  filter: FilterIllustration,
  notifications: NotificationsIllustration,
  documents: DocumentsIllustration,
  permission: PermissionIllustration,
  dependency: DependencyIllustration,
  error: ErrorStateIllustration,
} as const

