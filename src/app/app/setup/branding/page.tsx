'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Palette, Upload, RefreshCw, RotateCcw, Save, CheckCircle2,
  AlertTriangle, Eye, ArrowLeft, Building2, ExternalLink,
  Trash2, Image as ImageIcon, Sparkles, Check, Monitor, Layout, FileText, Users, Lock, ChevronRight
} from 'lucide-react'
import { PageHead, Skeleton, StatusBadge } from '@/components/preone/ui'
import { Modal } from '@/components/preone/Modal'
import { useToast } from '@/components/preone/Toast'
import {
  PREONE_BRANDING_DEFAULTS,
  isValidHexColor,
  evaluateColorContrast,
  type BrandingConfig
} from '@/lib/branding-types'

export default function BrandingPage() {
  const toast = useToast()
  const router = useRouter()

  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [removeLogoModalOpen, setRemoveLogoModalOpen] = useState(false)
  const [activePreviewTab, setActivePreviewTab] = useState<'login' | 'staff' | 'portal' | 'document'>('login')

  // Form Data (Draft / Preview state)
  const [schoolName, setSchoolName] = useState('PreOne Preschool')
  const [schoolCode, setSchoolCode] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#7C3AED')
  const [isPrimaryCustom, setIsPrimaryCustom] = useState(false)
  const [accentColor, setAccentColor] = useState('#3B82F6')
  const [isAccentCustom, setIsAccentCustom] = useState(false)
  const [layout, setLayout] = useState<'WINDOWS_SHELL' | 'CLASSIC_SIDEBAR'>('WINDOWS_SHELL')
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [isBannerCustom, setIsBannerCustom] = useState(false)

  // File Upload Refs
  const logoFileInputRef = useRef<HTMLInputElement | null>(null)
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null)

  // Initial loaded snapshot to check dirty state
  const [initialData, setInitialData] = useState<BrandingConfig | null>(null)

  // 1. Load Canonical Branding Data
  const loadBranding = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/setup/config/BRANDING')
      const json = await res.json()

      if (json.success && json.data) {
        const d = json.data as BrandingConfig
        setSchoolName(d.schoolName || 'PreOne Preschool')
        setSchoolCode(d.schoolCode || '')
        setLogoUrl(d.logoUrl || null)
        setPrimaryColor(d.primaryColor || PREONE_BRANDING_DEFAULTS.primaryColor)
        setIsPrimaryCustom(d.primaryColor !== PREONE_BRANDING_DEFAULTS.primaryColor)
        setAccentColor(d.accentColor || PREONE_BRANDING_DEFAULTS.accentColor)
        setIsAccentCustom(d.accentColor !== PREONE_BRANDING_DEFAULTS.accentColor)
        setLayout(d.layout || 'WINDOWS_SHELL')
        setBannerUrl(d.bannerUrl || null)
        setIsBannerCustom(Boolean(d.bannerUrl))
        setInitialData(d)
      } else {
        // Fallback to defaults
        setPrimaryColor(PREONE_BRANDING_DEFAULTS.primaryColor)
        setAccentColor(PREONE_BRANDING_DEFAULTS.accentColor)
        setLayout('WINDOWS_SHELL')
      }
    } catch (e: any) {
      toast.error('Failed to load branding', e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadBranding()
  }, [loadBranding])

  // 2. Real-time validations
  const isPrimaryValid = useMemo(() => isValidHexColor(primaryColor), [primaryColor])
  const isAccentValid = useMemo(() => isValidHexColor(accentColor), [accentColor])

  const contrastAssessment = useMemo(() => {
    if (!isPrimaryValid || !isAccentValid) return { isWeakContrast: false, warningMessage: null }
    return evaluateColorContrast(primaryColor, accentColor)
  }, [primaryColor, accentColor, isPrimaryValid, isAccentValid])

  // 3. Branding Status Indicator
  const brandingStatus = useMemo(() => {
    const hasLogo = Boolean(logoUrl)
    const hasCustomColor = isPrimaryCustom || isAccentCustom
    const hasCustomLayout = layout === 'CLASSIC_SIDEBAR'

    if (hasLogo && (hasCustomColor || hasCustomLayout)) {
      return {
        label: 'Branding configured',
        cls: 'b-success',
        desc: 'Custom school identity and theme are active across all portals.',
      }
    }
    if (hasLogo || hasCustomColor || hasCustomLayout) {
      return {
        label: 'Branding partially configured',
        cls: 'b-warning',
        desc: 'Some visual identity elements are configured with PreOne defaults.',
      }
    }
    return {
      label: 'Branding not configured',
      cls: 'b-neutral',
      desc: 'Using standard PreOne visual identity and theme defaults.',
    }
  }, [logoUrl, isPrimaryCustom, isAccentCustom, layout])

  // 4. Logo File Upload Handler
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Allowed types: PNG, JPEG, SVG, WebP
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!allowedMime.includes(file.type.toLowerCase())) {
      toast.error('Invalid file format', 'Please upload a PNG, JPG, SVG, or WebP image.')
      return
    }

    // Size check: max 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large', 'School logo must be under 2MB in size.')
      return
    }

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const res = await fetch('/api/v1/setup/branding/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success && json.data?.url) {
        setLogoUrl(json.data.url)
        toast.success('Logo uploaded', 'Logo uploaded successfully. Click "Save Changes" to apply globally.')
      } else {
        toast.error('Upload failed', json.error?.message || 'Failed to upload logo.')
      }
    } catch (err: any) {
      toast.error('Upload error', err.message || 'Network error while uploading logo.')
    } finally {
      setUploadingLogo(false)
      if (logoFileInputRef.current) logoFileInputRef.current.value = ''
    }
  }

  // 5. Banner File Upload Handler
  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedMime.includes(file.type.toLowerCase())) {
      toast.error('Invalid file format', 'Please upload a PNG, JPG, or WebP banner.')
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error('File too large', 'Banner image must be under 4MB in size.')
      return
    }

    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'banner')

      const res = await fetch('/api/v1/setup/branding/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (json.success && json.data?.url) {
        setBannerUrl(json.data.url)
        setIsBannerCustom(true)
        toast.success('Banner uploaded', 'Banner uploaded successfully. Click "Save Changes" to apply globally.')
      } else {
        toast.error('Upload failed', json.error?.message || 'Failed to upload banner.')
      }
    } catch (err: any) {
      toast.error('Upload error', err.message || 'Network error while uploading banner.')
    } finally {
      setUploadingBanner(false)
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
    }
  }

  // 6. Save Changes Action
  const handleSaveChanges = async () => {
    if (!isPrimaryValid) {
      toast.error('Invalid Primary Color', 'Please provide a valid 6-digit HEX color (e.g. #7C3AED).')
      return
    }
    if (!isAccentValid) {
      toast.error('Invalid Accent Color', 'Please provide a valid 6-digit HEX color (e.g. #3B82F6).')
      return
    }

    if (logoUrl && (logoUrl.startsWith('data:') || logoUrl.startsWith('blob:'))) {
      toast.error('Invalid Logo', 'Please upload your logo file again.')
      return
    }

    if (bannerUrl && (bannerUrl.startsWith('data:') || bannerUrl.startsWith('blob:'))) {
      toast.error('Invalid Banner', 'Please upload your banner file again.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        primaryColor: isPrimaryCustom ? primaryColor : PREONE_BRANDING_DEFAULTS.primaryColor,
        accentColor: isAccentCustom ? accentColor : PREONE_BRANDING_DEFAULTS.accentColor,
        layout,
        bannerUrl: isBannerCustom ? bannerUrl : null,
        logoUrl: logoUrl || null,
      }

      const res = await fetch('/api/v1/setup/config/BRANDING', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error?.message || 'Could not save branding configuration.')
      }

      // Mark setup step complete if in setup context
      await fetch('/api/v1/setup/steps/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }).catch(() => {})

      toast.success('Branding updated successfully', 'School visual identity has been saved and applied.')
      setInitialData({
        ...payload,
        schoolName,
        schoolCode,
      })

      // Refresh server-side components across workspace
      router.refresh()
    } catch (e: any) {
      toast.error('Save failed', e.message)
    } finally {
      setSaving(false)
    }
  }

  // 7. Reset Theme Action (Preserves Logo & School Profile)
  const handleExecuteResetTheme = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/v1/setup/config/BRANDING', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_THEME' }),
      })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error?.message || 'Could not reset theme settings.')
      }

      setPrimaryColor(PREONE_BRANDING_DEFAULTS.primaryColor)
      setIsPrimaryCustom(false)
      setAccentColor(PREONE_BRANDING_DEFAULTS.accentColor)
      setIsAccentCustom(false)
      setLayout('WINDOWS_SHELL')
      setBannerUrl(null)
      setIsBannerCustom(false)

      setResetModalOpen(false)
      toast.success('Theme reset to defaults', 'Colors, layout, and banner were reset. School logo is preserved.')
      router.refresh()
    } catch (e: any) {
      toast.error('Reset failed', e.message)
    } finally {
      setResetting(false)
    }
  }

  // 8. Explicit Remove Logo Action
  const handleExecuteRemoveLogo = async () => {
    setLogoUrl(null)
    setRemoveLogoModalOpen(false)
    toast.info('Logo removed from preview', 'Click "Save Changes" to confirm logo removal.')
  }

  if (loading) {
    return (
      <div className="page-shell" style={{ padding: 24 }}>
        <Skeleton w="100%" h={60} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 20 }}>
          <Skeleton w="100%" h={400} />
          <Skeleton w="100%" h={400} />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Breadcrumb & Top Bar ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <a href="/app/setup" className="cell-link" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} /> Setup Dashboard
          </a>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Branding & Theme</span>
        </div>
      </div>

      <PageHead
        eyebrow="SCHOOL SETUP"
        title="School Brand Identity Center"
        sub="Make PreOne look and feel like your preschool across authentication, staff workspace, parent portal, and documents."
        icon={<Palette size={24} />}
      />

      {/* ── Branding Status Card (Section 37) ── */}
      <div className="card" style={{ padding: 18, marginBottom: 24, background: 'var(--bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`badge ${brandingStatus.cls}`} style={{ fontSize: 12, padding: '4px 10px', fontWeight: 700 }}>
              {brandingStatus.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {brandingStatus.desc}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {logoUrl ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ opacity: 0.4 }}>○</span>} School Logo
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isPrimaryCustom ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ opacity: 0.4 }}>○</span>} Primary Color
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isAccentCustom ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ opacity: 0.4 }}>○</span>} Accent Color
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={14} style={{ color: 'var(--success)' }} /> {layout === 'CLASSIC_SIDEBAR' ? 'Classic Sidebar' : 'Windows Shell'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Grid (Desktop 2-Col / Mobile Stacked) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, alignItems: 'start' }}>

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT COLUMN: CONFIGURATION CONTROLS
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── 1. Brand Identity ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                1. School Identity & Logo
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Canonical school name and logo used on login, official receipts, certificates, and reports.
              </p>
            </div>

            {/* School Name (Read-only from School Profile) */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                School Legal Name (from School Profile)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={schoolName}
                  readOnly
                  style={{ background: 'var(--bg-subtle)', cursor: 'not-allowed', fontWeight: 600 }}
                />
                <a
                  href="/app/setup/school_profile"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                  title="Edit School Profile in Foundation setup"
                >
                  Edit Profile <ExternalLink size={12} style={{ marginLeft: 4 }} />
                </a>
              </div>
              {schoolCode && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Short Identifier / Code: <strong>{schoolCode}</strong>
                </div>
              )}
            </div>

            {/* School Logo */}
            <div className="field">
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                School Logo
              </label>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Logo Preview Box */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 12,
                    border: '2px dashed var(--border-default)',
                    background: 'var(--bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="School Logo Preview"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>

                {/* Upload / Replace / Remove Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleLogoFileUpload}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    style={{ display: 'none' }}
                  />

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm font-semibold"
                      disabled={uploadingLogo}
                      onClick={() => logoFileInputRef.current?.click()}
                    >
                      <Upload size={13} style={{ marginRight: 6 }} />
                      {uploadingLogo ? 'Uploading Logo...' : (logoUrl ? 'Replace Logo' : 'Upload Logo')}
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm text-danger font-semibold"
                        onClick={() => setRemoveLogoModalOpen(true)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} style={{ marginRight: 4 }} /> Remove
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Supported: Transparent PNG, JPG, or SVG (Max 2MB).
                  </div>
                </div>
              </div>

              {/* Direct URL Fallback */}
              <div style={{ marginTop: 12 }}>
                <input
                  className="input text-xs"
                  placeholder="Or enter direct image URL (https://.../logo.png)"
                  value={logoUrl || ''}
                  onChange={(e) => setLogoUrl(e.target.value.trim() || null)}
                />
              </div>
            </div>
          </div>

          {/* ── 2. Brand Colors ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                2. Brand Colors
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Primary color applies to navigation and major buttons; accent color applies to highlights and badges.
              </p>
            </div>

            {/* Contrast Warning Banner if present */}
            {contrastAssessment.isWeakContrast && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: 12,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                }}
              >
                <AlertTriangle size={16} style={{ color: '#d97706', shrink: 0 }} />
                <span>{contrastAssessment.warningMessage}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {/* Primary Color Control */}
              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Primary Color
                </label>

                {/* PreOne Default vs Custom Toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${!isPrimaryCustom ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                    onClick={() => {
                      setIsPrimaryCustom(false)
                      setPrimaryColor(PREONE_BRANDING_DEFAULTS.primaryColor)
                    }}
                  >
                    {!isPrimaryCustom && '✓ '}PreOne Default
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${isPrimaryCustom ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                    onClick={() => setIsPrimaryCustom(true)}
                  >
                    {isPrimaryCustom && '✓ '}Custom Color
                  </button>
                </div>

                {/* Picker & HEX Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={isPrimaryValid ? primaryColor : PREONE_BRANDING_DEFAULTS.primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value.toUpperCase())
                      setIsPrimaryCustom(true)
                    }}
                    style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    className="input text-xs font-mono"
                    value={primaryColor}
                    maxLength={7}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value.trim().toUpperCase())
                      setIsPrimaryCustom(true)
                    }}
                    placeholder="#7C3AED"
                  />
                </div>
                {!isPrimaryValid && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    Invalid HEX (e.g. #7C3AED)
                  </div>
                )}
              </div>

              {/* Accent Color Control */}
              <div className="field">
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Accent Color
                </label>

                {/* PreOne Default vs Custom Toggle */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${!isAccentCustom ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                    onClick={() => {
                      setIsAccentCustom(false)
                      setAccentColor(PREONE_BRANDING_DEFAULTS.accentColor)
                    }}
                  >
                    {!isAccentCustom && '✓ '}PreOne Default
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${isAccentCustom ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                    onClick={() => setIsAccentCustom(true)}
                  >
                    {isAccentCustom && '✓ '}Custom Color
                  </button>
                </div>

                {/* Picker & HEX Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={isAccentValid ? accentColor : PREONE_BRANDING_DEFAULTS.accentColor}
                    onChange={(e) => {
                      setAccentColor(e.target.value.toUpperCase())
                      setIsAccentCustom(true)
                    }}
                    style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    className="input text-xs font-mono"
                    value={accentColor}
                    maxLength={7}
                    onChange={(e) => {
                      setAccentColor(e.target.value.trim().toUpperCase())
                      setIsAccentCustom(true)
                    }}
                    placeholder="#3B82F6"
                  />
                </div>
                {!isAccentValid && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    Invalid HEX (e.g. #3B82F6)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. Workspace Layout ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                3. Workspace Layout
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Select how staff navigate the PreOne Operating System.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {/* Windows Shell Card */}
              <div
                onClick={() => setLayout('WINDOWS_SHELL')}
                style={{
                  border: `2px solid ${layout === 'WINDOWS_SHELL' ? primaryColor : 'var(--border-default)'}`,
                  background: layout === 'WINDOWS_SHELL' ? 'var(--surface-hover)' : 'var(--card)',
                  borderRadius: 12,
                  padding: 14,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 750, fontSize: 13.5 }}>
                    <Monitor size={16} style={{ color: primaryColor }} />
                    Windows Shell
                  </div>
                  <span className="badge b-purple" style={{ fontSize: 10 }}>PreOne Default</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Multi-window preschool OS interface with taskbar, start menu, and floating operations windows.
                </p>
              </div>

              {/* Classic Sidebar Card */}
              <div
                onClick={() => setLayout('CLASSIC_SIDEBAR')}
                style={{
                  border: `2px solid ${layout === 'CLASSIC_SIDEBAR' ? primaryColor : 'var(--border-default)'}`,
                  background: layout === 'CLASSIC_SIDEBAR' ? 'var(--surface-hover)' : 'var(--card)',
                  borderRadius: 12,
                  padding: 14,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 750, fontSize: 13.5 }}>
                    <Layout size={16} style={{ color: primaryColor }} />
                    Classic Sidebar
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Traditional vertical navigation sidebar suited for standard dashboard navigation.
                </p>
              </div>
            </div>
          </div>

          {/* ── 4. Banner / Visual (Optional) ── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)', margin: 0 }}>
                4. School Banner (Optional)
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Used in parent portal hero headers and communication templates.
              </p>
            </div>

            {/* Banner Toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button
                type="button"
                className={`btn btn-sm ${!isBannerCustom ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => {
                  setIsBannerCustom(false)
                  setBannerUrl(null)
                }}
              >
                {!isBannerCustom && '✓ '}None / PreOne Default
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isBannerCustom ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => setIsBannerCustom(true)}
              >
                {isBannerCustom && '✓ '}Custom Banner
              </button>
            </div>

            {isBannerCustom && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="file"
                  ref={bannerFileInputRef}
                  onChange={handleBannerFileUpload}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  style={{ display: 'none' }}
                />

                {bannerUrl && (
                  <div
                    style={{
                      height: 100,
                      borderRadius: 10,
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <img
                      src={bannerUrl}
                      alt="Banner Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm font-semibold"
                    disabled={uploadingBanner}
                    onClick={() => bannerFileInputRef.current?.click()}
                  >
                    <Upload size={13} style={{ marginRight: 6 }} />
                    {uploadingBanner ? 'Uploading Banner...' : (bannerUrl ? 'Replace Banner' : 'Upload Banner Image')}
                  </button>

                  {bannerUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger font-semibold"
                      onClick={() => setBannerUrl(null)}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} style={{ marginRight: 4 }} /> Remove Banner
                    </button>
                  )}
                </div>

                <input
                  className="input text-xs"
                  placeholder="Or enter direct banner URL (https://.../banner.png)"
                  value={bannerUrl || ''}
                  onChange={(e) => setBannerUrl(e.target.value.trim() || null)}
                />
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT COLUMN: LIVE PREVIEW SYSTEM (Sections 13-18)
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={16} /> Live Preview
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Real-time preview of your brand applied across PreOne.
                </p>
              </div>

              {/* Preview Tabs: Login, Staff, Portal, Document */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-subtle)', padding: 3, borderRadius: 8 }}>
                {(['login', 'staff', 'portal', 'document'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActivePreviewTab(t)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11.5,
                      fontWeight: activePreviewTab === t ? 700 : 500,
                      borderRadius: 6,
                      background: activePreviewTab === t ? 'var(--card)' : 'transparent',
                      color: activePreviewTab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: activePreviewTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t === 'portal' ? 'Parent Portal' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* ── PREVIEW CANVAS CONTAINER ── */}
            <div
              style={{
                minHeight: 380,
                background: 'var(--surface-canvas)',
                borderRadius: 'var(--surface-radius)',
                border: '1px solid var(--surface-border)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                ['--primary' as any]: primaryColor,
                ['--accent' as any]: accentColor,
              }}
            >
              {/* TAB 1: LOGIN PREVIEW */}
              {activePreviewTab === 'login' && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--surface-radius)',
                    padding: 24,
                    boxShadow: 'var(--elevation-2)',
                    border: '1px solid var(--surface-border)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: 56, height: 56, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: 56, maxWidth: 56, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                        {schoolName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 2px', color: '#111827' }}>
                    {schoolName}
                  </h4>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
                    Welcome back · Sign in to PreOne
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Staff Email</div>
                      <div style={{ height: 32, background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#4b5563', marginBottom: 4 }}>Password</div>
                      <div style={{ height: 32, background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 6 }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: primaryColor,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'default',
                    }}
                  >
                    Sign In
                  </button>

                  <div style={{ marginTop: 12, fontSize: 11, color: accentColor, fontWeight: 600 }}>
                    Forgot password?
                  </div>
                </div>
              )}

              {/* TAB 2: STAFF PREVIEW */}
              {activePreviewTab === 'staff' && (
                <div
                  style={{
                    width: '100%',
                    height: 320,
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--surface-radius)',
                    border: '1px solid var(--surface-border)',
                    boxShadow: 'var(--elevation-1)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Top Bar / Header */}
                  <div style={{ height: 42, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ height: 24, width: 24, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: primaryColor }} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{schoolName}</span>
                    </div>

                    <span style={{ background: `${accentColor}1A`, color: accentColor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      Academic Year 2026-27
                    </span>
                  </div>

                  {/* Body Layout (Windows Shell vs Classic Sidebar) */}
                  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {layout === 'CLASSIC_SIDEBAR' && (
                      <div style={{ width: 80, background: '#111827', color: '#fff', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10 }}>
                        <div style={{ background: primaryColor, padding: '4px 6px', borderRadius: 4, fontWeight: 700 }}>Students</div>
                        <div style={{ padding: '4px 6px', opacity: 0.7 }}>Admissions</div>
                        <div style={{ padding: '4px 6px', opacity: 0.7 }}>Attendance</div>
                        <div style={{ padding: '4px 6px', opacity: 0.7 }}>Finance</div>
                      </div>
                    )}

                    <div style={{ flex: 1, padding: 12, background: '#f3f4f6', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Students Directory</span>
                        <button
                          type="button"
                          style={{ background: primaryColor, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}
                        >
                          + Add Student
                        </button>
                      </div>

                      {/* Mock Table */}
                      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb', flex: 1, padding: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 4, fontSize: 10, color: '#6b7280' }}>
                          <span>Admission No</span>
                          <span>Child Name</span>
                          <span>Status</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: primaryColor }}>STU-2026-0001</span>
                          <span>Aarav Kulkarni</span>
                          <span style={{ background: `${accentColor}20`, color: accentColor, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Windows Shell Taskbar */}
                  {layout === 'WINDOWS_SHELL' && (
                    <div style={{ height: 32, background: '#1f2937', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
                      <button type="button" style={{ background: primaryColor, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
                        Start
                      </button>
                      <div style={{ background: '#374151', height: 22, padding: '0 8px', borderRadius: 4, color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center' }}>
                        Students 360
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PARENT PORTAL PREVIEW */}
              {activePreviewTab === 'portal' && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--surface-radius)',
                    border: '1px solid var(--surface-border)',
                    overflow: 'hidden',
                    boxShadow: 'var(--elevation-2)',
                  }}
                >
                  {/* Hero / Banner Header */}
                  <div
                    style={{
                      height: 80,
                      background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                      padding: 12,
                      display: 'flex',
                      alignItems: 'flex-end',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -20,
                        left: 14,
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: '#ffffff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ maxHeight: 36, maxWidth: 36, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                          {schoolName.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '28px 14px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{schoolName}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Parent Portal · Welcome Vikram Deshmukh</div>

                    <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Aarav (Nursery)</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>Present · Arrived 08:45 AM</div>
                        </div>
                        <span style={{ background: `${accentColor}1A`, color: accentColor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                          Timeline Live
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{
                        width: '100%',
                        marginTop: 12,
                        padding: '8px',
                        background: primaryColor,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Pay Term Fees Online
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: DOCUMENT PREVIEW */}
              {activePreviewTab === 'document' && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 340,
                    background: 'var(--surface-card)',
                    borderRadius: 'var(--surface-radius)',
                    border: '1px solid var(--surface-border)',
                    padding: 18,
                    boxShadow: 'var(--elevation-1)',
                  }}
                >
                  {/* Document Header with School Branding */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${primaryColor}`, paddingBottom: 10, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={{ maxHeight: 38, maxWidth: 38, objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 6, background: primaryColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                          {schoolName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{schoolName}</div>
                        <div style={{ fontSize: 9.5, color: '#6b7280' }}>Official Financial Receipt</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: accentColor }}>
                      REC-2026-0042
                    </span>
                  </div>

                  {/* Document Line Items */}
                  <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, color: '#374151' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Student: <strong>Aarav Kulkarni</strong></span>
                      <span>Class: <strong>Nursery A</strong></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                      <span>Annual Tuition Fee</span>
                      <span>₹45,000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e5e7eb', paddingTop: 6, fontWeight: 800, color: primaryColor }}>
                      <span>Total Paid</span>
                      <span>₹45,000</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed Footer Action Bar (Sections 23-26) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--card)',
          borderTop: '1px solid var(--border-default)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <button
          type="button"
          className="btn btn-outline btn-sm font-semibold"
          onClick={() => setResetModalOpen(true)}
          disabled={saving || resetting}
        >
          <RotateCcw size={14} style={{ marginRight: 6 }} /> Reset Theme
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary font-bold"
            onClick={handleSaveChanges}
            disabled={saving || resetting || !isPrimaryValid || !isAccentValid}
            style={{ padding: '8px 22px', fontSize: 13.5 }}
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="spin" style={{ marginRight: 8 }} />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={14} style={{ marginRight: 8 }} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── MODAL: Reset Theme Confirmation (Section 24) ── */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset theme settings to PreOne defaults?"
        subtitle="This will restore PreOne standard colors, layout, and banner."
        icon={<RotateCcw size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            This will reset <strong>Primary Color</strong>, <strong>Accent Color</strong>, <strong>Workspace Layout</strong>, and remove any custom banner.
          </p>

          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
              padding: 10,
              fontSize: 12.5,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} style={{ color: 'var(--success)', shrink: 0 }} />
            <span><strong>Your school logo and legal profile will NOT be removed.</strong></span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setResetModalOpen(false)}
              disabled={resetting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm font-bold bg-danger"
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={handleExecuteResetTheme}
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Yes, Reset Theme'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Remove Logo Confirmation (Section 7) ── */}
      <Modal
        open={removeLogoModalOpen}
        onClose={() => setRemoveLogoModalOpen(false)}
        title="Remove school logo?"
        subtitle="This will remove the logo from official receipts, reports, and portals."
        icon={<Trash2 size={20} />}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Are you sure you want to remove your school logo? PreOne will display the school initials placeholder instead.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRemoveLogoModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm font-bold"
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={handleExecuteRemoveLogo}
            >
              Remove Logo
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
