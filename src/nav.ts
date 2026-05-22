/**
 * Navigation Config
 *
 * Add one entry per nav item. Routes are handled by generouted
 * (file-based routing in src/pages/), this just controls what
 * appears in the navigation bar.
 */

import type { Role } from './constants'

export interface NavItem {
  path: string
  label: string
  roles?: Role[]
}

export const nav: NavItem[] = [
  { path: '/home', label: 'Board' },
  { path: '/quest-log', label: 'Log' },
  { path: '/community', label: 'Community' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/analytics', label: 'Analytics', roles: ['admin'] },
  // ── Features add nav items below this line ──
]
