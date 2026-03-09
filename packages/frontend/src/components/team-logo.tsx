import { cn } from '@/lib/utils';

const sizeMap = {
  xs: 'w-4 h-4',   // 16px — fixtures list, standings panel
  sm: 'w-5 h-5',   // 20px — league standings table
  md: 'w-6 h-6',   // 24px — injury card, leaderboard
  lg: 'w-7 h-7',   // 28px — fixture detail header
  xl: 'w-16 h-16', // 64px — team page header
} as const;

interface TeamLogoProps {
  logo: string | null | undefined;
  alt?: string;
  size?: keyof typeof sizeMap;
  className?: string;
}

export function TeamLogo({ logo, alt = '', size = 'md', className }: TeamLogoProps) {
  if (!logo) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        sizeMap[size],
        className
      )}
    >
      <img src={logo} alt={alt} className="max-w-full max-h-full object-contain" />
    </span>
  );
}
