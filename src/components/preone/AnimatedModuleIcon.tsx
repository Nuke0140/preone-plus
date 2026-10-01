'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { SemanticThemeTokens } from '@/lib/modules'
import type { AnimationItem } from 'lottie-web'

export interface AnimatedModuleIconProps {
  moduleKey: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  animation?: string
  theme: SemanticThemeTokens
  triggerAnimation?: boolean
  onAnimationEnd?: () => void
}

/** Global memory cache for fetched animation JSON payloads to guarantee 0 duplicate network requests */
const lottieJsonCache = new Map<string, any>()

export function AnimatedModuleIcon({
  moduleKey,
  label,
  icon: FallbackIcon,
  animation,
  theme,
  triggerAnimation = false,
  onAnimationEnd,
}: AnimatedModuleIconProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const isPlayingRef = useRef(false)
  const [staticArtwork, setStaticArtwork] = useState<string | null>(() => {
    if (animation && lottieJsonCache.has(animation)) {
      const cached = lottieJsonCache.get(animation)
      return cached?.assets?.[0]?.p || null
    }
    return null
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [imgError, setImgError] = useState(false)

  // 1. Initialize and lazy-load Lottie animation
  useEffect(() => {
    if (!animation) return

    let isCancelled = false

    async function initLottie() {
      try {
        // Dynamically load lottie-web to keep initial bundle lightweight
        const lottieModule = await import('lottie-web')
        const lottie = lottieModule.default || lottieModule

        if (isCancelled || !containerRef.current) return

        // Check in-memory cache first to eliminate redundant network requests
        let animationData = lottieJsonCache.get(animation!)
        if (!animationData) {
          const res = await fetch(animation!, { cache: 'no-cache' })
          if (!res.ok) throw new Error(`HTTP ${res.status} loading ${animation}`)
          animationData = await res.json()
          lottieJsonCache.set(animation!, animationData)
        }

        if (isCancelled || !containerRef.current) return

        // Extract self-contained embedded artwork data URI for instant crisp raster display
        const embeddedAsset = animationData?.assets?.[0]?.p
        if (embeddedAsset && typeof embeddedAsset === 'string' && embeddedAsset.startsWith('data:image/')) {
          setStaticArtwork(embeddedAsset)
        }

        // Destroy any previous instance
        if (animRef.current) {
          animRef.current.destroy()
        }

        // Initialize animation paused at first frame
        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
            progressiveLoad: false,
            hideOnTransparent: true,
          },
        })

        const syncSvgImageHrefs = () => {
          if (containerRef.current) {
            const images = containerRef.current.querySelectorAll('image')
            images.forEach((img) => {
              const xlink =
                img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
                img.getAttribute('xlink:href')
              if (xlink && !img.getAttribute('href')) {
                img.setAttribute('href', xlink)
              }
            })
          }
        }

        const markReady = () => {
          if (!isCancelled) {
            syncSvgImageHrefs()
            anim.goToAndStop(0, true)
            syncSvgImageHrefs()
            setIsLoaded(true)
          }
        }

        anim.addEventListener('DOMLoaded', markReady)
        anim.addEventListener('data_ready', markReady)
        anim.addEventListener('loaded_images', markReady)
        anim.addEventListener('error', (e) => {
          console.warn(`[AnimatedModuleIcon] Lottie error for ${moduleKey}:`, e)
          if (!isCancelled) setHasError(true)
        })

        anim.addEventListener('complete', () => {
          isPlayingRef.current = false
          anim.goToAndStop(0, true)
          onAnimationEnd?.()
        })

        animRef.current = anim
      } catch (err) {
        console.warn(`[AnimatedModuleIcon] Failed to load animation for ${moduleKey}:`, err)
        if (!isCancelled) {
          setHasError(true)
        }
      }
    }

    initLottie()

    return () => {
      isCancelled = true
      if (animRef.current) {
        animRef.current.destroy()
        animRef.current = null
      }
    }
  }, [animation, moduleKey, onAnimationEnd])

  // 2. Respond to interaction triggers (hover, keyboard focus, tap)
  useEffect(() => {
    if (!triggerAnimation || !animRef.current || !isLoaded || isPlayingRef.current) {
      return
    }

    // Respect reduced motion: stay at static first frame
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      onAnimationEnd?.()
      return
    }

    isPlayingRef.current = true
    animRef.current.goToAndPlay(0, true)
  }, [triggerAnimation, isLoaded, onAnimationEnd])

  const isAnimated = Boolean(animation)
  const showLottie = Boolean(animation) && isLoaded && !hasError

  return (
    <span
      className={`module-card-icon ${isAnimated ? 'has-lottie' : 'is-fallback'}`}
      style={{
        background: isAnimated ? 'transparent' : theme.iconBg,
        color: theme.iconColor,
        border: isAnimated ? 'none' : `1px solid ${theme.iconBorder}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 1. Self-contained 3D Raster Artwork (Visible only before Lottie loads, or as fallback) */}
      {!showLottie && staticArtwork && !imgError && (
        <img
          src={staticArtwork}
          alt={label}
          draggable={false}
          onError={() => setImgError(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: 'scale(1.28)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 2. Generic Vector Fallback (Only if neither Lottie nor 3D artwork is present, or if image failed) */}
      {(!staticArtwork || imgError || hasError) && !showLottie && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            opacity: 1,
            transition: 'opacity 0.2s ease',
            position: 'relative',
            inset: 0,
          }}
        >
          <FallbackIcon size={30} strokeWidth={2.2} />
        </span>
      )}

      {/* 3. Lottie Animation Canvas (Plays smooth interactive motion over container) */}
      {animation && !hasError && (
        <span
          ref={containerRef}
          className="module-card-lottie"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: showLottie ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  )
}
