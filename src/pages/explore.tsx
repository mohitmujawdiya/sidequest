/**
 * Explore — public, auth-free copy of the landing for sharing (e.g. r/InternetIsBeautiful).
 *
 * Same interactive quest deck as the signed-out /home, with every auth trigger removed
 * (no nav, no Sign in, no Accept, no Save). The conversion target is DeepSpace: a persistent
 * "Made with DeepSpace" badge in the header plus a closing in-world quest card.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowUpRight, Clock3, Compass, Dices, Map, RefreshCcw, Sparkles, Trophy } from 'lucide-react'
import { Button, cn } from '../components/ui'
import { useAnalytics } from '../lib/analytics'
import {
  Checklist,
  ChipGroup,
  EmptyQuestStage,
  QuestCompanionCard,
  QuestPill,
  QuestPool,
  SignedOutLanding,
  StatTile,
  createDeckSeed,
  getStableQuest,
} from './home'
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
import { categoryStyles, difficultyStyles } from '../lib/quest-progress'

type FilterValue<T extends string> = T | 'any'

const DEEPSPACE_URL =
  'https://deep.space?utm_source=sidequest&utm_medium=made-with-badge&utm_campaign=reddit'

/** Fires scroll_depth once per 25/50/75/100% milestone. The scroll container is the
 *  <main> in _app.tsx (overflow-y-auto), not window — so listen on the nearest <main>. */
function useScrollDepthTracking(
  rootRef: RefObject<HTMLElement | null>,
  track: ReturnType<typeof useAnalytics>,
) {
  const firedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const root = rootRef.current
    const scroller =
      (root?.closest('main') as HTMLElement | null) ??
      (document.scrollingElement as HTMLElement | null)
    if (!scroller) return

    const milestones = [25, 50, 75, 100]
    let frame = 0
    const measure = () => {
      frame = 0
      const scrollable = scroller.scrollHeight - scroller.clientHeight
      if (scrollable <= 0) return
      const depth = (scroller.scrollTop / scrollable) * 100
      for (const milestone of milestones) {
        if (depth >= milestone && !firedRef.current.has(milestone)) {
          firedRef.current.add(milestone)
          track('scroll_depth', { metadata: { depth: milestone } })
        }
      }
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [rootRef, track])
}

function ExploreHeader({ onDeepSpaceClick }: { onDeepSpaceClick: () => void }) {
  return (
    <header className="relative">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" aria-hidden />
          </span>
          <span className="sidequest-display text-xl font-black tracking-normal text-foreground">
            Sidequest
          </span>
        </div>
        <a
          data-testid="explore-made-with-badge"
          href={DEEPSPACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDeepSpaceClick}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-card px-3 py-1.5 text-sm font-black text-foreground transition-transform hover:-translate-y-0.5 sidequest-mini-shadow"
        >
          Made with DeepSpace
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </header>
  )
}

