import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, useMutations, useUser } from 'deepspace'

export type AnalyticsEventType =
  | 'page_view'
  | 'shuffle_sidequest'
  | 'save_sidequest'
  | 'accept_sidequest'
  | 'complete_sidequest'
  | 'post_memory'
  | 'cheer_memory'
  | 'favorite_memory'
  | 'sign_in_prompt'
  | 'mascot_tap'
  | 'deepspace_cta_click'
  | 'scroll_depth'

export interface AnalyticsEventRecord {
  eventType: AnalyticsEventType
  createdAt: string
  sessionId: string
  userId?: string
  userRole?: string
  route?: string
  questId?: string
  questTitle?: string
  category?: string
  difficulty?: string
  xp?: number
  metadata?: string
}

export interface AnalyticsPayload {
  category?: string
  difficulty?: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  questId?: string
  questTitle?: string
  route?: string
  xp?: number
}

const SESSION_KEY = 'sidequest.analytics.session'

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function getAnalyticsSessionId() {
  if (typeof window === 'undefined') return 'server'
  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const sessionId = createSessionId()
  window.localStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

function encodeMetadata(metadata: AnalyticsPayload['metadata']) {
  if (!metadata) return undefined
  const clean = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  )
  if (Object.keys(clean).length === 0) return undefined
  return JSON.stringify(clean).slice(0, 500)
}

export function useAnalytics() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const mutations = useMutations<AnalyticsEventRecord>('analytics_events')

  return useCallback(
    (eventType: AnalyticsEventType, payload: AnalyticsPayload = {}) => {
      const record: AnalyticsEventRecord = {
        eventType,
        createdAt: new Date().toISOString(),
        sessionId: getAnalyticsSessionId(),
        route: payload.route ?? (typeof window === 'undefined' ? undefined : window.location.pathname),
        questId: payload.questId,
        questTitle: payload.questTitle,
        category: payload.category,
        difficulty: payload.difficulty,
        xp: payload.xp,
        metadata: encodeMetadata(payload.metadata),
      }

      if (isSignedIn && user?.id) {
        record.userId = user.id
        record.userRole = user.role ?? 'member'
      }

      void mutations.create(record).catch(() => {
        // Analytics is useful, but it should never interrupt the sidequest flow.
      })
    },
    [isSignedIn, mutations, user?.id, user?.role],
  )
}

export function AnalyticsTracker() {
  const location = useLocation()
  const track = useAnalytics()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastPathRef.current === location.pathname) return
    lastPathRef.current = location.pathname
    track('page_view', { route: location.pathname })
  }, [location.pathname, track])

  return null
}
