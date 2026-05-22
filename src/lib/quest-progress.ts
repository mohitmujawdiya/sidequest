import {
  categoryLabels,
  difficultyLabels,
  quests,
  type QuestCategory,
  type QuestDifficulty,
  type SideQuest,
} from '../data/quests'

export interface SavedQuestRecord {
  userId: string
  questId: string
  questTitle: string
  category: QuestCategory
  difficulty: QuestDifficulty
  xp: number
  status: 'saved' | 'ongoing' | 'completed'
  savedAt: string
  acceptedAt?: string
  completedAt?: string
}

export interface QuestCompletionRecord {
  userId: string
  questId: string
  questTitle: string
  category: QuestCategory
  difficulty: QuestDifficulty
  xp: number
  completedAt: string
  proofNote?: string
  proofImageKey?: string
  proofImageUrl?: string
  proofImageName?: string
  proofImageSize?: number
  proofImageType?: string
}

export interface CommunityPostRecord {
  userId: string
  questId: string
  questTitle: string
  category: QuestCategory
  difficulty: QuestDifficulty
  xp: number
  playerName?: string
  completedAt: string
  sharedAt: string
  caption?: string
  proofImageKey?: string
  proofImageUrl?: string
  proofImageName?: string
  proofImageSize?: number
  proofImageType?: string
}

export type CommunityReactionKind = 'cheer' | 'favorite'

export interface CommunityReactionRecord {
  userId: string
  postId: string
  kind: CommunityReactionKind
  createdAt: string
}

export interface MemoryPhotoPayload {
  proofImageKey: string
  proofImageUrl: string
  proofImageName: string
  proofImageSize: number
  proofImageType: string
}

export const categoryStyles: Record<QuestCategory, string> = {
  mind: 'bg-[oklch(0.84_0.11_282)] text-[oklch(0.24_0.08_280)] ring-[oklch(0.44_0.12_280)]',
  craft: 'bg-[oklch(0.86_0.13_38)] text-[oklch(0.28_0.09_35)] ring-[oklch(0.50_0.13_35)]',
  outside: 'bg-[oklch(0.84_0.13_155)] text-[oklch(0.22_0.08_150)] ring-[oklch(0.42_0.11_150)]',
  people: 'bg-[oklch(0.84_0.12_218)] text-[oklch(0.23_0.08_225)] ring-[oklch(0.43_0.12_225)]',
  motion: 'bg-[oklch(0.87_0.14_91)] text-[oklch(0.29_0.08_74)] ring-[oklch(0.54_0.11_82)]',
  care: 'bg-[oklch(0.86_0.13_340)] text-[oklch(0.27_0.10_340)] ring-[oklch(0.48_0.13_340)]',
}

export const categoryGlow: Record<QuestCategory, string> = {
  mind: 'bg-[oklch(0.69_0.16_282)]',
  craft: 'bg-[oklch(0.71_0.18_38)]',
  outside: 'bg-[oklch(0.70_0.16_155)]',
  people: 'bg-[oklch(0.70_0.16_218)]',
  motion: 'bg-[oklch(0.75_0.17_91)]',
  care: 'bg-[oklch(0.72_0.17_340)]',
}

export const difficultyStyles: Record<QuestDifficulty, string> = {
  easy: 'bg-[oklch(0.87_0.14_155)] text-[oklch(0.22_0.08_150)]',
  medium: 'bg-[oklch(0.88_0.15_82)] text-[oklch(0.30_0.08_70)]',
  hard: 'bg-[oklch(0.84_0.15_25)] text-[oklch(0.27_0.10_25)]',
}

export const maxMemoryPhotoBytes = 8 * 1024 * 1024

export function questSnapshot(quest: SideQuest) {
  return {
    questId: quest.id,
    questTitle: quest.title,
    category: quest.category,
    difficulty: quest.difficulty,
    xp: quest.xp,
  }
}

export function findQuest(questId: string) {
  return quests.find((quest) => quest.id === questId)
}

export function formatQuestDate(value?: string) {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatMemoryPhotoSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateMemoryPhoto(file: File) {
  if (!file.type.startsWith('image/')) return 'Choose an image file for the memory photo.'
  if (file.size > maxMemoryPhotoBytes) return 'Choose an image under 8 MB.'
  return null
}

export function memoryPhotoName(questId: string, file: File) {
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase()
  const suffix = extension ? `.${extension}` : ''
  return `sidequest-${questId}-${Date.now()}${suffix}`
}

export function getQuestLabel(record: Pick<QuestCompletionRecord | SavedQuestRecord | CommunityPostRecord, 'category' | 'difficulty'>) {
  return `${categoryLabels[record.category]} · ${difficultyLabels[record.difficulty]}`
}

export function getPublicPlayerName(user: { name?: string | null } | null | undefined) {
  const name = user?.name?.trim()
  return name || 'Adventurer'
}

export function withFileScopeParam(url: string, scope: 'app' | 'self') {
  const separator = url.includes('?') ? '&' : '?'
  return url.includes('scope=') ? url : `${url}${separator}scope=${scope}`
}

export function isAppScopedMemoryImageKey(key?: string) {
  return Boolean(key?.startsWith('apps/') && !key.includes('/users/'))
}

export function isUserScopedMemoryImageUrl(url: string) {
  try {
    return new URL(url, window.location.origin).pathname.includes('/api/files/apps/') &&
      new URL(url, window.location.origin).pathname.includes('/users/')
  } catch {
    return url.includes('/api/files/apps/') && url.includes('/users/')
  }
}

export function resolveMemoryImageUrl(
  image: Pick<QuestCompletionRecord | CommunityPostRecord, 'proofImageKey' | 'proofImageUrl'>,
  getUrl: (key: string) => string,
) {
  const url = image.proofImageUrl ?? (image.proofImageKey ? getUrl(image.proofImageKey) : null)
  if (!url) return null
  return isAppScopedMemoryImageKey(image.proofImageKey) ? withFileScopeParam(url, 'app') : url
}