function DeepSpaceQuestCard({ onClick }: { onClick: () => void }) {
  return (
    <section
      data-testid="explore-deepspace-cta"
      className="sidequest-panel mt-5 overflow-hidden bg-[oklch(0.88_0.14_338)] p-5 sm:p-7"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
            <Sparkles className="h-4 w-4" aria-hidden />
            One more sidequest
          </div>
          <h2 className="sidequest-display max-w-[16ch] text-4xl font-black leading-[0.95] tracking-normal text-[oklch(0.20_0.07_338)] sm:text-5xl">
            Build your own.
          </h2>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-[oklch(0.28_0.07_338)]">
            Sidequest is a real, live app built with DeepSpace. Yours could be next.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="sidequest-button shrink-0 bg-[oklch(0.985_0.018_93)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.95_0.03_338)]"
        >
          <a href={DEEPSPACE_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            Made with DeepSpace
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  )
}

function ShowcaseQuestStage({
  quest,
  stageRef,
  onDraw,
}: {
  quest: SideQuest
  stageRef: RefObject<HTMLElement | null>
  onDraw: () => void
}) {
  const Icon = quest.icon

  return (
    <section
      ref={stageRef}
      data-testid="active-quest-card"
      className="sidequest-panel overflow-hidden bg-[oklch(0.97_0.025_100)]"
    >
      <div className="min-h-[520px] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <QuestPill className={categoryStyles[quest.category]}>{categoryLabels[quest.category]}</QuestPill>
          <QuestPill className={difficultyStyles[quest.difficulty]}>{difficultyLabels[quest.difficulty]}</QuestPill>
          <QuestPill>{modeLabels[quest.mode]}</QuestPill>
          <QuestPill>{timeLabels[quest.time]}</QuestPill>
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
            <h2
              data-testid="quest-title"
              className="sidequest-display text-4xl font-black leading-none tracking-normal text-[oklch(0.21_0.06_240)] sm:text-5xl"
            >
              {quest.title}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile icon={Trophy} label="Reward" value={`${quest.xp} XP`} />
          <StatTile icon={Clock3} label="Time" value={quest.estimate} />
          <StatTile icon={Map} label="Place" value={quest.setting} />
        </div>

        <div className="mt-4 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 sidequest-mini-shadow">
          <p className="text-base font-extrabold leading-7 text-[oklch(0.25_0.06_240)]">{quest.prompt}</p>
        </div>

        <div className="mt-4 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sidequest-mini-shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
              Ready to run it?
            </h3>
            <Button
              data-testid="draw-quest-button"
              size="lg"
              onClick={onDraw}
              className="sidequest-button bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
            >
              <Dices className="h-4 w-4" aria-hidden />
              Shuffle
            </Button>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-[oklch(0.40_0.05_240)]">
            Free to browse, no account needed. Shuffle for another, or head out and do this one.
          </p>
        </div>
      </div>

      <div className="grid gap-5 border-t-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sm:p-5 lg:grid-cols-2">
        <Checklist title="Rules" items={quest.rules} />
        <Checklist title="Photo ideas" items={quest.proof} />
      </div>
    </section>
  )
}

export default function ExplorePage() {
  const track = useAnalytics()
  const [difficulty, setDifficulty] = useState<FilterValue<QuestDifficulty>>('any')
  const [category, setCategory] = useState<FilterValue<QuestCategory>>('any')
  const [mode, setMode] = useState<FilterValue<QuestMode>>('any')
  const [time, setTime] = useState<FilterValue<QuestTime>>('any')
  const [currentId, setCurrentId] = useState(() => getRandomQuest(quests).id)
  const [previewAnchorId, setPreviewAnchorId] = useState(currentId)
  const [deckSeed, setDeckSeed] = useState(() => createDeckSeed())
  const stageRef = useRef<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useScrollDepthTracking(rootRef, track)

  const activePool = useMemo(() => {
    return quests.filter((quest) => {
      if (difficulty !== 'any' && quest.difficulty !== difficulty) return false
      if (category !== 'any' && quest.category !== category) return false
      if (mode !== 'any' && quest.mode !== mode && quest.mode !== 'either') return false
      if (time !== 'any' && quest.time !== time) return false
      return true
    })
  }, [category, difficulty, mode, time])

  const hasActiveFilters =
    difficulty !== 'any' || category !== 'any' || mode !== 'any' || time !== 'any'
  const noMatches = activePool.length === 0
  const currentQuest = useMemo(
    () => activePool.find((quest) => quest.id === currentId) ?? getStableQuest(activePool, currentId) ?? quests[0],
    [activePool, currentId],
  )

  useEffect(() => {
    if (activePool.length === 0) return
    if (currentQuest.id !== currentId) {
      setCurrentId(currentQuest.id)
      setPreviewAnchorId(currentQuest.id)
      return
    }
    if (!activePool.some((quest) => quest.id === previewAnchorId)) {
      setPreviewAnchorId(currentQuest.id)
    }
  }, [activePool, currentId, currentQuest.id, previewAnchorId])

  function drawQuest() {
    if (activePool.length === 0) return
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
  }

  function resetFilters() {
    setDifficulty('any')
    setCategory('any')
    setMode('any')
    setTime('any')
  }

  function trackDeepSpaceClick(placement: 'header' | 'closing-card') {
    track('deepspace_cta_click', { metadata: { placement } })
  }

  return (
    <div ref={rootRef} data-testid="explore-root" className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />
      <ExploreHeader onDeepSpaceClick={() => trackDeepSpaceClick('header')} />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)] lg:items-start">
          <div className="grid gap-5 lg:content-start">
            <SignedOutLanding
              subcopy={`Browse a fresh real-world prompt from ${quests.length} community-sourced cards. Pick one, head out, and come back for the next.`}
            />
            <QuestCompanionCard category={currentQuest.category} />
          </div>

          {noMatches ? (
            <EmptyQuestStage
              reason="filters"
              showReset={hasActiveFilters}
              stageRef={stageRef}
              onReset={resetFilters}
            />
          ) : (
            <ShowcaseQuestStage quest={currentQuest} stageRef={stageRef} onDraw={drawQuest} />
          )}
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                Tune the deck
              </h2>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {`${activePool.length} fresh of ${quests.length} cards in play.`}
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
              options={[['any', 'Any'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]}
              value={difficulty}
              onChange={(value) => setDifficulty(value as FilterValue<QuestDifficulty>)}
            />
            <ChipGroup
              label="Realm"
              options={[['any', 'Any'], ['outside', 'Outside'], ['people', 'People'], ['craft', 'Craft'], ['motion', 'Motion'], ['mind', 'Mind'], ['care', 'Care']]}
              value={category}
              onChange={(value) => setCategory(value as FilterValue<QuestCategory>)}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <ChipGroup
                label="Party"
                options={[['any', 'Any'], ['solo', 'Solo'], ['social', 'Social'], ['either', 'Either']]}
                value={mode}
                onChange={(value) => setMode(value as FilterValue<QuestMode>)}
              />
              <ChipGroup
                label="Time"
                options={[['any', 'Any'], ['quick', '15 min'], ['short', '30 min'], ['long', '60+ min']]}
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
          deckReady={true}
          freshDeckCount={activePool.length}
          previewAnchorId={previewAnchorId}
          onSelect={(questId) => setCurrentId(questId)}
        />

        <DeepSpaceQuestCard onClick={() => trackDeepSpaceClick('closing-card')} />
      </div>
    </div>
  )
}
