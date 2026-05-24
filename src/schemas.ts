/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { analyticsEventsSchema } from './schemas/analytics-schema'
import { feedbackSchema } from './schemas/feedback-schema'
import {
  communityPostsSchema,
  communityReactionsSchema,
  questCompletionsSchema,
  savedQuestsSchema,
} from './schemas/quest-progress-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  savedQuestsSchema,
  questCompletionsSchema,
  communityPostsSchema,
  communityReactionsSchema,
  analyticsEventsSchema,
  feedbackSchema,
]
