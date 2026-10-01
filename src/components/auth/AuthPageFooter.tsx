import React from 'react'

export function AuthPageFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative z-10 w-full max-w-md mx-auto text-center pt-4 pb-6 px-4 text-[11px] text-slate-400 dark:text-slate-500 select-none">
      <p>© {currentYear} PreOne Technologies. All rights reserved.</p>
    </footer>
  )
}
