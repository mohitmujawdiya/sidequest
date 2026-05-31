import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AuthOverlay,
  useAuth,
  useMutations,
  useQuery,
  useUser,
} from 'deepspace'
import {
  BadgeCheck,
  Bookmark,
  CheckCircle2,
  Clock3,
  Compass,
  Dices,
  ImagePlus,
  Map,
  RefreshCcw,
  Sparkles,
  Trophy,
} from 'lucide-react'
import {
  Badge,
  Button,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '../components/ui'
import { cn } from '../components/ui'
import { useAnalytics } from '../lib/analytics'
import {
  categoryLabels,
  difficultyLabels,
  getRandomQuest,
  modeLabels,
  quests,
  timeLabels,
  type QuestCategory,
  type QuestDifficulty,
  type QuestMode,
  type QuestTime,
  type SideQuest,
} from '../data/quests'
import {
  categoryGlow,
  categoryStyles,
  difficultyStyles,
  questSnapshot,
  type QuestCompletionRecord,
  type SavedQuestRecord,
} from '../lib/quest-progress'

type FilterValue<T extends string> = T | 'any'

const MASCOT_AUDIO_SOURCES = [
  '/audio/mascot-01.m4a',
  '/audio/mascot-02.m4a',
  '/audio/mascot-03.m4a',
  '/audio/mascot-04.m4a',
  '/audio/mascot-05.m4a',
]

export function createDeckSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function getStableQuest(pool: SideQuest[], seed: string) {
  if (pool.length === 0) return null
  return pool[hashString(seed) % pool.length]
}

function getDeckPreview(pool: SideQuest[], anchorId: string, seed: string) {
  const anchor = pool.find((quest) => quest.id === anchorId)
  const shuffled = pool
    .map((quest) => ({
      quest,
      rank: hashString(`${seed}:${quest.id}`),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ quest }) => quest)

  const preview = shuffled.slice(0, 9)

  if (!anchor || preview.some((quest) => quest.id === anchorId)) {
    return preview
  }

  return [anchor, ...preview.slice(0, 8)]
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export default function HomePage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const navigate = useNavigate()
  const { success, error, warning, info } = useToast()
  const track = useAnalytics()
  const [difficulty, setDifficulty] = useState<FilterValue<QuestDifficulty>>('any')
  const [category, setCategory] = useState<FilterValue<QuestCategory>>('any')
  const [mode, setMode] = useState<FilterValue<QuestMode>>('any')
  const [time, setTime] = useState<FilterValue<QuestTime>>('any')
  const [currentId, setCurrentId] = useState(() => getRandomQuest(quests).id)
  const [previewAnchorId, setPreviewAnchorId] = useState(currentId)
  const [deckSeed, setDeckSeed] = useState(() => createDeckSeed())
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<'save' | 'accept' | null>(null)
  const questStageRef = useRef<HTMLElement | null>(null)

  const { records: savedRecords, status: savedStatus } = useQuery<SavedQuestRecord>(
    'saved_quests',
    { orderBy: 'createdAt', orderDir: 'desc' },
  )
  const { records: completionRecords, status: completionStatus } =
    useQuery<QuestCompletionRecord>('quest_completions', {
      orderBy: 'completedAt',
      orderDir: 'desc',
  })
  const savedMutations = useMutations<SavedQuestRecord>('saved_quests')
  const ownSavedRecords = useMemo(
    () => (user?.id ? savedRecords.filter((record) => record.data.userId === user.id) : []),
    [savedRecords, user?.id],
  )
  const ownCompletionRecords = useMemo(
    () => (user?.id ? completionRecords.filter((record) => record.data.userId === user.id) : []),
    [completionRecords, user?.id],
  )

  const filteredQuests = useMemo(() => {
    return quests.filter((quest) => {
      if (difficulty !== 'any' && quest.difficulty !== difficulty) return false
      if (category !== 'any' && quest.category !== category) return false
      if (mode !== 'any' && quest.mode !== mode && quest.mode !== 'either') return false
      if (time !== 'any' && quest.time !== time) return false
      return true
    })
  }, [category, difficulty, mode, time])
  const completedQuestIds = useMemo(() => {
    return new Set(ownCompletionRecords.map((record) => record.data.questId))
  }, [ownCompletionRecords])
  const ongoingQuestIds = useMemo(() => {
    return new Set(
      ownSavedRecords
        .filter((record) => record.data.status === 'ongoing')
        .map((record) => record.data.questId),
    )
  }, [ownSavedRecords])
  const hiddenFromBoardQuestIds = useMemo(() => {
    return new Set([...completedQuestIds, ...ongoingQuestIds])
  }, [completedQuestIds, ongoingQuestIds])
  const deckReady = !isSignedIn || (completionStatus === 'ready' && savedStatus === 'ready')
  const availableQuests = useMemo(() => {
    if (!isSignedIn || !deckReady) return filteredQuests
    return filteredQuests.filter((quest) => !hiddenFromBoardQuestIds.has(quest.id))
  }, [deckReady, filteredQuests, hiddenFromBoardQuestIds, isSignedIn])
  const freshDeckCount = deckReady
    ? quests.filter((quest) => !hiddenFromBoardQuestIds.has(quest.id)).length
    : null

  const hasActiveFilters =
    difficulty !== 'any' || category !== 'any' || mode !== 'any' || time !== 'any'
  const deckSyncing = isSignedIn && !deckReady
  const noMatches = deckReady && availableQuests.length === 0
  const emptyReason = filteredQuests.length === 0 ? 'filters' : 'logged'
  const activePool = deckReady ? availableQuests : []
  const currentQuest = useMemo(
    () => activePool.find((quest) => quest.id === currentId) ?? getStableQuest(activePool, currentId) ?? quests[0],
    [activePool, currentId],
  )
  const savedRecord = ownSavedRecords.find((record) => record.data.questId === currentQuest.id)
  const completionRecord = ownCompletionRecords.find(
    (record) => record.data.questId === currentQuest.id,
  )
  const isSaved = savedRecord?.data.status === 'saved'
  const isOngoing = savedRecord?.data.status === 'ongoing'
  const isCompleted = Boolean(completionRecord) || completedQuestIds.has(currentQuest.id)
  const savedOnlyCount = ownSavedRecords.filter((record) => record.data.status === 'saved').length
  const totalXp = ownCompletionRecords.reduce((sum, record) => sum + record.data.xp, 0)
  const nextLevelXp = 500
  const progressValue = Math.min(100, ((totalXp % nextLevelXp) / nextLevelXp) * 100)
  const syncReady = savedStatus === 'ready' && completionStatus === 'ready'
  const showSignedInRitualHint =
    isSignedIn &&
    completionStatus === 'ready' &&
    ownCompletionRecords.length === 0

  useEffect(() => {
    if (!deckReady || activePool.length === 0) return
    if (currentQuest.id !== currentId) {
      setCurrentId(currentQuest.id)
      setPreviewAnchorId(currentQuest.id)
      return
    }
    if (!activePool.some((quest) => quest.id === previewAnchorId)) {
      setPreviewAnchorId(currentQuest.id)
    }
  }, [activePool, currentId, currentQuest.id, deckReady, previewAnchorId])

  function scrollQuestIntoView() {
    window.requestAnimationFrame(() => {
      questStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function drawQuest(options?: { scrollToQuest?: boolean }) {
    if (activePool.length === 0) {
      warning('No fresh cards match', 'Loosen a filter, or check your log for completed sidequests.')
      return
    }
    const next = getRandomQuest(activePool, currentQuest.id)
    setCurrentId(next.id)
    setPreviewAnchorId(next.id)
    setDeckSeed(createDeckSeed())
    track('shuffle_sidequest', {
      category: next.category,
      difficulty: next.difficulty,
      questId: next.id,
      questTitle: next.title,
      xp: next.xp,
    })
    if (options?.scrollToQuest) {
      scrollQuestIntoView()
    }
  }

  function resetFilters() {
    setDifficulty('any')
    setCategory('any')
    setMode('any')
    setTime('any')
    info('Filters reset')
  }

  function requestAccount(action: string) {
    warning('Sign in to keep progress', `${action} needs a DeepSpace account.`)
    track('sign_in_prompt', { metadata: { action } })
    setAuthOpen(true)
  }

  async function handleSave() {
    if (!isSignedIn) {
      requestAccount('Saving cards')
      return
    }
    if (isCompleted) {
      info('Already completed')
      return
    }
    if (isOngoing) {
      info('Already accepted')
      navigate('/quest-log?focus=ongoing')
      return
    }
    if (isSaved) {
      info('Already saved')
      return
    }

    setPendingAction('save')
    try {
      await savedMutations.create({
        ...questSnapshot(currentQuest),
        userId: '',
        status: 'saved',
        savedAt: new Date().toISOString(),
      })
      track('save_sidequest', {
        category: currentQuest.category,
        difficulty: currentQuest.difficulty,
        questId: currentQuest.id,
        questTitle: currentQuest.title,
        xp: currentQuest.xp,
      })
      success('Card saved')
    } catch (err) {
      error('Could not save card', getErrorMessage(err))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleAccept() {
    if (!isSignedIn) {
      requestAccount('Accepting sidequests')
      return
    }
    if (isCompleted) {
      info('Already completed')
      navigate('/quest-log?focus=memories')
      return
    }
    if (isOngoing) {
      info('Already accepted')
      navigate('/quest-log?focus=ongoing')
      return
    }

    const acceptedAt = new Date().toISOString()
    setPendingAction('accept')
    try {
      if (savedRecord) {
        await savedMutations.put(savedRecord.recordId, {
          status: 'ongoing',
          acceptedAt,
        })
      } else {
        await savedMutations.create({
          ...questSnapshot(currentQuest),
          userId: '',
          status: 'ongoing',
          savedAt: acceptedAt,
          acceptedAt,
        })
      }
      track('accept_sidequest', {
        category: currentQuest.category,
        difficulty: currentQuest.difficulty,
        questId: currentQuest.id,
        questTitle: currentQuest.title,
        xp: currentQuest.xp,
      })
      success('Sidequest accepted')
      navigate('/quest-log?focus=ongoing')
    } catch (err) {
      error('Could not accept sidequest', getErrorMessage(err))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section
          className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)] lg:items-start"
        >
          {isSignedIn ? (
            <div className="grid gap-5 lg:content-start">
              <div className="sidequest-panel flex min-h-[520px] flex-col bg-[oklch(0.98_0.025_93)] p-5 sm:p-7">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Sidequest board
                  </div>
                  <h1
                    data-testid="home-heading"
                    className="sidequest-display max-w-[12ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
                  >
                    Your next little adventure is waiting.
                  </h1>
                  {showSignedInRitualHint && <RitualTrail className="mt-5" />}
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <HeroStat label="XP bank" value={syncReady ? totalXp.toString() : '...'} icon={Trophy} />
                  <HeroStat label="Finished" value={syncReady ? ownCompletionRecords.length.toString() : '...'} icon={BadgeCheck} />
                  <HeroStat label="Saved" value={syncReady ? savedOnlyCount.toString() : '...'} icon={Bookmark} />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm font-extrabold text-[oklch(0.30_0.06_240)]">
                    <span>Next level</span>
                    <span>{syncReady ? `${totalXp % nextLevelXp}/${nextLevelXp} XP` : 'Syncing'}</span>
                  </div>
                  <Progress value={syncReady ? progressValue : 0} className="h-4 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.90_0.05_220)] [&>div]:bg-[oklch(0.70_0.18_205)]" />
                </div>
              </div>

              <QuestCompanionCard category={currentQuest.category} />
            </div>
          ) : (
            <div className="grid gap-5 lg:content-start">
              <SignedOutLanding />
              <QuestCompanionCard category={currentQuest.category} />
            </div>
          )}

          {deckSyncing ? (
            <SyncQuestStage stageRef={questStageRef} />
          ) : noMatches ? (
            <EmptyQuestStage
              reason={emptyReason}
              showReset={hasActiveFilters}
              stageRef={questStageRef}
              onReset={resetFilters}
            />
          ) : (
            <QuestStage
              isCompleted={isCompleted}
              isOngoing={isOngoing}
              isSaved={isSaved}
              isSignedIn={isSignedIn}
              pendingAction={pendingAction}
              quest={currentQuest}
              stageRef={questStageRef}
              syncReady={syncReady}
              onAccept={handleAccept}
              onDraw={() => drawQuest()}
              onSave={handleSave}
            />
          )}
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                Tune the deck
              </h2>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {deckReady
                  ? `${activePool.length} fresh of ${quests.length} cards in play.`
                  : 'Syncing completed cards.'}
              </p>
            </div>
            <Button
              type="button"
              onClick={resetFilters}
              className="sidequest-button bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Reset filters
            </Button>
          </div>

          <div className="mt-5 grid gap-5">
            <ChipGroup
              label="Difficulty"
              options={[
                ['any', 'Any'],
                ['easy', 'Easy'],
                ['medium', 'Medium'],
                ['hard', 'Hard'],
              ]}
              value={difficulty}
              onChange={(value) => setDifficulty(value as FilterValue<QuestDifficulty>)}
            />
            <ChipGroup
              label="Realm"
              options={[
                ['any', 'Any'],
                ['outside', 'Outside'],
                ['people', 'People'],
                ['craft', 'Craft'],
                ['motion', 'Motion'],
                ['mind', 'Mind'],
                ['care', 'Care'],
              ]}
              value={category}
              onChange={(value) => setCategory(value as FilterValue<QuestCategory>)}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <ChipGroup
                label="Party"
                options={[
                  ['any', 'Any'],
                  ['solo', 'Solo'],
                  ['social', 'Social'],
                  ['either', 'Either'],
                ]}
                value={mode}
                onChange={(value) => setMode(value as FilterValue<QuestMode>)}
              />
              <ChipGroup
                label="Time"
                options={[
                  ['any', 'Any'],
                  ['quick', '15 min'],
                  ['short', '30 min'],
                  ['long', '60+ min'],
                ]}
                value={time}
                onChange={(value) => setTime(value as FilterValue<QuestTime>)}
              />
            </div>
          </div>
        </section>

        <QuestPool
          activePool={activePool}
          currentQuest={currentQuest}
          deckSeed={deckSeed}
          deckReady={deckReady}
          freshDeckCount={freshDeckCount}
          previewAnchorId={previewAnchorId}
          onSelect={(questId) => {
            setCurrentId(questId)
          }}
        />
      </div>

      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

export function SignedOutLanding({ subcopy }: { subcopy?: ReactNode }) {
  return (
    <section className="sidequest-panel flex flex-col justify-between overflow-hidden bg-[oklch(0.98_0.025_93)] p-5 sm:p-7 lg:min-h-[520px]">
      <div className="min-w-0">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
          <Sparkles className="h-4 w-4" aria-hidden />
          Sidequest board
        </div>
        <h1
          data-testid="home-heading"
          className="sidequest-display max-w-[10ch] text-5xl font-black leading-[0.94] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
        >
          Bored? Accept a sidequest.
        </h1>
        <p className="mt-5 max-w-xl text-base font-bold leading-7 text-[oklch(0.39_0.055_240)] sm:text-lg sm:leading-8">
          {subcopy ?? (
            <>Browse a fresh real-world prompt from {quests.length} community-sourced cards. Sign in only when a memory is worth keeping.</>
          )}
        </p>
        <RitualTrail className="mt-5" />
      </div>

      <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
        <HeroStat label="Deck" value={quests.length.toString()} icon={Compass} />
        <HeroStat label="Browse" value="Free" icon={Sparkles} />
        <HeroStat label="Saved" value="Later" icon={Bookmark} />
      </div>
    </section>
  )
}

function RitualTrail({ className }: { className?: string }) {
  const steps = ['Browse', 'Accept', 'Do', 'Remember']

  return (
    <div
      className={cn('flex max-w-full flex-wrap items-center gap-1 sm:gap-1.5', className)}
      data-testid="ritual-trail"
      aria-label="Browse, accept, do, remember."
    >
      {steps.map((step, index) => (
        <span key={step} className="inline-flex items-center gap-1 sm:gap-1.5">
          <span className="rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.92_0.055_205)] px-2.5 py-1.5 text-xs font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow sm:px-3 sm:text-sm">
            {step}
          </span>
          {index < steps.length - 1 && (
            <span className="sidequest-display text-lg font-black leading-none text-[oklch(0.31_0.07_240)] sm:text-xl" aria-hidden>
              →
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

export function EmptyQuestStage({
  onReset,
  reason,
  showReset,
  stageRef,
}: {
  onReset: () => void
  reason: 'filters' | 'logged'
  showReset: boolean
  stageRef: RefObject<HTMLElement | null>
}) {
  const isLogged = reason === 'logged'

  return (
    <section ref={stageRef} className="sidequest-panel grid min-h-[520px] content-center overflow-hidden bg-[oklch(0.97_0.025_100)] p-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.88_0.14_338)] sidequest-mini-shadow">
          <Compass className="h-12 w-12 text-[oklch(0.22_0.06_240)]" aria-hidden />
        </div>
        <h2 className="sidequest-display text-4xl font-black leading-none text-[oklch(0.21_0.06_240)] sm:text-5xl">
          {isLogged ? 'This corner is in your log.' : 'No cards in this corner of the map.'}
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {showReset && (
            <Button
              type="button"
              onClick={onReset}
              size="lg"
              className="sidequest-button bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Reset filters
            </Button>
          )}
          {isLogged && (
            <Button
              asChild
              size="lg"
              className="sidequest-button bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
            >
              <Link to="/quest-log">
                <ImagePlus className="h-4 w-4" aria-hidden />
                Open log
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function SyncQuestStage({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  return (
    <section ref={stageRef} className="sidequest-panel grid min-h-[520px] content-center overflow-hidden bg-[oklch(0.97_0.025_100)] p-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.86_0.13_218)] sidequest-mini-shadow">
          <Compass className="h-12 w-12 text-[oklch(0.22_0.06_240)]" aria-hidden />
        </div>
        <h2 className="sidequest-display text-4xl font-black leading-none text-[oklch(0.21_0.06_240)] sm:text-5xl">
          Syncing your deck.
        </h2>
      </div>
    </section>
  )
}

export function QuestCompanionCard({ category }: { category: QuestCategory }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const track = useAnalytics()

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const playMascotAudio = () => {
    track('mascot_tap', { category })
    const previousAudio = audioRef.current
    if (previousAudio) {
      previousAudio.pause()
      previousAudio.currentTime = 0
    }

    const source =
      MASCOT_AUDIO_SOURCES[Math.floor(Math.random() * MASCOT_AUDIO_SOURCES.length)]
    const audio = new Audio(source)
    audio.volume = 0.36
    audioRef.current = audio

    void audio.play().catch(() => {
      audioRef.current = null
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    playMascotAudio()
  }

  return (
    <div
      className="sidequest-scout-card sidequest-panel hidden min-h-[240px] overflow-hidden bg-[oklch(0.86_0.13_218)] p-5 lg:flex lg:items-center lg:justify-center"
      role="button"
      tabIndex={0}
      aria-label="Play mascot sound"
      onClick={playMascotAudio}
      onKeyDown={handleKeyDown}
    >
      <span className="sidequest-scout-ping sidequest-scout-ping-one" />
      <span className="sidequest-scout-ping sidequest-scout-ping-two" />
      <div className="sidequest-scout relative z-10">
        <QuestTotem category={category} />
      </div>
    </div>
  )
}

function QuestStage({
  quest,
  isCompleted,
  isOngoing,
  isSaved,
  isSignedIn,
  pendingAction,
  stageRef,
  syncReady,
  onAccept,
  onDraw,
  onSave,
}: {
  quest: SideQuest
  isCompleted: boolean
  isOngoing: boolean
  isSaved: boolean
  isSignedIn: boolean
  pendingAction: 'save' | 'accept' | null
  stageRef: RefObject<HTMLElement | null>
  syncReady: boolean
  onAccept: () => void
  onDraw: () => void
  onSave: () => void
}) {
  const Icon = quest.icon
  // Same two buttons, same positions, in every state. Only the emphasis swaps:
  // signed-out leads with the free Shuffle, signed-in leads with Accept.
  const shufflePrimary = !isSignedIn && !isCompleted
  const acceptPrimary = isSignedIn && !isCompleted

  return (
    <section
      ref={stageRef}
      data-testid="active-quest-card"
      className="sidequest-panel overflow-hidden bg-[oklch(0.97_0.025_100)]"
    >
      <div className="min-h-[520px] p-4 sm:p-6">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <QuestPill className={categoryStyles[quest.category]}>
                {categoryLabels[quest.category]}
              </QuestPill>
              <QuestPill className={difficultyStyles[quest.difficulty]}>
                {difficultyLabels[quest.difficulty]}
              </QuestPill>
              <QuestPill>{modeLabels[quest.mode]}</QuestPill>
              <QuestPill>{timeLabels[quest.time]}</QuestPill>
            </div>
            <TooltipProvider>
              <div className="flex shrink-0 items-center justify-end gap-1.5">
                <QuestIconAction
                  icon={Bookmark}
                  label={isSaved ? 'Saved to log' : 'Save to log'}
                  loading={pendingAction === 'save'}
                  onClick={onSave}
                  selected={isSaved}
                />
              </div>
            </TooltipProvider>
          </div>

          <div className="flex min-w-0 items-start gap-4">
              <div
                className={cn(
                  'sidequest-icon-tile flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2',
                  categoryStyles[quest.category],
                )}
              >
                <Icon className="h-10 w-10" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {isCompleted && (
                    <Badge className="gap-1.5 rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.70_0.18_205)] px-2.5 py-1 text-[oklch(0.17_0.06_240)]">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      Completed
                    </Badge>
                  )}
                  {isOngoing && !isCompleted && (
                    <Badge className="gap-1.5 rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.92_0.055_205)] px-2.5 py-1 text-[oklch(0.22_0.06_240)]">
                      <Compass className="h-3.5 w-3.5" aria-hidden />
                      Ongoing
                    </Badge>
                  )}
                  {isSaved && !isCompleted && (
                    <Badge className="gap-1.5 rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.86_0.14_150)] px-2.5 py-1 text-[oklch(0.20_0.06_145)]">
                      <Bookmark className="h-3.5 w-3.5" aria-hidden />
                      In log
                    </Badge>
                  )}
                </div>
                <h2
                  data-testid="quest-title"
                  className="sidequest-display text-4xl font-black leading-none tracking-normal text-[oklch(0.21_0.06_240)] sm:text-5xl"
                >
                  {quest.title}
                </h2>
              </div>
            </div>

          <div
            data-testid="accept-sidequest-panel"
            className="mt-5 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sidequest-mini-shadow"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
                {isCompleted ? 'Memory saved' : 'Ready to run it?'}
              </h3>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  data-testid="draw-quest-button"
                  size="lg"
                  onClick={onDraw}
                  className={cn(
                    'sidequest-button',
                    shufflePrimary
                      ? 'bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]'
                      : 'bg-[oklch(0.95_0.03_205)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.92_0.05_205)]',
                  )}
                >
                  <Dices className="h-4 w-4" aria-hidden />
                  Shuffle
                </Button>
                {isCompleted ? (
                  <Button
                    asChild
                    size="lg"
                    className="sidequest-button bg-[oklch(0.88_0.14_338)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.84_0.15_338)]"
                  >
                    <Link to="/quest-log">
                      <ImagePlus className="h-4 w-4" aria-hidden />
                      Open log
                    </Link>
                  </Button>
                ) : (
                  <Button
                    data-testid="accept-quest-button"
                    size="lg"
                    loading={pendingAction === 'accept'}
                    onClick={onAccept}
                    className={cn(
                      'sidequest-button',
                      acceptPrimary
                        ? 'bg-[oklch(0.88_0.14_338)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.84_0.15_338)]'
                        : 'bg-[oklch(0.95_0.03_338)] text-[oklch(0.24_0.07_338)] hover:bg-[oklch(0.92_0.05_338)]',
                    )}
                  >
                    <Trophy className="h-4 w-4" aria-hidden />
                    {isOngoing ? 'Open ongoing' : 'Accept sidequest'}
                  </Button>
                )}
              </div>
            </div>
            {!isSignedIn && (
              <p className="mt-3 text-sm font-bold leading-6 text-[oklch(0.40_0.05_240)]">
                Free to browse and do. Sign in to log your finishes, keep memories, and join the leaderboard.
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatTile icon={Trophy} label="Reward" value={`${quest.xp} XP`} />
            <StatTile icon={Clock3} label="Time" value={quest.estimate} />
            <StatTile icon={Map} label="Place" value={quest.setting} />
          </div>

          <div className="mt-4 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 sidequest-mini-shadow">
            <p className="text-base font-extrabold leading-7 text-[oklch(0.25_0.06_240)]">
              {quest.prompt}
            </p>
          </div>

          {isSignedIn && !syncReady && (
            <p className="mt-4 text-sm font-bold text-muted-foreground">
              Syncing your log.
            </p>
          )}
      </div>

      <div className="grid gap-5 border-t-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sm:p-5 lg:grid-cols-2">
        <Checklist title="Rules" items={quest.rules} />
        <Checklist title="Photo ideas" items={quest.proof} />
      </div>
    </section>
  )
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<[string, string]>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-black uppercase tracking-normal text-[oklch(0.30_0.06_240)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map(([optionValue, optionLabel]) => {
          const active = value === optionValue
          return (
            <button
              key={`${optionValue}-${active ? 'selected' : 'idle'}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(optionValue)}
              onPointerUp={(event) => {
                if (event.pointerType !== 'mouse') {
                  event.currentTarget.blur()
                }
              }}
              className={cn(
                'sidequest-touch-choice rounded-full border-2 border-[oklch(0.31_0.07_240)] px-4 py-2 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] sidequest-chip-shadow'
                  : 'sidequest-choice-neutral',
              )}
            >
              {optionLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function QuestPool({
  activePool,
  currentQuest,
  deckSeed,
  deckReady,
  freshDeckCount,
  previewAnchorId,
  onSelect,
}: {
  activePool: SideQuest[]
  currentQuest: SideQuest
  deckSeed: string
  deckReady: boolean
  freshDeckCount: number | null
  previewAnchorId: string
  onSelect: (questId: string) => void
}) {
  const deckPreview = useMemo(
    () => getDeckPreview(activePool, previewAnchorId, deckSeed),
    [activePool, deckSeed, previewAnchorId],
  )

  return (
    <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
            Deck preview
          </h2>
        </div>
        <Badge className="w-fit rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1 text-[oklch(0.22_0.06_240)]">
          {deckReady ? `${freshDeckCount ?? activePool.length} fresh` : 'Syncing'}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {deckReady && activePool.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 text-sm font-bold text-[oklch(0.32_0.055_240)] md:col-span-2 xl:col-span-3">
            No fresh cards match this deck tuning yet.
          </div>
        )}
        {deckPreview.map((quest) => {
          const selected = quest.id === currentQuest.id
          return (
            <button
              key={`${quest.id}-${selected ? 'selected' : 'idle'}`}
              type="button"
              aria-pressed={selected}
              data-testid="deck-preview-card"
              data-quest-id={quest.id}
              data-quest-title={quest.title}
              onClick={() => onSelect(quest.id)}
              onPointerUp={(event) => {
                if (event.pointerType !== 'mouse') {
                  event.currentTarget.blur()
                }
              }}
              className={cn(
                'deck-preview-card sidequest-touch-choice grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)]',
                  categoryStyles[quest.category],
                )}
              >
                <quest.icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-black text-[oklch(0.22_0.06_240)]">
                  {quest.title}
                </span>
                <span className="block text-sm font-bold text-muted-foreground">
                  {difficultyLabels[quest.difficulty]} · {categoryLabels[quest.category]} · {quest.estimate}
                </span>
              </span>
              <span className="text-sm font-black text-[oklch(0.34_0.055_240)]">{quest.xp}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function QuestPill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border-2 border-[oklch(0.31_0.07_240)] px-3 py-1 text-xs font-black ring-0',
        className ?? 'bg-card text-[oklch(0.30_0.055_240)]',
      )}
    >
      {children}
    </span>
  )
}

function QuestIconAction({
  dataTestId,
  icon: Icon,
  label,
  loading = false,
  onClick,
  selected = false,
}: {
  dataTestId?: string
  icon: ComponentType<{ className?: string }>
  label: string
  loading?: boolean
  onClick: () => void
  selected?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          aria-label={label}
          data-testid={dataTestId}
          data-selected={selected ? 'true' : undefined}
          disabled={loading}
          onClick={onClick}
          size="icon"
          variant="ghost"
          className={cn(
            'sidequest-icon-action h-7 w-7 rounded-md bg-transparent p-0 text-[oklch(0.25_0.06_240)] shadow-none transition-transform hover:-translate-y-0.5 hover:bg-transparent hover:text-[oklch(0.18_0.07_240)] focus-visible:ring-2 focus-visible:ring-ring',
            selected && 'text-[oklch(0.22_0.09_145)]',
          )}
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
          ) : (
            <Icon
              className={cn(
                'sidequest-action-svg !size-7',
                selected && 'sidequest-action-svg-filled',
              )}
              aria-hidden
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="sidequest-display text-xl font-black text-[oklch(0.22_0.06_240)]">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm font-bold leading-6 text-[oklch(0.38_0.05_240)]">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[oklch(0.52_0.14_205)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card p-3 sidequest-mini-shadow">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </div>
      <div className="mt-1 sidequest-display text-3xl font-black leading-none text-[oklch(0.22_0.06_240)]">
        {value}
      </div>
    </div>
  )
}

export function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card p-3 sidequest-mini-shadow">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-base font-black leading-snug text-[oklch(0.22_0.06_240)]">
        {value}
      </div>
    </div>
  )
}

function QuestTotem({ category }: { category: QuestCategory }) {
  return (
    <div className="flex justify-center">
      <svg
        viewBox="0 0 160 180"
        className="h-44 w-40"
        aria-hidden
      >
        <path
          d="M27 132 C24 96 34 50 78 41 C124 32 142 74 132 133 Z"
          fill="oklch(0.91 0.12 88)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M45 70 C55 45 105 45 116 70 C125 96 112 119 80 121 C48 119 35 96 45 70 Z"
          className={categoryGlow[category]}
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M57 95 L80 58 L103 95 L80 86 Z"
          fill="oklch(0.98 0.018 93)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M33 131 H127 L116 153 H44 Z"
          fill="oklch(0.69 0.18 205)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M49 151 H111 L103 166 H57 Z"
          fill="oklch(0.88 0.14 338)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M25 34 L34 51 L17 45 Z"
          fill="oklch(0.87 0.14 91)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M128 22 L139 43 L118 36 Z"
          fill="oklch(0.88 0.14 338)"
          stroke="oklch(0.21 0.06 240)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="47" cy="120" r="5" fill="oklch(0.55 0.16 28)" />
        <circle cx="113" cy="120" r="5" fill="oklch(0.55 0.16 28)" />
      </svg>
    </div>
  )
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Try again in a moment.'
}
