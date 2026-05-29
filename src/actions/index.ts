import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type {
  CommunityPostRecord,
  MemoryPhotoPayload,
  QuestCompletionRecord,
  SavedQuestRecord,
} from '../lib/quest-progress'

interface ToolRecord<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: string
  updatedAt?: string
}

interface CompleteSidequestData {
  posted: boolean
  postError?: string
  xp: number
}

type ActionSuccess<T> = { success: true; data: T }
type ActionFailure = { success: false; error: string }

function ok<T>(data: T): ActionSuccess<T> {
  return { success: true, data }
}

function fail(error: string): ActionFailure {
  return { success: false, error }
}

function getStringParam(params: Record<string, unknown>, key: string) {
  const value = params[key]
  return typeof value === 'string' ? value : ''
}

function getBooleanParam(params: Record<string, unknown>, key: string) {
  return params[key] === true
}

function getMemoryPhotoParam(params: Record<string, unknown>) {
  const value = params.memoryPhoto
  if (!value || typeof value !== 'object') return null
  const photo = value as Partial<MemoryPhotoPayload>
  if (
    typeof photo.proofImageKey !== 'string' ||
    typeof photo.proofImageUrl !== 'string' ||
    typeof photo.proofImageName !== 'string' ||
    typeof photo.proofImageSize !== 'number' ||
    typeof photo.proofImageType !== 'string'
  ) {
    return null
  }
  return {
    proofImageKey: photo.proofImageKey,
    proofImageUrl: photo.proofImageUrl,
    proofImageName: photo.proofImageName,
    proofImageSize: photo.proofImageSize,
    proofImageType: photo.proofImageType,
  } satisfies MemoryPhotoPayload
}

function isOwnRecord(record: ToolRecord<{ userId?: string }>, userId: string) {
  return record.data.userId === userId || record.createdBy === userId
}

function hasDuplicateError(error: string) {
  return error.toLowerCase().includes('duplicate')
}

