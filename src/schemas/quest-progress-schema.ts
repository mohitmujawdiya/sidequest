import type { CollectionSchema } from 'deepspace/worker'

const questSnapshotColumns = [
  { name: 'questId', storage: 'text', interpretation: 'plain', required: true },
  { name: 'questTitle', storage: 'text', interpretation: 'plain', required: true },
  {
    name: 'category',
    storage: 'text',
    interpretation: { kind: 'select', options: ['mind', 'craft', 'outside', 'people', 'motion', 'care'] },
    required: true,
  },
  {
    name: 'difficulty',
    storage: 'text',
    interpretation: { kind: 'select', options: ['easy', 'medium', 'hard'] },
    required: true,
  },
  { name: 'xp', storage: 'number', interpretation: 'plain', required: true },
] satisfies CollectionSchema['columns']

export const savedQuestsSchema: CollectionSchema = {
  name: 'saved_quests',
  ownerField: 'userId',
  uniqueOn: ['userId', 'questId'],
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    ...questSnapshotColumns,
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['saved', 'ongoing', 'completed'] },
      required: true,
      default: 'saved',
    },
    { name: 'savedAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'acceptedAt', storage: 'text', interpretation: { kind: 'datetime' } },
    { name: 'completedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  permissions: {
    '*': { read: 'own', create: false, update: false, delete: false },
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

export const questCompletionsSchema: CollectionSchema = {
  name: 'quest_completions',
  ownerField: 'userId',
  uniqueOn: ['userId', 'questId'],
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    ...questSnapshotColumns,
    { name: 'completedAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'proofNote', storage: 'text', interpretation: 'plain' },
    { name: 'proofImageKey', storage: 'text', interpretation: 'plain' },
    { name: 'proofImageUrl', storage: 'text', interpretation: { kind: 'url' } },
    { name: 'proofImageName', storage: 'text', interpretation: 'plain' },
    { name: 'proofImageSize', storage: 'number', interpretation: 'plain' },
    { name: 'proofImageType', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: 'own', create: false, update: false, delete: false },
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    admin: { read: 'own', create: true, update: 'own', delete: 'own' },
  },
}

export const communityPostsSchema: CollectionSchema = {
  name: 'community_posts',
  ownerField: 'userId',
  uniqueOn: ['userId', 'questId'],
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    ...questSnapshotColumns,
    { name: 'playerName', storage: 'text', interpretation: 'plain' },
    { name: 'completedAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'sharedAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
    { name: 'caption', storage: 'text', interpretation: 'plain' },
    { name: 'proofImageKey', storage: 'text', interpretation: 'plain', required: true },
    { name: 'proofImageUrl', storage: 'text', interpretation: { kind: 'url' }, required: true },
    { name: 'proofImageName', storage: 'text', interpretation: 'plain' },
    { name: 'proofImageSize', storage: 'number', interpretation: 'plain' },
    { name: 'proofImageType', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const communityReactionsSchema: CollectionSchema = {
  name: 'community_reactions',
  ownerField: 'userId',
  uniqueOn: ['userId', 'postId', 'kind'],
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'postId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'kind',
      storage: 'text',
      interpretation: { kind: 'select', options: ['cheer', 'favorite'] },
      required: true,
    },
    { name: 'createdAt', storage: 'text', interpretation: { kind: 'datetime' }, required: true },
  ],
  permissions: {
    '*': { read: true, create: false, update: false, delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
