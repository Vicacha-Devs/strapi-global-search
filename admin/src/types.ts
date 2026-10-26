export interface PluginSettings {
  minChars: number;
  debounce: number;
  perTypeLimit: number;
  maxResults: number;
  deep: boolean;
  maxDepth: number;
  includeDrafts: boolean;
  includePluginContentTypes: boolean;
  queryTimeout: number;
  concurrency: number;
  excludedContentTypes: string[];
  excludedFields: string[];
  displayFields: Record<string, string[]>;
}

export interface ContentTypeSummary {
  uid: string;
  kind: string;
  displayName: string;
  mainField: string;
  localized: boolean;
  draftAndPublish: boolean;
  fieldCount: number;
  searchable: boolean;
  excluded?: boolean;
  fields?: string[];
}

export interface SearchHit {
  contentTypeUid: string;
  contentTypeLabel: string;
  kind: string;
  id: string | number;
  documentId: string | null;
  title: string;
  mainField: string;
  matchedField: string | null;
  matchedFieldLabel: string | null;
  matchedSnippet: string | null;
  locale: string | null;
  status: string | null;
  updatedAt: string | null;
  adminUrl: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  query?: string;
  results: SearchHit[];
  groups: Array<{ uid: string; label: string; kind: string; count: number; truncated: boolean }>;
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  meta: {
    searchedTypes?: number;
    truncatedTypes?: string[];
    failedTypes?: Array<{ uid: string; message: string }>;
    minChars?: number;
    capped?: boolean;
  };
}

export interface SchemaResponse {
  contentTypes: ContentTypeSummary[];
  settings: Partial<PluginSettings>;
}

export interface LocaleOption {
  code: string;
  name: string;
  [key: string]: unknown;
}
