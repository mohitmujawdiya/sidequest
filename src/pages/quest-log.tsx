import {
  AuthOverlay,
  getAuthToken,
  useAuth,
  useMutations,
  useQuery,
  useR2Files,
  useUser,
  type RecordData,
} from 'deepspace'
import {
  BadgeCheck,
  Bookmark,
  Camera,
  Compass,
  ImagePlus,
  PencilLine,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState, type ComponentType, type RefObject } from 'react'
import {
  Badge,
  Button,
  Switch,
  Textarea,
  useToast,
} from '../components/ui'
import { cn } from '../components/ui'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { useAnalytics } from '../lib/analytics'
import {
  categoryLabels,
  difficultyLabels,
} from '../data/quests'
import {
  categoryStyles,
  findQuest,
  formatQuestDate,
  getPublicPlayerName,
  getQuestLabel,
  isUserScopedMemoryImageUrl,
  memoryPhotoName,
  resolveMemoryImageUrl,
  validateMemoryPhoto,
  type CommunityReactionRecord,
  type CommunityPostRecord,
  type MemoryPhotoPayload,
  type QuestCompletionRecord,
  type SavedQuestRecord,
  withFileScopeParam,
} from '../lib/quest-progress'

interface CompleteSidequestResult {
  posted: boolean
  postError?: string
  xp: number
}

