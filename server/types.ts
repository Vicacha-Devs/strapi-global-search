export interface PluginSettings {
  minChars: number;
  debounce: number;
  perTypeLimit: number;
  maxResults: number;
  deep: boolean;
  maxDepth: number;
  includeDrafts: boolean;
  queryTimeout: number;
  concurrency: number;
  excludedContentTypes: string[];
  excludedFields: string[];
  displayFields: Record<string, string[]>;
}

export type ContentTypeKind = 'collectionType' | 'singleType';

export interface ContentTypeDescriptor {
  uid: string;
  kind: ContentTypeKind | string;
  displayName: string;
  apiName?: string;
  mainField: string;
  idFields: string[];
  topLevelFields: string[];
  nestedFields: string[];
  /** Searchable paths backed by `customField` attributes; dropped on a query retry if they break it. */
  customFieldPaths?: string[];
  localized: boolean;
  draftAndPublish: boolean;
  searchable: boolean;
}

export interface RankedHit {
  tier: number;
  tierLabel: string;
  matchedField: string | null;
  matchedFieldLabel: string | null;
  matchedSnippet: string | null;
  exactCase: boolean;
  valueLength: number;
  contentTypeUid: string;
  contentTypeLabel: string;
  kind: string;
  id: string | number;
  documentId: string | null;
  title: string;
  mainField: string;
  extra: Array<{ field: string; value: unknown }>;
  locale: string | null;
  status: 'published' | 'draft' | null;
  updatedAt: string | null;
  adminUrl: string;
}

export interface SearchParams {
  query?: string;
  types?: string[];
  locale?: string;
  page?: number;
  pageSize?: number;
  userAbility?: { can: (action: string, subject: string) => boolean } | null;
}

export interface SearchResult {
  query: string;
  results: RankedHit[];
  groups: Array<{ uid: string; label: string; kind: string; count: number; truncated: boolean }>;
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  meta: {
    searchedTypes: number;
    truncatedTypes: string[];
    failedTypes: Array<{ uid: string; message: string }>;
    minChars: number;
    capped?: boolean;
  };
}

/** Minimal Strapi-like shape used by services */
export interface StrapiLike {
  contentTypes: Record<string, any>;
  components: Record<string, any>;
  config: { get: (key: string, defaultValue?: unknown) => any };
  store: (opts: { type: string; name: string }) => {
    get: (opts: { key: string }) => Promise<any>;
    set: (opts: { key: string; value: unknown }) => Promise<void>;
  };
  log: { debug: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  plugin: (id: string) => { service: (name: string) => any };
  documents: (uid: string) => { findMany: (params: unknown) => Promise<any> };
  admin?: { services: { permission: { actionProvider: { registerMany: (actions: unknown[]) => void } } } };
}
