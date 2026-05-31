import type { CollectionSchema } from 'deepspace/worker'

export const analyticsEventsSchema: CollectionSchema = {
  name: 'analytics_events',
  columns: [
    {
      name: 'eventType',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: [
          'page_view',
          'shuffle_sidequest',
          'save_sidequest',
          'accept_sidequest',
          'complete_sidequest',
          'post_memory',
          'cheer_memory',
          'favorite_memory',
          'sign_in_prompt',
          'mascot_tap',
          'deepspace_cta_click',
          'scroll_depth',
        ],
      },
      required: true,
    },
    { name: 'createdAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'sessionId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'userRole', storage: 'text', interpretation: 'plain' },
    { name: 'route', storage: 'text', interpretation: 'plain' },
    { name: 'questId', storage: 'text', interpretation: 'plain' },
    { name: 'questTitle', storage: 'text', interpretation: 'plain' },
    { name: 'category', storage: 'text', interpretation: 'plain' },
    { name: 'difficulty', storage: 'text', interpretation: 'plain' },
    { name: 'xp', storage: 'number', interpretation: 'plain' },
    { name: 'metadata', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: false, create: true, update: false, delete: false },
    viewer: { read: false, create: true, update: false, delete: false },
    member: { read: false, create: true, update: false, delete: false },
    admin: { read: true, create: true, update: false, delete: true },
  },
}