export default function QuestLogPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { success, error, warning } = useToast()
  const { upload, getUrl } = useR2Files()
  const track = useAnalytics()
  const [searchParams] = useSearchParams()
  const [authOpen, setAuthOpen] = useState(false)
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null)
  const [savingNoteRecordId, setSavingNoteRecordId] = useState<string | null>(null)
  const [completingRecordId, setCompletingRecordId] = useState<string | null>(null)
  const [deletingMemoryRecordId, setDeletingMemoryRecordId] = useState<string | null>(null)
  const [memoryPendingDelete, setMemoryPendingDelete] =
    useState<RecordData<QuestCompletionRecord> | null>(null)
  const ongoingRef = useRef<HTMLElement | null>(null)

  const { records: savedRecords } = useQuery<SavedQuestRecord>('saved_quests', {
    orderBy: 'savedAt',
    orderDir: 'desc',
  })
  const { records: completionRecords } = useQuery<QuestCompletionRecord>('quest_completions', {
    orderBy: 'completedAt',
    orderDir: 'desc',
  })
  const { records: communityRecords } = useQuery<CommunityPostRecord>('community_posts', {
    orderBy: 'sharedAt',
    orderDir: 'desc',
  })
  const { records: reactionRecords } = useQuery<CommunityReactionRecord>('community_reactions', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const savedMutations = useMutations<SavedQuestRecord>('saved_quests')
  const completionMutations = useMutations<QuestCompletionRecord>('quest_completions')
  const communityMutations = useMutations<CommunityPostRecord>('community_posts')
  const reactionMutations = useMutations<CommunityReactionRecord>('community_reactions')
  const ownSavedRecords = useMemo(
    () => (user?.id ? savedRecords.filter((record) => record.data.userId === user.id) : []),
    [savedRecords, user?.id],
  )
  const ownCompletionRecords = useMemo(
    () => (user?.id ? completionRecords.filter((record) => record.data.userId === user.id) : []),
    [completionRecords, user?.id],
  )

  const completions = useMemo(
    () => [...ownCompletionRecords].sort((a, b) => b.data.completedAt.localeCompare(a.data.completedAt)),
    [ownCompletionRecords],
  )
  const savedForLater = useMemo(
    () => ownSavedRecords.filter((record) => record.data.status === 'saved'),
    [ownSavedRecords],
  )
  const ongoingRecords = useMemo(
    () =>
      ownSavedRecords
        .filter((record) => record.data.status === 'ongoing')
        .sort((a, b) =>
          (b.data.acceptedAt ?? b.data.savedAt).localeCompare(a.data.acceptedAt ?? a.data.savedAt),
        ),
    [ownSavedRecords],
  )
  const totalXp = completions.reduce((sum, record) => sum + record.data.xp, 0)
  const photoCount = completions.filter((record) => record.data.proofImageKey || record.data.proofImageUrl).length
  const latestRecord = completions[0]

  useEffect(() => {
    if (searchParams.get('focus') !== 'ongoing') return
    window.requestAnimationFrame(() => {
      ongoingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [searchParams])

  async function buildPhotoPayload(
    questId: string,
    file: File,
    scope: 'self' | 'app' = 'self',
  ): Promise<MemoryPhotoPayload> {
    const fileName = memoryPhotoName(questId, file)
    const result = scope === 'app'
      ? await uploadPublicMemoryPhoto(file, fileName)
      : await upload(file, fileName)
    if (!result.success || !result.key) {
      throw new Error(result.error ?? 'Could not upload memory photo.')
    }
    const url = result.url ?? getUrl(result.key)

    return {
      proofImageKey: result.key,
      proofImageUrl: scope === 'app' ? withFileScopeParam(url, 'app') : url,
      proofImageName: file.name,
      proofImageSize: file.size,
      proofImageType: file.type || 'image/*',
    }
  }

  async function handleMemoryPhoto(record: RecordData<QuestCompletionRecord>, file: File | null) {
    if (!isSignedIn) {
      setAuthOpen(true)
      return
    }
    if (!file) return

    const validationError = validateMemoryPhoto(file)
    if (validationError) {
      warning('Photo not added', validationError)
      return
    }

    setUploadingRecordId(record.recordId)
    try {
      const memoryOwnerId = getRecordOwnerId(record) ?? user?.id
      const publicPosts = communityRecords.filter((communityRecord) => {
        return (
          communityRecord.data.questId === record.data.questId &&
          matchesRecordOwner(communityRecord, memoryOwnerId)
        )
      })
      const payload = await buildPhotoPayload(
        record.data.questId,
        file,
        publicPosts.length > 0 ? 'app' : 'self',
      )
      await Promise.all([
        completionMutations.put(record.recordId, payload),
        ...publicPosts.map((publicPost) => communityMutations.put(publicPost.recordId, payload)),
      ])
      success('Memory photo saved')
    } catch (err) {
      error('Could not save photo', getErrorMessage(err))
    } finally {
      setUploadingRecordId(null)
    }
  }

  async function handleCompleteOngoing({
    file,
    note,
    record,
    shareToCommunity,
  }: {
    file: File | null
    note: string
    record: RecordData<SavedQuestRecord>
    shareToCommunity: boolean
  }) {
    if (!isSignedIn) {
      setAuthOpen(true)
      return
    }
    if (shareToCommunity && !file) {
      warning('Photo required to post', 'Add a photo before posting this sidequest to Community.')
      return
    }

    const caption = note.trim()
    setCompletingRecordId(record.recordId)
    try {
      const memoryPhoto = file
        ? await buildPhotoPayload(record.data.questId, file, shareToCommunity ? 'app' : 'self')
        : null

      const result = await completeSidequestAction({
        memoryPhoto,
        note: caption,
        playerName: getPublicPlayerName(user),
        savedRecordId: record.recordId,
        shareToCommunity,
      })

      track('complete_sidequest', {
        category: record.data.category,
        difficulty: record.data.difficulty,
        metadata: { posted: result.posted, shareToCommunity },
        questId: record.data.questId,
        questTitle: record.data.questTitle,
        xp: record.data.xp,
      })

      if (shareToCommunity && result.posted) {
        track('post_memory', {
          category: record.data.category,
          difficulty: record.data.difficulty,
          questId: record.data.questId,
          questTitle: record.data.questTitle,
          xp: record.data.xp,
        })
        success(`+${result.xp} XP`, 'Completed and posted to Community.')
      } else if (shareToCommunity && result.postError) {
        warning('Completed privately', result.postError)
      } else {
        success(`+${result.xp} XP`, 'Sidequest completed.')
      }
    } catch (err) {
      error('Could not complete sidequest', getErrorMessage(err))
    } finally {
      setCompletingRecordId(null)
    }
  }

  async function handleMemoryNote(record: RecordData<QuestCompletionRecord>, note: string) {
    if (!isSignedIn) {
      setAuthOpen(true)
      return false
    }

    setSavingNoteRecordId(record.recordId)
    try {
      await completionMutations.put(record.recordId, { proofNote: note.trim() })
      success('Memory note saved')
      return true
    } catch (err) {
      error('Could not save note', getErrorMessage(err))
      return false
    } finally {
      setSavingNoteRecordId(null)
    }
  }

  function requestDeleteMemory(record: RecordData<QuestCompletionRecord>) {
    if (!isSignedIn) {
      setAuthOpen(true)
      return
    }
    setMemoryPendingDelete(record)
  }

  async function handleDeleteMemory() {
    const record = memoryPendingDelete
    if (!record) return
    const memoryOwnerId = getRecordOwnerId(record) ?? user?.id
    const completedProgressRecords = ownSavedRecords.filter((savedRecord) => {
      return (
        savedRecord.data.questId === record.data.questId &&
        savedRecord.data.status === 'completed' &&
        matchesRecordOwner(savedRecord, memoryOwnerId)
      )
    })
    const publicPosts = communityRecords.filter((communityRecord) => {
      return (
        communityRecord.data.questId === record.data.questId &&
        matchesRecordOwner(communityRecord, memoryOwnerId)
      )
    })
    const publicPostIds = new Set(publicPosts.map((publicPost) => publicPost.recordId))
    const publicPostReactions = reactionRecords.filter((reaction) =>
      publicPostIds.has(reaction.data.postId),
    )

    setDeletingMemoryRecordId(record.recordId)
    try {
      await Promise.all([
        ...publicPostReactions.map((reaction) => reactionMutations.remove(reaction.recordId)),
        ...publicPosts.map((publicPost) => communityMutations.remove(publicPost.recordId)),
        ...completedProgressRecords.map((progressRecord) => savedMutations.remove(progressRecord.recordId)),
        completionMutations.remove(record.recordId),
      ])
      setMemoryPendingDelete(null)
      success('Memory deleted', 'Back on the board.')
    } catch (err) {
      error('Could not delete memory', getErrorMessage(err))
    } finally {
      setDeletingMemoryRecordId(null)
    }
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="sidequest-panel grid gap-5 bg-[oklch(0.98_0.025_93)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_500px] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
              <Bookmark className="h-4 w-4" aria-hidden />
              Sidequest trail
            </div>
            <h1
              data-testid="quest-log-heading"
              className="sidequest-display max-w-[11ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
            >
              Log
            </h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LogStat label="Ongoing" value={ongoingRecords.length.toString()} icon={Compass} />
            <LogStat label="Total XP" value={totalXp.toString()} icon={Trophy} />
            <LogStat label="Completed" value={completions.length.toString()} icon={BadgeCheck} />
            <LogStat label="Photos" value={photoCount.toString()} icon={Camera} />
          </div>
        </section>

        {!isSignedIn ? (
          <SignedOutLog onSignIn={() => setAuthOpen(true)} />
        ) : (
          <>
            <OngoingRuns
              completingRecordId={completingRecordId}
              ongoingRecords={ongoingRecords}
              sectionRef={ongoingRef}
              onComplete={handleCompleteOngoing}
            />

            <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <SavedShelf savedRecords={savedForLater} className="lg:order-2" />

              <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5 lg:order-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                      Memories
                    </h2>
                  </div>
                  {latestRecord && (
                    <Badge className="w-fit rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1 text-[oklch(0.22_0.06_240)]">
                      Latest: {formatQuestDate(latestRecord.data.completedAt)}
                    </Badge>
                  )}
                </div>

                <div data-testid="quest-memory-grid" className="mt-5 grid gap-4 md:grid-cols-2">
                  {completions.map((record) => (
                    <MemoryCard
                      key={record.recordId}
                      imageUrl={resolveMemoryImageUrl(record.data, getUrl)}
                      isDeleting={deletingMemoryRecordId === record.recordId}
                      isSavingNote={savingNoteRecordId === record.recordId}
                      isUploading={uploadingRecordId === record.recordId}
                      record={record}
                      onDelete={() => requestDeleteMemory(record)}
                      onNoteSaved={(note) => handleMemoryNote(record, note)}
                      onPhotoSelected={(file) => handleMemoryPhoto(record, file)}
                    />
                  ))}
                  {completions.length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.91_0.12_88)] p-5 text-sm font-bold leading-6 text-[oklch(0.32_0.055_240)] md:col-span-2">
                      Finish a run and the first memory card appears here.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <DeleteConfirmDialog
        open={Boolean(memoryPendingDelete)}
        loading={Boolean(memoryPendingDelete && deletingMemoryRecordId === memoryPendingDelete.recordId)}
        title="Delete memory?"
        description="This removes the memory and any matching Community post. The sidequest can appear on the Board again."
        confirmText="Delete memory"
        onConfirm={handleDeleteMemory}
        onOpenChange={(open) => {
          if (!open && !deletingMemoryRecordId) setMemoryPendingDelete(null)
        }}
      />
      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

function OngoingRuns({
  completingRecordId,
  ongoingRecords,
  sectionRef,
  onComplete,
}: {
  completingRecordId: string | null
  ongoingRecords: RecordData<SavedQuestRecord>[]
  sectionRef: RefObject<HTMLElement | null>
  onComplete: (payload: {
    file: File | null
    note: string
    record: RecordData<SavedQuestRecord>
    shareToCommunity: boolean
  }) => void
}) {
  return (
    <section
      ref={sectionRef}
      data-testid="ongoing-quests"
      className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
            Ongoing
          </h2>
          {ongoingRecords.length > 0 && (
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {ongoingRecords.length} in motion
            </p>
          )}
        </div>
        <Button
          asChild
          className="sidequest-button w-fit bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
        >
          <Link to="/home">
            <Compass className="h-4 w-4" aria-hidden />
            Board
          </Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {ongoingRecords.map((record) => (
          <OngoingQuestCard
            key={record.recordId}
            isCompleting={completingRecordId === record.recordId}
            record={record}
            onComplete={(payload) => onComplete({ ...payload, record })}
          />
        ))}
        {ongoingRecords.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.92_0.055_205)] p-5 text-sm font-bold leading-6 text-[oklch(0.32_0.055_240)] xl:col-span-2">
            No ongoing sidequests.
          </div>
        )}
      </div>
    </section>
  )
}

function OngoingQuestCard({
  isCompleting,
  record,
  onComplete,
}: {
  isCompleting: boolean
  record: RecordData<SavedQuestRecord>
  onComplete: (payload: { file: File | null; note: string; shareToCommunity: boolean }) => void
}) {
  const { warning } = useToast()
  const quest = findQuest(record.data.questId)
  const Icon = quest?.icon ?? Compass
  const [noteDraft, setNoteDraft] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [shareToCommunity, setShareToCommunity] = useState(false)
  const photoPreviewUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  )

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  function handlePhotoSelected(file: File | null) {
    if (!file) {
      setPhotoFile(null)
      return
    }

    const validationError = validateMemoryPhoto(file)
    if (validationError) {
      warning('Photo not added', validationError)
      return
    }

    setPhotoFile(file)
  }

  return (
    <article className="grid gap-5 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card p-4 sidequest-mini-shadow lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="min-w-0">
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] sidequest-mini-shadow',
            categoryStyles[record.data.category],
          )}
        >
          <Icon className="h-8 w-8" aria-hidden />
        </div>
        <h3 className="sidequest-display text-3xl font-black leading-none text-[oklch(0.22_0.06_240)]">
          {record.data.questTitle}
        </h3>
        <p className="mt-2 text-sm font-bold text-muted-foreground">
          {getQuestLabel(record.data)} · {record.data.xp} XP
        </p>
      </div>

      <div className="grid min-w-0 gap-4">
        <RunPhotoPicker
          disabled={isCompleting}
          file={photoFile}
          previewUrl={photoPreviewUrl}
          onChange={handlePhotoSelected}
        />

        <div>
          <label
            htmlFor={`ongoing-note-${record.recordId}`}
            className="text-sm font-black uppercase tracking-normal text-[oklch(0.31_0.07_240)]"
          >
            Run note
          </label>
          <Textarea
            id={`ongoing-note-${record.recordId}`}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Optional: what happened?"
            className="mt-2 min-h-24 resize-none border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] font-bold"
            maxLength={240}
          />
          <div className="mt-1 text-right text-xs font-bold text-muted-foreground">
            {noteDraft.length}/240
          </div>
        </div>

        <div className="rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.92_0.055_205)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label
                htmlFor={`share-community-${record.recordId}`}
                className="text-sm font-black uppercase tracking-normal text-[oklch(0.31_0.07_240)]"
              >
                Post to Community
              </label>
              {shareToCommunity && !photoFile && (
                <p className="mt-2 rounded-md border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] px-3 py-2 text-xs font-black leading-5 text-[oklch(0.25_0.06_240)]">
                  Add a photo before posting this sidequest.
                </p>
              )}
            </div>
            <Switch
              id={`share-community-${record.recordId}`}
              checked={shareToCommunity}
              disabled={isCompleting}
              onCheckedChange={setShareToCommunity}
              className="mt-1 data-[state=checked]:bg-[oklch(0.68_0.18_205)] data-[state=unchecked]:bg-[oklch(0.72_0.03_240)]"
            />
          </div>
        </div>

        <Button
          data-testid="complete-quest-button"
          size="lg"
          loading={isCompleting}
          onClick={() => onComplete({ file: photoFile, note: noteDraft, shareToCommunity })}
          className="sidequest-button bg-[oklch(0.88_0.14_338)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.84_0.15_338)]"
        >
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {shareToCommunity ? 'Complete + post' : 'Complete sidequest'}
        </Button>
      </div>
    </article>
  )
}

