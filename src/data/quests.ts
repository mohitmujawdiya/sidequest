import {
  Bike,
  Brush,
  Coffee,
  Compass,
  Flower2,
  HandHeart,
  MapPinned,
  MessageCircle,
  Music2,
  NotebookPen,
  Palette,
  Puzzle,
  Sparkle,
  Sprout,
  Star,
  type LucideIcon,
} from 'lucide-react'
import {
  originQuestRecords,
  originQuestScrapeMeta,
  type OriginQuestCategory,
  type OriginQuestRecord,
  type OriginQuestSource,
} from './origin-quests.generated'

export type QuestDifficulty = 'easy' | 'medium' | 'hard'
export type QuestCategory = 'mind' | 'craft' | 'outside' | 'people' | 'motion' | 'care'
export type QuestMode = 'solo' | 'social' | 'either'
export type QuestTime = 'quick' | 'short' | 'long'

export interface SideQuest {
  id: string
  title: string
  summary: string
  category: QuestCategory
  difficulty: QuestDifficulty
  mode: QuestMode
  time: QuestTime
  xp: number
  estimate: string
  setting: string
  prompt: string
  rules: string[]
  proof: string[]
  icon: LucideIcon
  source: OriginQuestSource
  sourceId: number
  sourceRank: number
  sourceScore: number
  sourceLabel: string
  sourceUrl: string
  sourceXp: number | null
}

export const difficultyLabels: Record<QuestDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export const categoryLabels: Record<QuestCategory, string> = {
  mind: 'Mind',
  craft: 'Craft',
  outside: 'Outside',
  people: 'People',
  motion: 'Motion',
  care: 'Care',
}

export const modeLabels: Record<QuestMode, string> = {
  solo: 'Solo',
  social: 'Social',
  either: 'Either',
}

export const timeLabels: Record<QuestTime, string> = {
  quick: '15 min',
  short: '30 min',
  long: '60+ min',
}

export const sourceLabels: Record<OriginQuestSource, string> = {
  vote: 'Vote board',
  community: 'Trending',
}

export { originQuestScrapeMeta }

const originCategoryMap: Record<OriginQuestCategory, QuestCategory> = {
  mental: 'mind',
  creative: 'craft',
  adventure: 'outside',
  social: 'people',
  physical: 'motion',
}

const categoryIconMap: Record<QuestCategory, LucideIcon> = {
  mind: NotebookPen,
  craft: Palette,
  outside: Compass,
  people: MessageCircle,
  motion: Bike,
  care: HandHeart,
}

const categorySettingMap: Record<QuestCategory, string> = {
  mind: 'Anywhere quiet',
  craft: 'Desk, kitchen, studio, or maker space',
  outside: 'Public or clearly allowed places',
  people: 'In person or message thread',
  motion: 'Safe place to move',
  care: 'Home, neighborhood, or errand route',
}

const keywordIcons: Array<[RegExp, LucideIcon]> = [
  [/\b(bike|ride|run|push|plank|hike|walk|bowling|handstand|calisthenics|workout)\b/i, Bike],
  [/\b(draw|paint|color|sketch|garfield|creature|craft|pottery|cardboard|lego|clothing)\b/i, Brush],
  [/\b(food|cook|bake|coffee|tea|meal|egg|butter|restaurant|breakfast|lunch|dinner)\b/i, Coffee],
  [/\b(book|read|write|letter|study|language|review|summary|rubik|learn|knowledge)\b/i, NotebookPen],
  [/\b(music|song|album|concert|karaoke|dance|instrument|band|perform)\b/i, Music2],
  [/\b(help|donate|grateful|love|compliment|hug|shelter|kind|neighbor)\b/i, HandHeart],
  [/\b(flower|grass|tree|nature|animal|farm|hike|camp|fish)\b/i, Flower2],
  [/\b(game|puzzle|rubik|tic-tac-toe|pool)\b/i, Puzzle],
  [/\b(map|bus|flight|city|tourist|explore|adventure|spot|place|world|route)\b/i, MapPinned],
  [/\b(magic|movie|cinema|film|photo|sunset|sunrise|star|sky|celestial)\b/i, Sparkle],
]

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function createSummary(description: string) {
  const clean = cleanText(description)
  if (clean.length <= 190) return clean

  const sentence = clean.match(/^.{70,190}?[.!?](?=\s|$)/)?.[0]
  if (sentence) return sentence

  return `${clean.slice(0, 187).trim()}...`
}

function inferMode(record: OriginQuestRecord): QuestMode {
  const text = `${record.title} ${record.description}`
  if (/\b(friend|friends|stranger|strangers|someone|person|people|neighbor|date|group|together|with your)\b/i.test(text)) {
    return 'social'
  }
  if (/\b(by yourself|your own|solo|alone)\b/i.test(text)) return 'solo'
  if (record.category === 'social') return 'social'
  return 'either'
}