const completeSidequest: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const savedRecordId = getStringParam(params, 'savedRecordId')
  const caption = getStringParam(params, 'note').trim().slice(0, 240)
  const playerName = getStringParam(params, 'playerName').trim().slice(0, 120) || 'Adventurer'
  const shareToCommunity = getBooleanParam(params, 'shareToCommunity')
  const memoryPhoto = getMemoryPhotoParam(params)

  if (!savedRecordId) return fail('Missing sidequest progress record.')
  if (shareToCommunity && !memoryPhoto) {
    return fail('Add a photo before posting this sidequest to Community.')
  }

  const savedResult = await tools.get('saved_quests', savedRecordId)
  if (!savedResult.success) return fail(savedResult.error)

  const savedRecord = savedResult.data.record as unknown as ToolRecord<SavedQuestRecord>
  if (!isOwnRecord(savedRecord, userId)) {
    return fail('You can only complete your own sidequests.')
  }
  if (savedRecord.data.status === 'completed') {
    return fail('This sidequest is already completed.')
  }
  if (savedRecord.data.status !== 'ongoing') {
    return fail('Accept this sidequest before completing it.')
  }

  const completedAt = new Date().toISOString()
  const completionPayload: QuestCompletionRecord = {
    userId: '',
    questId: savedRecord.data.questId,
    questTitle: savedRecord.data.questTitle,
    category: savedRecord.data.category,
    difficulty: savedRecord.data.difficulty,
    xp: savedRecord.data.xp,
    completedAt,
    proofNote: caption,
    ...(memoryPhoto ?? {}),
  }

  // Step 1: write the completion record. The DO has no multi-record transactions,
  // so steps 1–2 use compensating writes: if step 2 fails we undo step 1.
  let completionRecordId: string | null = null
  let createdCompletion = false
  // Snapshot of fields overwritten in the dedup path, so we can revert if step 2 fails.
  let previousCompletionSnapshot: Record<string, unknown> | null = null

  const completionResult = await tools.create(
    'quest_completions',
    completionPayload as unknown as Record<string, unknown>,
  )

  if (completionResult.success) {
    completionRecordId = completionResult.data.recordId
    createdCompletion = true
  } else if (hasDuplicateError(completionResult.error)) {
    const existingCompletion = await findOwnQuestRecord<QuestCompletionRecord>(
      tools,
      'quest_completions',
      savedRecord.data.questId,
      userId,
    )
    if (!existingCompletion) return fail(completionResult.error)

    completionRecordId = existingCompletion.recordId
    previousCompletionSnapshot = {
      completedAt: existingCompletion.data.completedAt,
      proofNote: existingCompletion.data.proofNote ?? null,
      proofImageKey: existingCompletion.data.proofImageKey ?? null,
      proofImageUrl: existingCompletion.data.proofImageUrl ?? null,
      proofImageName: existingCompletion.data.proofImageName ?? null,
      proofImageSize: existingCompletion.data.proofImageSize ?? null,
      proofImageType: existingCompletion.data.proofImageType ?? null,
    }
    const updateExisting = await tools.update(
      'quest_completions',
      existingCompletion.recordId,
      {
        completedAt: existingCompletion.data.completedAt ?? completedAt,
        proofNote: caption,
        ...(memoryPhoto ?? {}),
      } as Record<string, unknown>,
    )
    if (!updateExisting.success) return fail(updateExisting.error)
  } else {
    return fail(completionResult.error)
  }

  // Step 2: flip the saved quest to 'completed'. If this fails, undo step 1.
  const savedUpdate = await tools.update('saved_quests', savedRecordId, {
    status: 'completed',
    completedAt,
  })
  if (!savedUpdate.success) {
    if (createdCompletion && completionRecordId) {
      await tools.remove('quest_completions', completionRecordId)
    } else if (previousCompletionSnapshot && completionRecordId) {
      await tools.update('quest_completions', completionRecordId, previousCompletionSnapshot)
    }
    return fail(savedUpdate.error)
  }

  if (!shareToCommunity || !memoryPhoto) {
    return ok<CompleteSidequestData>({ posted: false, xp: savedRecord.data.xp })
  }

  // Step 3: community post is best-effort — completion is already committed above.
  const communityPayload: CommunityPostRecord = {
    userId: '',
    questId: savedRecord.data.questId,
    questTitle: savedRecord.data.questTitle,
    category: savedRecord.data.category,
    difficulty: savedRecord.data.difficulty,
    xp: savedRecord.data.xp,
    playerName,
    completedAt,
    sharedAt: completedAt,
    caption,
    ...memoryPhoto,
  }
  const postResult = await tools.create(
    'community_posts',
    communityPayload as unknown as Record<string, unknown>,
  )

  if (postResult.success) {
    return ok<CompleteSidequestData>({ posted: true, xp: savedRecord.data.xp })
  }

  if (hasDuplicateError(postResult.error)) {
    const existingPost = await findOwnQuestRecord<CommunityPostRecord>(
      tools,
      'community_posts',
      savedRecord.data.questId,
      userId,
    )
    if (existingPost) {
      const postUpdate = await tools.update(
        'community_posts',
        existingPost.recordId,
        communityPayload as unknown as Record<string, unknown>,
      )
      if (postUpdate.success) {
        return ok<CompleteSidequestData>({ posted: true, xp: savedRecord.data.xp })
      }
      return ok<CompleteSidequestData>({
        posted: false,
        postError: postUpdate.error,
        xp: savedRecord.data.xp,
      })
    }
  }

  return ok<CompleteSidequestData>({
    posted: false,
    postError: postResult.error,
    xp: savedRecord.data.xp,
  })
}

async function findOwnQuestRecord<T extends { questId: string; userId?: string }>(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  collection: string,
  questId: string,
  userId: string,
) {
  const result = await tools.query(collection, { where: { questId }, limit: 20 })
  if (!result.success) return null

  return (result.data.records as unknown as Array<ToolRecord<T>>).find((record) =>
    isOwnRecord(record, userId),
  ) ?? null
}

export const actions: Record<string, ActionHandler<Env>> = {
  'complete-sidequest': completeSidequest,
}
