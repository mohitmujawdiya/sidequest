import type { CollectionSchema } from 'deepspace/worker'

const usersColumns = [
  { name: 'email', storage: 'text', interpretation: 'plain' },
  { name: 'name', storage: 'text', interpretation: 'plain' },
  { name: 'imageUrl', storage: 'text', interpretation: 'plain' },
  { name: 'role', storage: 'text', interpretation: 'plain' },
  { name: 'createdAt', storage: 'text', interpretation: { kind: 'datetime' } },
  { name: 'lastSeenAt', storage: 'text', interpretation: { kind: 'datetime' } },
] satisfies CollectionSchema['columns']

export const usersSchema: CollectionSchema = {
  name: 'users',
  columns: usersColumns,
  permissions: {
    viewer: { read: 'own', create: false, update: 'own', delete: false },
    member: { read: true, create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}
