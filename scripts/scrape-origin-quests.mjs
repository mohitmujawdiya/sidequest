import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const originBaseUrl = 'https://mylifeisboringandiwanttodoasidequestbutdontknowwhattodo.com'
const trpcBaseUrl = `${originBaseUrl}/api/trpc`
const outputPath = fileURLToPath(new URL('../src/data/origin-quests.generated.ts', import.meta.url))
const auditPath = fileURLToPath(new URL('../artifacts/origin-quest-scrape-audit.json', import.meta.url))

const voteTargetCount = 200
const communityPageSize = 50
const communityPages = 4

const unsafePatterns = [
  ['site-specific or spammy prompt', /\b(submit (a |[0-9]+ )?side ?quest|submit [0-9]+ quests?|on this website|follow lilvb|creator xp|easy xp|just click)\b/i],
  ['not actionable as a reusable quest', /^I am with .*want to go on a side quest/i],
  ['coercive stranger interaction', /\b(approach 10 women|get (them|the stranger) to .*pay|convince a stranger|selfie with you|post it in your story)\b/i],
  ['theft or deception with property', /\b(steal|stealing|shoplift|theft|rob|robbery)\b/i],
  ['trespass or abandoned structures', /\b(trespass|trespassing|break into|breaking into|b&e|abandoned building|urbex|urban exploration|abandoned structure)\b/i],
  ['illegal activity', /\b(illegal|police chase|run from police)\b/i],
  ['self harm', /\b(kill yourself|suicide|self[- ]?harm)\b/i],
  ['violence or weapons', /\b(fight|punch|weapon|weapons|knife|gun)\b/i],
  ['substance misuse or unsafe home brewing', /\b(brew.*alcohol|homemade alcohol|drink .*alcohol|smoke weed|take drugs|do drugs|edible|shrooms?)\b/i],
  ['traffic or rail danger', /\b(train tracks|railroad tracks|highway)\b/i],
  ['stalking or covert following', /\b(stalk|stalker|follow .*without .*knowing|without them knowing)\b/i],
  ['sexual or nude content', /\b(naked|sex|porn|strip)\b/i],
  ['unsafe navigation', /\b(without any devices or GPS|no devices or GPS)\b/i],
  ['unwanted touch', /\b(boop|kiss|touch (a |the )?stranger|hug (a )?stranger|take (him|her|it) home)\b/i],
  ['sleep deprivation', /\b(all[- ]nighter|stay up all night)\b/i],
  ['hazardous stunt', /\b(climb .*building|random tree|slide down a hill)\b/i],
  ['unhealthy consumption', /\b(drink every monster|energy drink)\b/i],
]

function endpoint(path, input) {
  return `${trpcBaseUrl}/${path}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`
}