function RunPhotoPicker({
  disabled,
  file,
  previewUrl,
  onChange,
}: {
  disabled: boolean
  file: File | null
  previewUrl: string | null
  onChange: (file: File | null) => void
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-sm font-black uppercase tracking-normal text-[oklch(0.31_0.07_240)]">
        Photo
      </div>
      {previewUrl ? (
        <div className="overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card sidequest-mini-shadow">
          <div className="relative grid h-52 place-items-center overflow-hidden bg-[oklch(0.92_0.055_205)] sm:h-60 lg:h-64">
            <img
              src={previewUrl}
              alt={file?.name ? `Selected photo: ${file.name}` : 'Selected photo'}
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[oklch(0.21_0.06_240)] bg-[oklch(0.98_0.018_93)] text-[oklch(0.22_0.06_240)] shadow-[0_3px_0_0_oklch(0.21_0.06_240_/_0.22)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm font-black text-[oklch(0.22_0.06_240)]">
              <span className="block truncate">{file?.name}</span>
            </div>
            <label className="sidequest-button inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-[oklch(0.89_0.14_88)] px-3 text-sm font-black text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)] sm:w-auto">
              <ImagePlus className="h-4 w-4" aria-hidden />
              Replace
              <input
                type="file"
                accept="image/*"
                disabled={disabled}
                className="sr-only"
                onChange={(event) => {
                  onChange(event.currentTarget.files?.[0] ?? null)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.92_0.055_205)] p-4 text-[oklch(0.24_0.06_240)] transition-transform hover:-translate-y-0.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.86_0.15_145)] sidequest-mini-shadow">
            <ImagePlus className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black">Add a photo</span>
            <span className="mt-1 block text-sm font-bold text-[oklch(0.36_0.055_240)]">
              Optional privately, required for Community.
            </span>
          </span>
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              onChange(event.currentTarget.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}

function MemoryCard({
  imageUrl,
  isDeleting,
  isSavingNote,
  isUploading,
  record,
  onDelete,
  onNoteSaved,
  onPhotoSelected,
}: {
  imageUrl: string | null
  isDeleting: boolean
  isSavingNote: boolean
  isUploading: boolean
  record: RecordData<QuestCompletionRecord>
  onDelete: () => void
  onNoteSaved: (note: string) => Promise<boolean>
  onPhotoSelected: (file: File | null) => void
}) {
  const quest = findQuest(record.data.questId)
  const Icon = quest?.icon ?? Compass
  const [noteDraft, setNoteDraft] = useState(record.data.proofNote ?? '')
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const savedNote = record.data.proofNote ?? ''
  const noteChanged = noteDraft.trim() !== savedNote.trim()

  useEffect(() => {
    setNoteDraft(record.data.proofNote ?? '')
  }, [record.data.proofNote, record.recordId])

  function cancelNoteEdit() {
    setNoteDraft(savedNote)
    setNoteEditorOpen(false)
  }

  async function saveNote() {
    const saved = await onNoteSaved(noteDraft)
    if (saved) {
      setNoteEditorOpen(false)
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card sidequest-mini-shadow">
      <div className="relative aspect-[4/3] bg-[oklch(0.86_0.13_218)]">
        {imageUrl ? (
          <MemoryCardImage
            alt={`Memory from ${record.data.questTitle}`}
            imageUrl={imageUrl}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <div
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] sidequest-mini-shadow',
                categoryStyles[record.data.category],
              )}
            >
              <Icon className="h-12 w-12" aria-hidden />
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.98_0.018_93)] px-2.5 py-1 text-[oklch(0.22_0.06_240)]">
            {record.data.xp} XP
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 className="sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
              {record.data.questTitle}
            </h3>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              {getQuestLabel(record.data)} · {formatQuestDate(record.data.completedAt)}
            </p>
          </div>
        </div>

        {savedNote && !noteEditorOpen && (
          <div className="mt-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] p-3">
            <p className="text-sm font-extrabold leading-6 text-[oklch(0.25_0.06_240)]">
              {savedNote}
            </p>
          </div>
        )}

        {noteEditorOpen && (
          <div className="mt-3">
            <label
              htmlFor={`memory-note-${record.recordId}`}
              className="text-xs font-black uppercase tracking-normal text-[oklch(0.31_0.07_240)]"
            >
              Memory note
            </label>
            <Textarea
              id={`memory-note-${record.recordId}`}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add what happened."
              maxLength={240}
              disabled={isDeleting || isSavingNote}
              className="mt-2 min-h-20 resize-none border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] text-sm font-extrabold leading-6 text-[oklch(0.25_0.06_240)]"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-muted-foreground">
                {noteDraft.length}/240
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isDeleting || isSavingNote}
                  onClick={cancelNoteEdit}
                  className="sidequest-button bg-[oklch(0.98_0.018_93)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.92_0.055_205)]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!noteChanged || isDeleting}
                  loading={isSavingNote}
                  onClick={saveNote}
                  className="sidequest-button bg-[oklch(0.86_0.15_145)] text-[oklch(0.17_0.06_150)] hover:bg-[oklch(0.82_0.16_145)]"
                >
                  Save note
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!noteEditorOpen && (
            <Button
              type="button"
              size="sm"
              disabled={isDeleting}
              onClick={() => setNoteEditorOpen(true)}
              className="sidequest-button bg-[oklch(0.86_0.15_145)] text-[oklch(0.17_0.06_150)] hover:bg-[oklch(0.82_0.16_145)]"
            >
              <PencilLine className="h-4 w-4" aria-hidden />
              {savedNote ? 'Edit note' : 'Add note'}
            </Button>
          )}
          <label
            className={cn(
              'sidequest-button inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-[oklch(0.89_0.14_88)] px-3 text-xs font-black text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]',
              (isUploading || isDeleting) && 'pointer-events-none opacity-70',
            )}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {isUploading ? 'Saving photo' : imageUrl ? 'Replace photo' : 'Add photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={isUploading || isDeleting}
              onChange={(event) => {
                onPhotoSelected(event.currentTarget.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <Button
            type="button"
            size="sm"
            loading={isDeleting}
            onClick={onDelete}
            aria-label={`Delete memory for ${record.data.questTitle}`}
            className="sidequest-button bg-[oklch(0.95_0.06_30)] text-[oklch(0.34_0.11_28)] hover:bg-[oklch(0.91_0.08_30)]"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        </div>
      </div>
    </article>
  )
}

function MemoryCardImage({ alt, imageUrl }: { alt: string; imageUrl: string }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() =>
    isUserScopedMemoryImageUrl(imageUrl) ? null : imageUrl,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setFailed(false)

    if (!isUserScopedMemoryImageUrl(imageUrl)) {
      setResolvedUrl(imageUrl)
      return undefined
    }

    setResolvedUrl(null)

    async function loadPrivateImage() {
      const token = await getAuthToken()
      if (!token) throw new Error('Missing auth token')

      const response = await fetch(imageUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Could not load memory photo')

      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      if (cancelled) {
        URL.revokeObjectURL(objectUrl)
      } else {
        setResolvedUrl(objectUrl)
      }
    }

    void loadPrivateImage().catch(() => {
      if (!cancelled) setFailed(true)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  if (!resolvedUrl || failed) return null

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function SavedShelf({
  savedRecords,
  className,
}: {
  savedRecords: RecordData<SavedQuestRecord>[]
  className?: string
}) {
  return (
    <aside className={cn('sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5', className)}>
      <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
        Saved cards
      </h2>

      <div className="mt-4 space-y-3">
        {savedRecords.map((record) => {
          const quest = findQuest(record.data.questId)
          const Icon = quest?.icon ?? Compass
          return (
            <div
              key={record.recordId}
              className="grid grid-cols-[44px_1fr] gap-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card p-3"
            >
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)]',
                  categoryStyles[record.data.category],
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[oklch(0.22_0.06_240)]">
                  {record.data.questTitle}
                </span>
                <span className="mt-1 block text-xs font-bold text-muted-foreground">
                  {difficultyLabels[record.data.difficulty]} · {categoryLabels[record.data.category]} · {record.data.xp} XP
                </span>
              </span>
            </div>
          )
        })}
        {savedRecords.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 text-sm font-bold leading-6 text-[oklch(0.32_0.055_240)]">
            No saved cards yet.
          </div>
        )}
      </div>
    </aside>
  )
}

function SignedOutLog({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="sidequest-panel mt-5 grid min-h-[420px] content-center bg-[oklch(0.97_0.025_100)] p-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.88_0.14_338)] sidequest-mini-shadow">
          <Bookmark className="h-12 w-12 text-[oklch(0.22_0.06_240)]" aria-hidden />
        </div>
        <h2 className="sidequest-display text-4xl font-black leading-none text-[oklch(0.21_0.06_240)] sm:text-5xl">
          Your log is waiting.
        </h2>
        <p className="mt-4 text-base font-bold leading-7 text-[oklch(0.34_0.055_240)]">
          Sign in to keep finished runs, notes, and memory photos together.
        </p>
        <Button
          type="button"
          onClick={onSignIn}
          size="lg"
          className="sidequest-button mt-6 bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
        >
          <Compass className="h-4 w-4" aria-hidden />
          Sign in
        </Button>
      </div>
    </section>
  )
}

function LogStat({
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

function getRecordOwnerId(record: RecordData<{ userId?: string }>) {
  return record.data.userId?.trim() || record.createdBy
}

function matchesRecordOwner(record: RecordData<{ userId?: string }>, ownerId?: string) {
  const recordOwnerId = getRecordOwnerId(record)
  if (!ownerId && !recordOwnerId) return true
  if (!ownerId || !recordOwnerId) return false
  return recordOwnerId === ownerId
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Try again in a moment.'
}

async function completeSidequestAction({
  memoryPhoto,
  note,
  playerName,
  savedRecordId,
  shareToCommunity,
}: {
  memoryPhoto: MemoryPhotoPayload | null
  note: string
  playerName: string
  savedRecordId: string
  shareToCommunity: boolean
}) {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Sign in again before completing this sidequest.')
  }

  const response = await fetch('/api/actions/complete-sidequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      memoryPhoto,
      note,
      playerName,
      savedRecordId,
      shareToCommunity,
    }),
  })
  const result = await response.json().catch(() => null) as
    | { success: true; data: CompleteSidequestResult }
    | { success: false; error: string }
    | null

  if (!response.ok) {
    throw new Error(result && 'error' in result ? result.error : 'Could not complete sidequest.')
  }
  if (!result?.success) {
    throw new Error(result?.error ?? 'Could not complete sidequest.')
  }

  return result.data
}

async function uploadPublicMemoryPhoto(file: File, name: string) {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Sign in again before posting a public memory.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', name)

  const response = await fetch('/api/files/upload?scope=app', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  return response.json() as Promise<{
    success: boolean
    key?: string
    url?: string
    error?: string
  }>
}
