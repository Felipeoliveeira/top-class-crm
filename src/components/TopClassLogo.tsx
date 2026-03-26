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
      {/* Letter t stem */}
      <rect x="28" y="16" width="8" height="36" rx="2" fill="#C50B40" />
      {/* Letter t crossbar */}
      <rect x="20" y="24" width="24" height="7" rx="2" fill="#C50B40" />
      {/* White square accent */}
      <rect x="24" y="20" width="6" height="6" fill="#FFFFFF" />
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
