import type { CollectionSchema } from 'deepspace/worker'

/**
 * Public feedback / sidequest suggestions.
 *
 * Anyone (including unauthenticated visitors via the '*' key) may create a
 * submission; only admins can read them. No ownerField: submitters never read
 * their feedback back, and the admin inbox reads everything via useQuery.
 */
export const feedbackSchema: CollectionSchema = {
  name: 'feedback',
  columns: [
    {
      name: 'type',
      storage: 'text',
      interpretation: { kind: 'select', options: ['sidequest', 'improvement'] },
      required: true,
      default: 'sidequest',
    },
    { name: 'message', storage: 'text', interpretation: 'plain', required: true },
    { name: 'name', storage: 'text', interpretation: 'plain' },
    { name: 'createdAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
  ],
  permissions: {
    '*': { read: false, create: true, update: false, delete: false },
    viewer: { read: false, create: true, update: false, delete: false },
    member: { read: false, create: true, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
