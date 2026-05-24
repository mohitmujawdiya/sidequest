/** Shared types, constants, and validation for the feedback feature. */

export const FEEDBACK_TYPES = ['sidequest', 'improvement'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const feedbackTypeLabels: Record<FeedbackType, string> = {
  sidequest: 'Sidequest idea',
  improvement: 'Improvement or bug',
}

export const MAX_MESSAGE_LENGTH = 1000
export const MAX_NAME_LENGTH = 60

/** Shape of a feedback record, used for useQuery / useMutations typing. */
export interface FeedbackRecord {
  type: FeedbackType
  message: string
  name?: string
  createdAt: string
}

export interface FeedbackValidationResult {
  ok: boolean
  error?: string
}

/** Pure validation for a submission. Trimmed message must be non-empty and within the cap. */
export function validateFeedback(input: { message: string }): FeedbackValidationResult {
  const message = input.message.trim()
  if (message.length === 0) {
    return { ok: false, error: 'Add a little detail before sending.' }
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep it under ${MAX_MESSAGE_LENGTH} characters.` }
  }
  return { ok: true }
}
