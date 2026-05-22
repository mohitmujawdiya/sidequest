import { describe, expect, it, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { actions } from '../src/actions'

const completeSidequest = actions['complete-sidequest']

function success<T>(data: T) {
  return Promise.resolve({ success: true as const, data })
}

function failure(error: string) {
  return Promise.resolve({ success: false as const, error })
}

function savedRecord(overrides: Record<string, unknown> = {}) {
  return {
    recordId: 'saved-1',
    createdBy: 'user-1',
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    data: {
      userId: 'user-1',
      questId: 'quest-1',
      questTitle: 'Test sidequest',
      category: 'mind',
      difficulty: 'easy',
      xp: 100,
      status: 'ongoing',
      savedAt: '2026-05-22T00:00:00.000Z',
      acceptedAt: '2026-05-22T00:00:00.000Z',
      ...overrides,
    },
  }
}

function memoryPhoto() {
  return {
    proofImageKey: 'apps/sidequest/photo.jpg',
    proofImageUrl: '/api/files/apps/sidequest/photo.jpg?scope=app',
    proofImageName: 'photo.jpg',
    proofImageSize: 1024,
    proofImageType: 'image/jpeg',
  }
}

function toolsWith(overrides: Partial<ActionTools> = {}) {
  return {
    create: vi.fn(() => success({ recordId: 'created-1' })),
    update: vi.fn(() => success({ recordId: 'updated-1' })),
    remove: vi.fn(() => success({ recordId: 'removed-1' })),
    get: vi.fn(() => success({ record: savedRecord() })),
    query: vi.fn(() => success({ records: [], count: 0 })),
    integration: vi.fn(),
    registerUser: vi.fn(),
    ...overrides,
  } as unknown as ActionTools
}

function runComplete(params: Record<string, unknown>, tools: ActionTools) {
  return completeSidequest({
    callerJwt: 'jwt',
    env: {} as never,
    params,
    tools,
    userId: 'user-1',
  })
}

describe('complete-sidequest action', () => {
  it('creates a private completion and marks the accepted sidequest completed', async () => {
    const tools = toolsWith()

    const result = await runComplete(
      { savedRecordId: 'saved-1', note: 'Finished it.', shareToCommunity: false },
      tools,
    )

    expect(result).toEqual({ success: true, data: { posted: false, xp: 100 } })
    expect(tools.create).toHaveBeenCalledWith(
      'quest_completions',
      expect.objectContaining({
        proofNote: 'Finished it.',
        questId: 'quest-1',
        userId: '',
      }),
    )
    expect(tools.update).toHaveBeenCalledWith(
      'saved_quests',
      'saved-1',
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('rolls back a newly-created completion if progress cannot be marked completed', async () => {
    const tools = toolsWith({
      update: vi.fn(() => failure('saved update failed')),
    })

    const result = await runComplete({ savedRecordId: 'saved-1' }, tools)

    expect(result).toEqual({ success: false, error: 'saved update failed' })
    expect(tools.remove).toHaveBeenCalledWith('quest_completions', 'created-1')
  })

  it('repairs retry state when the completion already exists', async () => {
    const existingCompletion = {
      recordId: 'completion-1',
      createdBy: 'user-1',
      data: {
        userId: 'user-1',
        questId: 'quest-1',
        questTitle: 'Test sidequest',
        category: 'mind',
        difficulty: 'easy',
        xp: 100,
        completedAt: '2026-05-22T01:00:00.000Z',
      },
    }
    const tools = toolsWith({
      create: vi.fn(() => failure('Duplicate: a record with userId=user-1, questId=quest-1 already exists')),
      query: vi.fn(() => success({ records: [existingCompletion], count: 1 })),
    })

    const result = await runComplete({ savedRecordId: 'saved-1', note: 'Retry note' }, tools)

    expect(result).toEqual({ success: true, data: { posted: false, xp: 100 } })
    expect(tools.update).toHaveBeenCalledWith(
      'quest_completions',
      'completion-1',
      expect.objectContaining({ proofNote: 'Retry note' }),
    )
    expect(tools.update).toHaveBeenCalledWith(
      'saved_quests',
      'saved-1',
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('requires a photo before posting to Community', async () => {
    const tools = toolsWith()

    const result = await runComplete(
      { savedRecordId: 'saved-1', shareToCommunity: true },
      tools,
    )

    expect(result).toEqual({
      success: false,
      error: 'Add a photo before posting this sidequest to Community.',
    })
    expect(tools.get).not.toHaveBeenCalled()
  })

  it('posts to Community when a public memory photo is included', async () => {
    const tools = toolsWith()

    const result = await runComplete(
      {
        memoryPhoto: memoryPhoto(),
        playerName: 'Quest Tester',
        savedRecordId: 'saved-1',
        shareToCommunity: true,
      },
      tools,
    )

    expect(result).toEqual({ success: true, data: { posted: true, xp: 100 } })
    expect(tools.create).toHaveBeenCalledWith(
      'community_posts',
      expect.objectContaining({
        playerName: 'Quest Tester',
        proofImageKey: 'apps/sidequest/photo.jpg',
        userId: '',
      }),
    )
  })
})