function inferTime(record: OriginQuestRecord): QuestTime {
  const text = `${record.title} ${record.description}`

  if (/\b(month|week|all day|for a day|overnight|flight|trip|black belt|tattoo|cover to cover|500 pages|movie for each year|100 things|350 push-ups|100 push-ups|finish a book|stay there|new language|learn a language|learn a new language|conversationally fluent|skydiving|paragliding)\b/i.test(text)) {
    return 'long'
  }
  if (/\b(10 minutes|15 minutes|20 minutes|one minute|right now|glass of water|single|compliment|ask|photo|draw|drink water)\b/i.test(text)) {
    return 'quick'
  }
  if (record.difficulty === 'hard') return 'long'
  if (record.difficulty === 'easy') return 'quick'
  return 'short'
}

function estimateFor(time: QuestTime) {
  if (time === 'quick') return '10-20 min'
  if (time === 'short') return '25-45 min'
  return '60+ min'
}

function iconFor(record: OriginQuestRecord, category: QuestCategory) {
  const text = `${record.title} ${record.description}`
  const match = keywordIcons.find(([pattern]) => pattern.test(text))
  return match?.[1] ?? categoryIconMap[category]
}

function sourceLabelFor(record: OriginQuestRecord) {
  if (record.source === 'vote') {
    return `Vote #${record.sourceRank}`
  }

  if (record.completionCount && record.completionCount > 1) {
    return `Trending x${record.completionCount}`
  }

  return `Trending #${record.sourceRank}`
}

function sourceUrlFor(record: OriginQuestRecord) {
  return record.source === 'vote'
    ? originQuestScrapeMeta.voteSourceUrl
    : originQuestScrapeMeta.communitySourceUrl
}

function buildRules(record: OriginQuestRecord, category: QuestCategory, mode: QuestMode, time: QuestTime) {
  const text = `${record.title} ${record.description}`
  const rules = ['Keep it legal, consensual, and safe for your actual location.']

  if (mode === 'social') {
    rules.push('Give people an easy out, respect the first no, and skip recording private moments.')
  } else if (category === 'outside') {
    rules.push('Use public or clearly allowed places, and keep a clear way home.')
  } else if (category === 'motion') {
    rules.push('Warm up, scale down, and stop before pain or pressure takes over.')
  } else if (category === 'craft') {
    rules.push('Use tools and materials you can handle comfortably.')
  } else {
    rules.push('Make the run kind enough that you can actually finish it.')
  }

  if (/\b(buy|flight|class|course|tattoo|restaurant|bookstore|concert|gas station|amusement park)\b/i.test(text)) {
    rules.push('Set a budget before starting.')
  }

  if (/\b(tattoo)\b/i.test(text)) {
    rules.push('Only do it if it was already your decision, and use a licensed professional.')
  }

  if (time === 'long') {
    rules.push('Tell someone the plan if you are going far, late, or offline.')
  }

  return rules.slice(0, 3)
}

function buildProof(category: QuestCategory) {
  const firstProof: Record<QuestCategory, string> = {
    mind: 'A note with what you learned, wrote, solved, or noticed.',
    craft: 'A photo or short description of what you made.',
    outside: 'A photo, route note, or place name from the outing.',
    people: 'A short recap of the interaction without private details.',
    motion: 'A photo, timer, score, or movement recap.',
    care: 'A before/after note or the kind thing you did.',
  }

  return [firstProof[category], 'Optional: add a victory note or memory photo so the run feels real later.']
}

function toSideQuest(record: OriginQuestRecord): SideQuest {
  const category = originCategoryMap[record.category]
  const mode = inferMode(record)
  const time = inferTime(record)

  return {
    id: record.id,
    title: cleanText(record.title),
    summary: createSummary(record.description),
    category,
    difficulty: record.difficulty,
    mode,
    time,
    xp: record.xp,
    estimate: estimateFor(time),
    setting: categorySettingMap[category],
    prompt: cleanText(record.description),
    rules: buildRules(record, category, mode, time),
    proof: buildProof(category),
    icon: iconFor(record, category),
    source: record.source,
    sourceId: record.sourceId,
    sourceRank: record.sourceRank,
    sourceScore: record.sourceScore,
    sourceLabel: sourceLabelFor(record),
    sourceUrl: sourceUrlFor(record),
    sourceXp: record.sourceXp,
  }
}

export const quests: SideQuest[] = originQuestRecords.map(toSideQuest)

export function getRandomQuest(pool: SideQuest[], currentId?: string) {
  const nextPool = pool.length > 1 && currentId
    ? pool.filter((quest) => quest.id !== currentId)
    : pool
  return nextPool[Math.floor(Math.random() * nextPool.length)] ?? quests[0]
}
