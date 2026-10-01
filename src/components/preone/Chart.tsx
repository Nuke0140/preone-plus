'use client'

import React, { useState } from 'react'

export interface ChartDataPoint {
  label: string
  value: number
  secondaryValue?: number
  color?: string
}

export interface LineChartProps {
  data: ChartDataPoint[]
  height?: number
  ariaLabel?: string
  color?: string
  secondaryColor?: string
  showGrid?: boolean
  showPoints?: boolean
  fillGradient?: boolean
  className?: string
}

export function LineChart({
  data,
  height = 200,
  ariaLabel = 'Data trend line chart',
  color = 'var(--primary, #7C3AED)',
  secondaryColor = 'var(--info, #3B82F6)',
  showGrid = true,
  showPoints = true,
  fillGradient = true,
  className = '',
}: LineChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No chart data available
      </div>
    )
  }

  const width = 500
  const padTop = 20
  const padBottom = 30
  const padLeft = 40
  const padRight = 20

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const allVals = data.flatMap((d) => [d.value, d.secondaryValue].filter((v): v is number => v !== undefined))
  const maxVal = Math.max(...allVals, 1)
  const minVal = Math.min(...allVals, 0)
  const range = maxVal - minVal || 1

  const getX = (i: number) => padLeft + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const getY = (v: number) => padTop + chartH - ((v - minVal) / range) * chartH

  const pointsPrimary = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ')
  const areaPath = `M ${getX(0)},${getY(data[0].value)} ` +
    data.map((d, i) => `L ${getX(i)},${getY(d.value)}`).join(' ') +
    ` L ${getX(data.length - 1)},${padTop + chartH} L ${getX(0)},${padTop + chartH} Z`

  const hasSecondary = data.some((d) => d.secondaryValue !== undefined)
  const pointsSecondary = hasSecondary
    ? data.map((d, i) => `${getX(i)},${getY(d.secondaryValue ?? 0)}`).join(' ')
    : ''

  const gradId = `grad-line-${Math.random().toString(36).slice(2, 7)}`

  return (
    <div className={`chart-wrap ${className}`} style={{ width: '100%', position: 'relative' }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          {fillGradient && (
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.00" />
            </linearGradient>
          )}
        </defs>

        {/* Horizontal Grid lines */}
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padTop + chartH * (1 - pct)
          const valLabel = Math.round(minVal + range * pct)
          return (
            <g key={pct}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--border-subtle, #E2E8F0)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--text-muted, #64748B)"
              >
                {valLabel}
              </text>
            </g>
          )
        })}

        {/* Gradient Fill under primary line */}
        {fillGradient && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Secondary Series */}
        {hasSecondary && (
          <polyline
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2"
            strokeDasharray="4 4"
            points={pointsSecondary}
          />
        )}

        {/* Primary Series */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsPrimary}
        />

        {/* Interactive Points */}
        {data.map((d, i) => {
          const cx = getX(i)
          const cy = getY(d.value)
          const isAct = activeIdx === i
          return (
            <g
              key={i}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {showPoints && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={isAct ? 6 : 3.5}
                  fill={isAct ? '#FFFFFF' : color}
                  stroke={color}
                  strokeWidth={isAct ? 3 : 2}
                  style={{ transition: 'all 0.15s ease' }}
                />
              )}
              {/* Bottom label */}
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="var(--font-sans)"
                fontWeight={isAct ? '700' : '500'}
                fill={isAct ? 'var(--text-primary)' : 'var(--text-muted)'}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Active Point Floating Tooltip */}
      {activeIdx !== null && data[activeIdx] && (
        <div
          style={{
            position: 'absolute',
            left: `${(getX(activeIdx) / width) * 100}%`,
            top: `${(getY(data[activeIdx].value) / height) * 100}%`,
            transform: 'translate(-50%, -125%)',
            background: 'var(--surface-elevated, #1E293B)',
            color: 'var(--foreground-inverse, #FFFFFF)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-elevated)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div>{data[activeIdx].label}</div>
          <div style={{ color: color, fontSize: '12px', fontWeight: 700 }}>
            {data[activeIdx].value.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

export interface BarChartProps {
  data: ChartDataPoint[]
  height?: number
  ariaLabel?: string
  barColor?: string
  className?: string
}

export function BarChart({
  data,
  height = 200,
  ariaLabel = 'Categorical bar chart',
  barColor = 'var(--primary, #7C3AED)',
  className = '',
}: BarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No bar chart data
      </div>
    )
  }

  const width = 500
  const padTop = 20
  const padBottom = 30
  const padLeft = 40
  const padRight = 20

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const slotW = chartW / data.length
  const barW = Math.min(Math.max(slotW * 0.55, 12), 48)

  return (
    <div className={`chart-wrap ${className}`} style={{ width: '100%', position: 'relative' }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Baseline */}
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={width - padRight}
          y2={padTop + chartH}
          stroke="var(--border-default, #E2E8F0)"
          strokeWidth="1"
        />

        {data.map((d, i) => {
          const bH = (d.value / maxVal) * chartH
          const x = padLeft + i * slotW + (slotW - barW) / 2
          const y = padTop + chartH - bH
          const isHov = hoveredIdx === i
          const fill = d.color || barColor

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background Track */}
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={chartH}
                fill="var(--surface-muted, #F1F4FA)"
                rx="4"
                opacity="0.5"
              />
              {/* Value Bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(bH, 2)}
                fill={fill}
                rx="4"
                opacity={isHov ? 0.85 : 1}
                style={{ transition: 'height 0.3s ease, fill 0.15s ease' }}
              />
              {/* Top value number */}
              {isHov && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                  fill="var(--text-primary)"
                >
                  {d.value.toLocaleString()}
                </text>
              )}
              {/* Category label */}
              <text
                x={x + barW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="10.5"
                fontFamily="var(--font-sans)"
                fontWeight={isHov ? '700' : '500'}
                fill={isHov ? 'var(--text-primary)' : 'var(--text-muted)'}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export interface DonutSegment {
  label: string
  value: number
  color?: string
}

export interface DonutChartProps {
  data: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerSublabel?: string
  ariaLabel?: string
  showLegend?: boolean
  className?: string
}

export function DonutChart({
  data,
  size = 180,
  strokeWidth = 24,
  centerLabel,
  centerSublabel,
  ariaLabel = 'Donut segment chart',
  showLegend = true,
  className = '',
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const total = data.reduce((acc, d) => acc + d.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const defaultColors = [
    'var(--primary, #7C3AED)',
    'var(--info, #3B82F6)',
    'var(--success, #10B981)',
    'var(--warning, #F59E0B)',
    'var(--accent, #FF6B35)',
    '#A78BFA',
    '#2DD4BF',
  ]

  let accumulatedPercent = 0

  return (
    <div
      className={`donut-chart-wrap ${className}`}
      style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}
    >
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          {/* Base Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-muted, #F1F4FA)"
            strokeWidth={strokeWidth}
          />

          {total > 0 && data.map((d, i) => {
            const percent = d.value / total
            const strokeDasharray = `${percent * circumference} ${circumference}`
            const strokeDashoffset = -accumulatedPercent * circumference
            accumulatedPercent += percent

            const color = d.color || defaultColors[i % defaultColors.length]
            const isHov = hoveredIdx === i

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={isHov ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredIdx === null || isHov ? 1 : 0.6,
                }}
              />
            )
          })}
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: 8,
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {hoveredIdx !== null
              ? data[hoveredIdx].value.toLocaleString()
              : (centerLabel || total.toLocaleString())}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
            {hoveredIdx !== null ? data[hoveredIdx].label : (centerSublabel || 'Total')}
          </div>
        </div>
      </div>

      {/* Optional Legend */}
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140, flex: 1 }}>
          {data.map((d, i) => {
            const color = d.color || defaultColors[i % defaultColors.length]
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
            const isHov = hoveredIdx === i

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  background: isHov ? 'var(--surface-hover)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ color: isHov ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isHov ? 700 : 500 }}>
                    {d.label}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MiniSparkline({
  data,
  color = 'var(--primary, #7C3AED)',
  width = 80,
  height = 24,
  fill = true,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
}) {
  if (!data || data.length < 2) return null

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 4) + 2
      const y = height - 2 - ((v - min) / range) * (height - 4)
      return `${x},${y}`
    })
    .join(' ')

  const area = `M 2,${height} ` + points + ` L ${width - 2},${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {fill && <path d={area} fill={color} opacity="0.15" />}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export interface AreaChartProps {
  data: ChartDataPoint[]
  height?: number
  ariaLabel?: string
  color?: string
  secondaryColor?: string
  showGrid?: boolean
  className?: string
}

export function AreaChart({
  data,
  height = 200,
  ariaLabel = 'Area comparison chart',
  color = 'var(--primary, #7C3AED)',
  secondaryColor = 'var(--primary-light, #C4B5FD)',
  showGrid = true,
  className = '',
}: AreaChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No area chart data
      </div>
    )
  }

  const width = 500
  const padTop = 16
  const padBottom = 28
  const padLeft = 36
  const padRight = 16
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const allVals = data.flatMap((d) => [d.value, d.secondaryValue].filter((v): v is number => v !== undefined))
  const maxVal = Math.max(...allVals, 1) * 1.15
  const minVal = 0
  const range = maxVal - minVal || 1

  const getX = (i: number) => padLeft + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const getY = (v: number) => padTop + chartH - (v / maxVal) * chartH

  const hasSecondary = data.some((d) => d.secondaryValue !== undefined)

  const linePrimary = 'M ' + data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' L ')
  const areaPrimary = `${linePrimary} L ${getX(data.length - 1)},${padTop + chartH} L ${getX(0)},${padTop + chartH} Z`

  const lineSecondary = hasSecondary
    ? 'M ' + data.map((d, i) => `${getX(i)},${getY(d.secondaryValue ?? 0)}`).join(' L ')
    : ''
  const areaSecondary = hasSecondary
    ? `${lineSecondary} L ${getX(data.length - 1)},${padTop + chartH} L ${getX(0)},${padTop + chartH} Z`
    : ''

  const grad1Id = `grad-area-1-${Math.random().toString(36).slice(2, 7)}`
  const grad2Id = `grad-area-2-${Math.random().toString(36).slice(2, 7)}`

  return (
    <div className={`chart-wrap ${className}`} style={{ width: '100%', position: 'relative' }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={grad1Id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          {hasSecondary && (
            <linearGradient id={grad2Id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.01" />
            </linearGradient>
          )}
        </defs>

        {/* Grid */}
        {showGrid && [0, 0.33, 0.66, 1].map((pct) => {
          const y = padTop + chartH * (1 - pct)
          return (
            <line
              key={pct}
              x1={padLeft}
              y1={y}
              x2={width - padRight}
              y2={y}
              stroke="var(--border-default, #E2E8F0)"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
          )
        })}

        {/* Secondary Area */}
        {hasSecondary && (
          <>
            <path d={areaSecondary} fill={`url(#${grad2Id})`} />
            <path d={lineSecondary} fill="none" stroke={secondaryColor} strokeWidth="1.8" />
          </>
        )}

        {/* Primary Area & Line */}
        <path d={areaPrimary} fill={`url(#${grad1Id})`} />
        <path d={linePrimary} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points & Labels */}
        {data.map((d, i) => {
          const cx = getX(i)
          const cy = getY(d.value)
          const isAct = activeIdx === i

          return (
            <g
              key={i}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isAct ? 5.5 : 3}
                fill={isAct ? '#FFFFFF' : color}
                stroke={color}
                strokeWidth={isAct ? 2.5 : 1.5}
                style={{ transition: 'all 0.15s ease' }}
              />
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                fontSize="9.5"
                fontFamily="var(--font-sans)"
                fontWeight={isAct ? '700' : '500'}
                fill={isAct ? 'var(--text-primary)' : 'var(--text-muted)'}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover Tooltip */}
      {activeIdx !== null && data[activeIdx] && (
        <div
          style={{
            position: 'absolute',
            left: `${(getX(activeIdx) / width) * 100}%`,
            top: `${(getY(data[activeIdx].value) / height) * 100}%`,
            transform: 'translate(-50%, -125%)',
            background: 'var(--surface-elevated, #1E293B)',
            color: 'var(--foreground-inverse, #FFFFFF)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-elevated)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div>{data[activeIdx].label}</div>
          <div style={{ color: color, fontSize: '12px', fontWeight: 700 }}>
            {data[activeIdx].value.toLocaleString()}
          </div>
          {data[activeIdx].secondaryValue !== undefined && (
            <div style={{ color: secondaryColor, fontSize: '11px' }}>
              Prev: {data[activeIdx].secondaryValue?.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export interface FunnelChartProps {
  data: ChartDataPoint[]
  height?: number
  ariaLabel?: string
  color?: string
  className?: string
}

export function FunnelChart({
  data,
  height = 220,
  ariaLabel = 'Conversion funnel chart',
  color = 'var(--primary, #7C3AED)',
  className = '',
}: FunnelChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No funnel data
      </div>
    )
  }

  const width = 450
  const padTop = 12
  const padBottom = 12
  const padLeft = 24
  const padRight = 24
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const slotH = chartH / data.length
  const barH = Math.min(Math.max(slotH * 0.72, 22), 38)
  const spacing = (chartH - barH * data.length) / Math.max(data.length - 1, 1)

  return (
    <div className={`chart-wrap ${className}`} style={{ width: '100%', position: 'relative' }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {data.map((d, i) => {
          const ratio = d.value / maxVal
          const barW = Math.max(ratio * chartW * 0.9 + 20, 40)
          const x = (width - barW) / 2
          const y = padTop + i * (barH + spacing)
          const opacity = Math.max(1 - i * 0.14, 0.45)
          const isHov = hoveredIdx === i

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={barH / 2.5}
                fill={d.color || color}
                opacity={isHov ? 1 : opacity}
                stroke={isHov ? 'var(--foreground, #FFFFFF)' : 'none'}
                strokeWidth={isHov ? 2 : 0}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* Centered label */}
              <text
                x={width / 2}
                y={y + barH / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-sans)"
                fontWeight="700"
                fill="#FFFFFF"
                style={{ pointerEvents: 'none' }}
              >
                {d.label}: {d.value.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

