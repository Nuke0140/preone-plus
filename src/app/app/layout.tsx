import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { AppShell } from '@/components/shell/AppShell'
import { ToastProvider } from '@/components/preone/Toast'
import { getEffectiveBranding } from '@/lib/branding-service'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role === 'PLATFORM_ADMIN') redirect('/onboard')

  let tenantName = 'PreOne'
  let branchName: string | null = null
  let branding = undefined

  if (session.tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } })
    if (!tenant) {
      const cookieStore = await cookies()
      cookieStore.delete('preone_session')
      redirect('/')
    }
    branding = await getEffectiveBranding(session.tenantId)
    tenantName = branding?.schoolName || tenant.name || 'PreOne'

    if (session.branchId) {
      const branch = await db.branch.findUnique({ where: { id: session.branchId } })
      branchName = branch?.name ?? null
    }
  }

  const primary = branding?.primaryColor || '#7C3AED'
  const accent = branding?.accentColor || '#3B82F6'

  const dynamicThemeCss = `
    :root {
      --preone-primary: ${primary};
      --preone-primary-hover: color-mix(in srgb, ${primary} 85%, black);
      --preone-primary-active: color-mix(in srgb, ${primary} 70%, black);
      --preone-primary-soft: color-mix(in srgb, ${primary} 10%, white);
      --preone-primary-muted: color-mix(in srgb, ${primary} 40%, white);
      --primary: ${primary};
      --primary-hover: color-mix(in srgb, ${primary} 85%, black);
      --primary-active: color-mix(in srgb, ${primary} 70%, black);
      --primary-light: color-mix(in srgb, ${primary} 10%, white);
      --accent: ${accent};
      --accent-light: color-mix(in srgb, ${accent} 12%, white);
      --po-primary: ${primary};
      --po-primary-dark: color-mix(in srgb, ${primary} 85%, black);
      --po-primary-soft: color-mix(in srgb, ${primary} 12%, white);
      --po-primary-ultra-soft: color-mix(in srgb, ${primary} 5%, white);
      --card-hover-border: ${primary};
      --brand-ambient-wash: radial-gradient(ellipse at top left, color-mix(in srgb, ${primary} 8%, transparent), transparent 70%);
    }
    [data-theme="dark"],
    .dark {
      --primary-dark: color-mix(in srgb, ${primary} 85%, #FFFFFF 15%);
      --primary-hover-dark: color-mix(in srgb, ${primary} 75%, #FFFFFF 25%);
      --preone-primary: var(--primary-dark);
      --preone-primary-hover: var(--primary-hover-dark);
      --preone-primary-soft: color-mix(in srgb, ${primary} 20%, transparent);
      --preone-primary-muted: color-mix(in srgb, ${primary} 26%, #151D2E);
      --primary: var(--primary-dark);
      --primary-hover: var(--primary-hover-dark);
      --primary-light: color-mix(in srgb, ${primary} 20%, transparent);
      --accent: color-mix(in srgb, ${accent} 85%, #FFFFFF 15%);
      --accent-light: color-mix(in srgb, ${accent} 20%, transparent);
      --card-hover-border: var(--primary-dark);
      --brand-ambient-wash: radial-gradient(circle at top right, color-mix(in srgb, ${primary} 6%, transparent), transparent 38%);
    }
  `

  return (
    <ToastProvider>
      <style dangerouslySetInnerHTML={{ __html: dynamicThemeCss }} />
      <AppShell
        user={{
          name: session.name,
          email: session.email,
          role: session.role,
          tenantName,
          branchName,
        }}
        branding={branding}
      >
        {children}
      </AppShell>
    </ToastProvider>
  )
}
