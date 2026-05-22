/** Top nav — brand, primary links, role badge, account menu. */

import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, AuthOverlay, useUser, signOut } from 'deepspace'
import { ChevronDown, Compass, LogOut, Menu, X } from 'lucide-react'
import { ROLE_CONFIG, type Role } from '../constants'
import { nav } from '../nav'
import { cn } from './ui/utils'

export default function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)

  const profilePending = isSignedIn && !user
  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'
  const roleConfig = profilePending
    ? { title: 'Syncing', badgeVariant: 'secondary' }
    : ROLE_CONFIG[userRole as Role] ?? { title: 'Anonymous', badgeVariant: 'secondary' }

  // Close any open menus when navigating
  useEffect(() => {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && !navRef.current?.contains(target)) {
        setMobileMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  const visibleNav = nav.filter((item) => {
    if (!item.roles) return true
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  return (
    <>
      <nav
        ref={navRef}
        data-testid="app-navigation"
        className="sticky top-0 z-40 py-3"
      >
        <div className="mx-auto w-full max-w-[calc(80rem+6px)] pl-4 pr-[calc(1rem+6px)] sm:pl-6 sm:pr-[calc(1.5rem+6px)] lg:pl-8 lg:pr-[calc(2rem+6px)]">
          <div
            data-testid="app-navigation-bar"
            className="flex h-14 items-center gap-4 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-card px-3 shadow-[0_6px_0_0_oklch(0.22_0.06_240_/_0.16)] sm:px-4"
          >
            <Link to="/home" className="flex shrink-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-primary text-primary-foreground">
                <Compass className="h-4 w-4" aria-hidden />
              </span>
              <span className="sidequest-display text-xl font-black tracking-normal text-foreground">
                Sidequest
              </span>
            </Link>

            {/* Primary nav (desktop) */}
            <div className="hidden shrink-0 items-center gap-0.5 lg:flex">
              {visibleNav.map((item) => {
                const active = location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-black transition-all duration-150',
                      active
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right cluster */}
            <div className="flex items-center gap-2">
              <span
                data-testid="nav-role-badge"
                className={cn(
                  'hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                  roleConfig.badgeVariant === 'warning'
                    ? 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30'
                    : roleConfig.badgeVariant === 'default'
                      ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/30'
                      : 'bg-secondary text-muted-foreground ring-1 ring-inset ring-border',
                )}
              >
                {roleConfig.title}
              </span>

              {isSignedIn ? (
                <div className="relative">
                  {user ? (
                    <button
                      onClick={() => setUserMenuOpen((prev) => !prev)}
                      aria-haspopup="menu"
                      aria-expanded={userMenuOpen}
                      className="group flex items-center gap-2 rounded-full border border-border bg-card/60 pl-1 pr-2.5 py-1 text-sm transition-colors hover:bg-card hover:border-border"
                    >
                      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border">
                        {user.imageUrl ? (
                          <img
                            src={user.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
                        )}
                      </span>
                      <span
                        data-testid="nav-user-name"
                        className="hidden max-w-[120px] truncate text-foreground sm:inline"
                      >
                        {user.name || user.email}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150',
                          userMenuOpen && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <div
                      aria-label="Syncing account"
                      className="flex items-center gap-2 rounded-full border border-border bg-card/60 pl-1 pr-2.5 py-1 text-sm text-muted-foreground"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border">
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/45" />
                      </span>
                      <span className="hidden max-w-[120px] truncate sm:inline">Syncing</span>
                    </div>
                  )}
                  {user && userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                        aria-hidden
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)]"
                      >
                        <div className="border-b border-border px-3 py-2.5">
                          <div className="truncate text-sm font-medium text-foreground">
                            {user.name || 'Signed in'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                        <button
                          role="menuitem"
                          onClick={() => { setUserMenuOpen(false); signOut() }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <LogOut className="h-3.5 w-3.5" aria-hidden />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
              <button
                data-testid="nav-sign-in-button"
                onClick={() => setShowAuthModal(true)}
                className="sidequest-button bg-primary px-4 py-1.5 text-sm text-primary-foreground"
              >
                Sign in
              </button>
              )}

              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-card text-[oklch(0.24_0.06_240)] transition-colors hover:bg-secondary lg:hidden"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" aria-hidden />
                ) : (
                  <Menu className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          <div
            className={cn(
              'overflow-hidden rounded-2xl transition-[max-height,opacity,margin] duration-200 ease-out lg:hidden',
              mobileMenuOpen
                ? 'mt-2 max-h-96 border-2 border-[oklch(0.31_0.07_240)] bg-card opacity-100 shadow-[0_6px_0_0_oklch(0.22_0.06_240_/_0.14)]'
                : 'mt-0 max-h-0 border-0 opacity-0',
            )}
          >
            <div className="grid gap-2 p-2">
              {visibleNav.map((item) => {
                const active = location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg border-2 px-3 py-2.5 text-sm font-black transition-colors',
                      active
                        ? 'border-[oklch(0.31_0.07_240)] bg-secondary text-foreground shadow-[0_3px_0_0_oklch(0.22_0.06_240_/_0.12)]'
                        : 'border-transparent text-[oklch(0.34_0.055_240)] hover:border-[oklch(0.31_0.07_240)] hover:bg-[oklch(0.98_0.018_93)] hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </>
  )
}
