import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  leadingIcon?: React.ReactNode
  trailingAction?: React.ReactNode
  hasError?: boolean
  inputSize?: "default" | "sm" | "lg" | "xl" | "auth"
}

export interface InputWrapperProps {
  children: React.ReactNode
  className?: string
}

export function InputWrapper({ children, className }: InputWrapperProps) {
  return (
    <div className={cn("relative group w-full", className)}>
      {children}
    </div>
  )
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      leadingIcon,
      trailingAction,
      hasError = false,
      inputSize = "default",
      ...props
    },
    ref
  ) => {
    const isAuthOrXl = inputSize === "auth" || inputSize === "xl"

    const baseInput = (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "w-full transition-all font-sans outline-none appearance-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          // Sizing & Radius
          isAuthOrXl
            ? "h-12 text-sm rounded-xl"
            : inputSize === "sm"
            ? "h-8 text-xs rounded-md px-2.5 py-1"
            : inputSize === "lg"
            ? "h-10 text-sm rounded-lg px-3.5 py-1.5"
            : "h-9 text-sm rounded-md px-3 py-1",
          // Paddings for Icons
          isAuthOrXl
            ? cn(leadingIcon ? "pl-11" : "pl-4", trailingAction ? "pr-11" : "pr-4")
            : cn(leadingIcon ? "pl-9" : "", trailingAction ? "pr-9" : ""),
          // Surface Colors & Borders
          isAuthOrXl
            ? cn(
                "auth-input bg-slate-50/80 dark:bg-slate-950/60 border text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium shadow-2xs",
                hasError
                  ? "border-rose-300 dark:border-rose-800 focus:ring-2 focus:ring-rose-500/20"
                  : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 dark:focus:border-purple-500"
              )
            : cn(
                "border border-input bg-transparent dark:bg-input/30 placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground shadow-2xs",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                hasError
                  ? "border-destructive ring-destructive/20"
                  : "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
              ),
          className
        )}
        {...props}
      />
    )

    if (leadingIcon || trailingAction) {
      return (
        <div className="relative group w-full">
          {leadingIcon && (
            <div
              className={cn(
                "absolute inset-y-0 left-0 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors",
                isAuthOrXl ? "pl-3.5" : "pl-3"
              )}
            >
              {leadingIcon}
            </div>
          )}
          {baseInput}
          {trailingAction && (
            <div
              className={cn(
                "absolute inset-y-0 right-0 flex items-center",
                isAuthOrXl ? "pr-3" : "pr-2.5"
              )}
            >
              {trailingAction}
            </div>
          )}
        </div>
      )
    }

    return baseInput
  }
)

Input.displayName = "Input"

export { Input }