async function fetchTrpc(path, input) {
  const response = await fetch(endpoint(path, input), {
    headers: { accept: 'application/json' },
  })
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${body.slice(0, 500)}`)
  }

  return JSON.parse(body)
}

async function fetchVoteSubmissions() {
  const input = {
    0: { json: { sortBy: 'popular' } },
  }
  const data = await fetchTrpc('submissions.getPendingPublic', input)
  return data[0]?.result?.data?.json ?? []
}

async function fetchCommunityTrending() {
  const pages = []

  for (let page = 0; page < communityPages; page += 1) {
    const input = {
      0: {
        json: {
          sort: 'trending',
          page,
          pageSize: communityPageSize,
          category: undefined,
          search: undefined,
        },
        meta: {
          values: {
            category: ['undefined'],
            search: ['undefined'],
          },
        },
      },
    }
    const data = await fetchTrpc('social.getPlayerFeed', input)
    const payload = data[0]?.result?.data?.json
    pages.push(payload)
    if (!payload?.hasMore) break
  }

  return pages.flatMap((page) => page?.items ?? [])
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(title, description) {
  return `${normalizeText(title).toLowerCase()}\n${normalizeText(description).toLowerCase()}`
}

function getUnsafeReason(title, description) {
  const text = `${normalizeText(title)}\n${normalizeText(description)}`
  return unsafePatterns.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}

function normalizeCategory(category) {
  const normalized = normalizeText(category).toLowerCase()
  if (['mental', 'creative', 'adventure', 'social', 'physical'].includes(normalized)) {
    return normalized
  }
  return 'mental'
}

function normalizeDifficulty(difficulty) {
  const normalized = normalizeText(difficulty).toLowerCase()
  if (['easy', 'medium', 'hard'].includes(normalized)) return normalized
  return 'medium'
}

function roundToTen(value) {
  return Math.max(10, Math.round(value / 10) * 10)
}

function normalizeXp(rawXp, difficulty, signal = 0) {
  const normalizedDifficulty = normalizeDifficulty(difficulty)
  const base = { easy: 70, medium: 140, hard: 230 }[normalizedDifficulty]
  const cap = { easy: 190, medium: 320, hard: 480 }[normalizedDifficulty]
  const rawBonus = Math.min(170, Math.sqrt(Math.max(0, Number(rawXp) || 0)) * 3.1)
  const signalBonus = Math.min(70, Math.max(0, signal) * 3)
  return Math.min(cap, roundToTen(base + rawBonus + signalBonus))
}

function sourceVoteRecord(submission, sourceRank) {
  const sourceScore = (submission.upvotes ?? 0) - (submission.downvotes ?? 0)
  const difficulty = normalizeDifficulty(submission.difficulty)

  return {
    id: `vote-${submission.id}`,
    source: 'vote',
    sourceId: submission.id,
    sourceRank,
    sourceScore,
    title: normalizeText(submission.title),
    description: normalizeText(submission.description),
    category: normalizeCategory(submission.category),
    difficulty,
    xp: normalizeXp(submission.suggestedXpReward, difficulty, sourceScore),
    sourceXp: submission.suggestedXpReward ?? null,
    upvotes: submission.upvotes ?? 0,
    downvotes: submission.downvotes ?? 0,
    submittedAt: submission.createdAt ?? null,
  }
}

function sourceCommunityRecord(item, sourceRank) {
  const difficulty = normalizeDifficulty(item.questDifficulty)
  const sourceScore = (item.maxLikeCount ?? item.likeCount ?? 0) + (item.completionCount ?? 1)

  return {
    id: `community-${item.userQuestId}`,
    source: 'community',
    sourceId: item.userQuestId,
    sourceRank,
    sourceScore,
    title: normalizeText(item.questTitle),
    description: normalizeText(item.questDescription),
    category: normalizeCategory(item.questCategory),
    difficulty,
    xp: normalizeXp(item.xpEarned, difficulty, sourceScore),
    sourceXp: item.xpEarned ?? null,
    likeCount: item.maxLikeCount ?? item.likeCount ?? 0,
    completionCount: item.completionCount ?? 1,
    completedAt: item.completedAt ?? null,
  }
}

function selectVoteRecords(submissions) {
  const selected = []
  const skipped = []

  for (const [index, submission] of submissions.entries()) {
    const unsafeReason = getUnsafeReason(submission.title, submission.description)
    if (unsafeReason) {
      skipped.push({
        sourceRank: index + 1,
        sourceId: submission.id,
        title: normalizeText(submission.title),
        reason: unsafeReason,
      })
      continue
    }

    selected.push(sourceVoteRecord(submission, index + 1))
    if (selected.length >= voteTargetCount) break
  }

  return { selected, skipped }
}

function dedupeCommunityItems(items) {
  const unique = new Map()

  for (const item of items) {
    const key = normalizeKey(item.questTitle, item.questDescription)
    const existing = unique.get(key)

    if (!existing) {
      unique.set(key, {
        ...item,
        completionCount: 1,
        maxLikeCount: item.likeCount ?? 0,
        maxCommentCount: item.commentCount ?? 0,
      })
      continue
    }

    existing.completionCount += 1
    existing.maxLikeCount = Math.max(existing.maxLikeCount, item.likeCount ?? 0)
    existing.maxCommentCount = Math.max(existing.maxCommentCount, item.commentCount ?? 0)

    if (new Date(item.completedAt).getTime() > new Date(existing.completedAt).getTime()) {
      existing.completedAt = item.completedAt
    }
  }

  return [...unique.values()].sort((a, b) => (
    (b.maxLikeCount - a.maxLikeCount) ||
    (b.completionCount - a.completionCount) ||
    (new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
  ))
}

function selectCommunityRecords(items, existingKeys) {
  const selected = []
  const skipped = []

  for (const [index, item] of items.entries()) {
    const unsafeReason = getUnsafeReason(item.questTitle, item.questDescription)
    if (unsafeReason) {
      skipped.push({
        sourceRank: index + 1,
        sourceId: item.userQuestId,
        title: normalizeText(item.questTitle),
        reason: unsafeReason,
      })
      continue
    }

    const key = normalizeKey(item.questTitle, item.questDescription)
    if (existingKeys.has(key)) continue

    selected.push(sourceCommunityRecord(item, index + 1))
    existingKeys.add(key)
  }

  return { selected, skipped }
}

function stringifyAscii(value) {
  return JSON.stringify(value, null, 2).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (character) => {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) return ''
    if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, '0')}`
    const adjusted = codePoint - 0x10000
    const high = 0xd800 + (adjusted >> 10)
    const low = 0xdc00 + (adjusted & 0x3ff)
    return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`
  })
}

function buildGeneratedFile(records, meta) {
  return `// Generated by scripts/scrape-origin-quests.mjs. Do not edit by hand.

export type OriginQuestSource = 'vote' | 'community'
export type OriginQuestCategory = 'mental' | 'creative' | 'adventure' | 'social' | 'physical'
export type OriginQuestDifficulty = 'easy' | 'medium' | 'hard'

export interface OriginQuestRecord {
  id: string
  source: OriginQuestSource
  sourceId: number
  sourceRank: number
  sourceScore: number
  title: string
  description: string
  category: OriginQuestCategory
  difficulty: OriginQuestDifficulty
  xp: number
  sourceXp: number | null
  upvotes?: number
  downvotes?: number
  submittedAt?: string | null
  likeCount?: number
  completionCount?: number
  completedAt?: string | null
}

export const originQuestScrapeMeta = ${stringifyAscii(meta)} as const

export const originQuestRecords: OriginQuestRecord[] = ${stringifyAscii(records)}
`
}

async function main() {
  const voteSubmissions = await fetchVoteSubmissions()
  const { selected: voteRecords, skipped: skippedVoteRecords } = selectVoteRecords(voteSubmissions)

  const communityItems = await fetchCommunityTrending()
  const communityUniqueItems = dedupeCommunityItems(communityItems)
  const existingKeys = new Set(voteRecords.map((record) => normalizeKey(record.title, record.description)))
  const { selected: communityRecords, skipped: skippedCommunityRecords } = selectCommunityRecords(
    communityUniqueItems,
    existingKeys,
  )

  const records = [...voteRecords, ...communityRecords]
  const meta = {
    generatedAt: new Date().toISOString(),
    voteSourceUrl: `${originBaseUrl}/vote`,
    communitySourceUrl: `${originBaseUrl}/community`,
    voteReturned: voteSubmissions.length,
    voteSelected: voteRecords.length,
    voteUnsafeSkippedBeforeSelection: skippedVoteRecords.filter(
      (record) => record.sourceRank <= (voteRecords.at(-1)?.sourceRank ?? 0),
    ).length,
    communityFetched: communityItems.length,
    communityUnique: communityUniqueItems.length,
    communitySelected: communityRecords.length,
    communityUnsafeSkipped: skippedCommunityRecords.length,
    totalSelected: records.length,
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await mkdir(dirname(auditPath), { recursive: true })
  await writeFile(outputPath, buildGeneratedFile(records, meta), 'utf8')
  await writeFile(
    auditPath,
    `${JSON.stringify({
      meta,
      skippedVoteRecords,
      skippedCommunityRecords,
      sampleSelected: records.slice(0, 30),
    }, null, 2)}\n`,
    'utf8',
  )

  console.log(JSON.stringify({ ...meta, auditPath }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
