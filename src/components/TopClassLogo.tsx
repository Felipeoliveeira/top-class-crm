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
      {/* Letter t - vertical stem with curved bottom tail */}
      <path d="M29 12 L29 42 Q29 50 37 50 L40 50 L40 45 L37 45 Q34 45 34 42 L34 12 Z" fill="#C50B40" />
      {/* Letter t - horizontal crossbar */}
      <rect x="19" y="24" width="22" height="6" fill="#C50B40" />
      {/* White square accent at top-left of crossbar junction */}
      <rect x="22" y="18" width="7" height="6" fill="#FFFFFF" />
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
