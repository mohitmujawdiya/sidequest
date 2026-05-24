import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_LENGTH, validateFeedback } from '../src/lib/feedback'

describe('validateFeedback', () => {
  it('rejects an empty message', () => {
    expect(validateFeedback({ message: '' })).toEqual({
      ok: false,
      error: 'Add a little detail before sending.',
    })
  })

  it('rejects a whitespace-only message', () => {
    expect(validateFeedback({ message: '   \n\t ' }).ok).toBe(false)
  })

  it('rejects a message over the length cap', () => {
    const result = validateFeedback({ message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) })
    expect(result.ok).toBe(false)
    expect(result.error).toContain(String(MAX_MESSAGE_LENGTH))
  })

  it('accepts a message at the length cap', () => {
    expect(validateFeedback({ message: 'x'.repeat(MAX_MESSAGE_LENGTH) })).toEqual({ ok: true })
  })

  it('accepts a normal message', () => {
    expect(validateFeedback({ message: 'Add a quest about leaving a kind note.' })).toEqual({
      ok: true,
    })
  })
})
