import React from 'react'

interface TopClassLogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

const sizes = {
  sm: { icon: 32, text: 'text-lg', sub: 'text-[8px]' },
  md: { icon: 48, text: 'text-2xl', sub: 'text-[10px]' },
  lg: { icon: 64, text: 'text-4xl', sub: 'text-xs' },
}

function LogoIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#111E2E" />
      {/* Letter t - vertical stem */}
      <path d="M30 14 L30 44 Q30 50 36 50 L38 50 L38 44 L36 44 Q34 44 34 42 L34 14 Z" fill="#C50B40" />
      {/* Letter t - horizontal crossbar */}
      <rect x="22" y="24" width="20" height="6" rx="1" fill="#C50B40" />
      {/* White square accent at top-left junction */}
      <rect x="24" y="18" width="6" height="6" fill="#FFFFFF" />
    </svg>
  )
}

export function TopClassLogo({ size = 'md', variant = 'full' }: TopClassLogoProps) {
  const s = sizes[size]

  if (variant === 'icon') {
    return <LogoIcon size={s.icon} />
  }

  return (
    <div className="flex items-center gap-3">
      <LogoIcon size={s.icon} />
      <div className="flex flex-col">
        <span className={`${s.text} font-bold leading-tight`}>
          <span className="text-foreground">top</span>
          <span className="text-primary">class.</span>
        </span>
        <span className={`${s.sub} text-muted-foreground tracking-wider`}>
          escritório virtual & coworking
        </span>
      </div>
    </div>
  )
}
