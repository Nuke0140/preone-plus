'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon, Globe } from 'lucide-react'
import { AuthBackground } from './AuthBackground'
import { AuthPageFooter } from './AuthPageFooter'

export interface AuthShellProps {
  children: React.ReactNode
}

/**
 * Global outer authentication layout.
 * Manages full viewport, ambient background, theme state, top utility bar, and footer.
 * Keeps the top bar clean so AuthBrand inside AuthCard remains the primary brand anchor.
 */
export function AuthShell({ children }: AuthShellProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    setTheme(currentTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    try {
      localStorage.setItem('preone_theme', nextTheme)
    } catch {}
  }

  return (
    <div className="auth-shell min-h-screen w-full relative flex flex-col justify-between items-center bg-gradient-to-b from-[#FAF8FF] via-[#F3F5FB] to-[#EBF0F9] dark:from-[#080C14] dark:via-[#0E1422] dark:to-[#080C14] text-slate-800 dark:text-slate-100 overflow-x-hidden selection:bg-purple-500 selection:text-white transition-colors duration-300">
      
      {/* Layer 1-4: Subtle Preschool Ambient Visual Background */}
      <AuthBackground />

      {/* Top Utility Controls Bar (Quiet, does not compete with central AuthBrand) */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between pt-6 px-4 pb-2">
        <div className="flex items-center gap-2" />

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Health Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden xs:inline">Cloud Active</span>
          </div>

          {/* Language Selector */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>EN</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 border border-slate-200/80 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </header>

      {/* Main Centered Authentication Content Area */}
      {children}

      {/* Subtle Page Footer */}
      <AuthPageFooter />
    </div>
  )
}
