'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { SignInModal } from './sign-in-modal';

export function UserAvatar() {
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0" />;
  }

  if (!session) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          Sign in
        </button>
        <SignInModal open={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  const user = session.user;
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="w-7 h-7 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="User menu"
      >
        {user?.image ? (
          <Image src={user.image} alt={user.name ?? 'User'} width={28} height={28} className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground text-[0.6rem] font-bold">
            {initials}
          </div>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-9 w-44 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground truncate">{user?.name ?? 'User'}</p>
            <p className="text-[0.6875rem] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Link
            href="/watchlist"
            onClick={() => setShowDropdown(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors no-underline"
          >
            <span>⭐</span> My Watchlist
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left bg-transparent border-0 cursor-pointer"
          >
            <span>↩</span> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
