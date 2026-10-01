import React from 'react'

export type TypographyRole =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'label'
  | 'btn'
  | 'kpi'
  | 'data'

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  role?: TypographyRole
  className?: string
  children?: React.ReactNode
}

const DEFAULT_TAG_MAP: Record<TypographyRole, React.ElementType> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  'body-lg': 'p',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  label: 'span',
  btn: 'span',
  kpi: 'div',
  data: 'span',
}

/**
 * Canonical 12-Role Typography Component (Design System v4.1 Section 5.2)
 */
export function Typography({
  as,
  role = 'body',
  className = '',
  children,
  ...props
}: TypographyProps) {
  const Component = as || DEFAULT_TAG_MAP[role] || 'span'
  const roleClass = `t-${role}`
  const combinedClass = [roleClass, className].filter(Boolean).join(' ')

  return (
    <Component className={combinedClass} {...props}>
      {children}
    </Component>
  )
}

export function Display({ as = 'h1', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="display" as={as} className={className} {...props}>{children}</Typography>
}

export function H1({ as = 'h1', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="h1" as={as} className={className} {...props}>{children}</Typography>
}

export function H2({ as = 'h2', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="h2" as={as} className={className} {...props}>{children}</Typography>
}

export function H3({ as = 'h3', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="h3" as={as} className={className} {...props}>{children}</Typography>
}

export function H4({ as = 'h4', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="h4" as={as} className={className} {...props}>{children}</Typography>
}

export function BodyLg({ as = 'p', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="body-lg" as={as} className={className} {...props}>{children}</Typography>
}

export function Body({ as = 'p', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="body" as={as} className={className} {...props}>{children}</Typography>
}

export function BodySm({ as = 'p', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="body-sm" as={as} className={className} {...props}>{children}</Typography>
}

export function Caption({ as = 'span', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="caption" as={as} className={className} {...props}>{children}</Typography>
}

export function LabelText({ as = 'span', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="label" as={as} className={className} {...props}>{children}</Typography>
}

export function BtnText({ as = 'span', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="btn" as={as} className={className} {...props}>{children}</Typography>
}

export function KPI({ as = 'div', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="kpi" as={as} className={className} {...props}>{children}</Typography>
}

export function DataText({ as = 'span', className = '', children, ...props }: Omit<TypographyProps, 'role'>) {
  return <Typography role="data" as={as} className={className} {...props}>{children}</Typography>
}
