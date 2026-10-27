export const PLUGIN_ID = 'global-search';

/**
 * Attribute types whose stored value is a plain string, i.e. the ones the query
 * engine can match with `$containsi`.
 */
export const SEARCHABLE_SCALAR_TYPES = [
  'string',
  'text',
  'richtext',
  'customField',
  'uid',
  'email',
  'enumeration',
];

/**
 * Internal Strapi system/infrastructure plugin UID prefixes that should not be
 * indexed as user-facing Content-Manager content types by default.
 */
export const SYSTEM_PLUGIN_PREFIXES = [
  'plugin::upload.',
  'plugin::i18n.',
  'plugin::users-permissions.',
  'plugin::content-releases.',
  'plugin::review-workflows.',
  'plugin::global-search.',
];

/**
 * Attribute types we deliberately never walk into.
 * - dynamiczone / blocks: the query engine cannot filter polymorphic JSON.
 * - relation / media: would explode the join graph; relations are shown, not searched.
 */
export const SKIPPED_ATTRIBUTE_TYPES = ['dynamiczone', 'blocks', 'json', 'relation', 'media', 'password'];

/** Attribute names that must never leave the server, whatever their type. */
export const BLOCKLISTED_ATTRIBUTE_NAMES = [
  'password',
  'resetPasswordToken',
  'registrationToken',
  'confirmationToken',
];

/**
 * String attributes that identify an entry. `id` is numeric and handled
 * separately. `documentId` is always queried in Strapi 5 even when it is not
 * declared on the schema.
 */
export const IDENTIFIER_FIELDS = ['uid', 'slug', 'code', 'key'];

/** Used when the Content-Manager configuration has no mainField for a type. */
export const MAIN_FIELD_FALLBACKS = [
  'name',
  'title',
  'label',
  'displayName',
  'heading',
  'subject',
  'slug',
];

/** Ranking tiers — lower wins. Mirrors the documented ordering rule. */
export const TIER = {
  ID_EXACT: 0,
  ID_CONTAINS: 1,
  MAIN_EXACT: 2,
  MAIN_STARTS_WITH: 3,
  MAIN_CONTAINS: 4,
  FIELD_CONTAINS: 5,
  NESTED_CONTAINS: 6,
  UNKNOWN: 7,
};

export const TIER_LABELS: Record<number, string> = {
  0: 'id:exact',
  1: 'id:partial',
  2: 'name:exact',
  3: 'name:starts-with',
  4: 'name:partial',
  5: 'field',
  6: 'nested-field',
  7: 'other',
};

export const MAX_QUERY_LENGTH = 200;
export const SNIPPET_RADIUS = 45;
