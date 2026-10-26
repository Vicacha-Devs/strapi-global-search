import { PLUGIN_ID } from '../utils/constants';
import { sanitizeQuery } from '../utils/text';
import { withTimeout, mapWithConcurrency } from '../utils/async';
import type {
  ContentTypeDescriptor,
  PluginSettings,
  RankedHit,
  SearchParams,
  SearchResult,
  StrapiLike,
} from '../types';

const service = (strapi: StrapiLike, name: string) => strapi.plugin(PLUGIN_ID).service(name);

export interface EntryLike {
  id: string | number;
  documentId?: string;
  locale?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  name?: string;
  title?: string;
  [key: string]: unknown;
}

export default ({ strapi }: { strapi: StrapiLike }) => ({
  /** Content Manager deep-link for a hit. */
  buildAdminUrl(descriptor: ContentTypeDescriptor, entry: EntryLike): string {
    const localeQuery = entry.locale ? `?locale=${entry.locale}` : '';

    if (descriptor.kind === 'singleType') {
      return `/content-manager/single-types/${descriptor.uid}${localeQuery}`;
    }

    const documentId = entry.documentId || entry.id;

    return `/content-manager/collection-types/${descriptor.uid}/${documentId}${localeQuery}`;
  },

  async queryContentType(
    descriptor: ContentTypeDescriptor,
    {
      query,
      locale,
      settings,
    }: { query: string; locale?: string; settings: PluginSettings }
  ): Promise<EntryLike[]> {
    const run = async (target: ContentTypeDescriptor): Promise<EntryLike[]> => {
      const params = service(strapi, 'query').buildParams(target, {
        query,
        locale,
        limit: settings.perTypeLimit,
        includeDrafts: settings.includeDrafts,
      });

      if (!params) return [];

      const result = await strapi.documents(target.uid).findMany(params);

      return Array.isArray(result) ? result : [result].filter(Boolean);
    };

    try {
      return await run(descriptor);
    } catch (error) {
      const custom = descriptor.customFieldPaths || [];
      if (!custom.length) throw error;

      // A custom field stored in a column the database can't `$containsi` must
      // not take the whole content type down: retry without them.
      strapi.log.warn(
        `[${PLUGIN_ID}] query failed for ${descriptor.uid}, retrying without custom fields (${custom.join(', ')}): ${(error as Error).message}`
      );

      return run({
        ...descriptor,
        topLevelFields: descriptor.topLevelFields.filter((path) => !custom.includes(path)),
        nestedFields: descriptor.nestedFields.filter((path) => !custom.includes(path)),
        customFieldPaths: [],
      });
    }
  },

  toHit(
    descriptor: ContentTypeDescriptor,
    entry: EntryLike,
    query: string,
    settings: PluginSettings
  ): RankedHit {
    const scored = service(strapi, 'ranking').score(entry, descriptor, query);
    const extraFields = (settings.displayFields[descriptor.uid] || []).slice(0, 2);

    return {
      ...scored,
      contentTypeUid: descriptor.uid,
      contentTypeLabel: descriptor.displayName,
      kind: descriptor.kind,
      id: entry.id,
      documentId: entry.documentId || null,
      title:
        (descriptor.mainField && (entry[descriptor.mainField] as string)) ||
        entry.name ||
        entry.title ||
        `#${entry.documentId || entry.id}`,
      mainField: descriptor.mainField,
      extra: extraFields.map((field) => ({ field, value: entry[field] ?? null })),
      locale: entry.locale || null,
      status: descriptor.draftAndPublish ? (entry.publishedAt ? 'published' : 'draft') : null,
      updatedAt: entry.updatedAt || null,
      adminUrl: this.buildAdminUrl(descriptor, entry),
    };
  },

  /**
   * Fans out across every permitted content type, ranks the merged set, then
   * paginates in memory.
   *
   * `total` is the size of the *capped* merged set (`perTypeLimit` rows per type,
   * `maxResults` overall), not a database count — searching for a common word in a
   * 100k-row table must not turn into a full-table `COUNT`.
   */
  async search({
    query: rawQuery,
    types,
    locale,
    page = 1,
    pageSize = 20,
    userAbility,
  }: SearchParams = {}): Promise<SearchResult> {
    const settings = (await service(strapi, 'settings').get()) as PluginSettings;
    const query = sanitizeQuery(rawQuery);

    const empty: SearchResult = {
      query,
      results: [],
      groups: [],
      pagination: { page: 1, pageSize, total: 0, pageCount: 0 },
      meta: { searchedTypes: 0, truncatedTypes: [], failedTypes: [], minChars: settings.minChars },
    };

    if (query.length < settings.minChars) return empty;

    const searchable = (await service(strapi, 'schema').getSearchableContentTypes()) as ContentTypeDescriptor[];
    const requested = Array.isArray(types) && types.length ? new Set(types) : null;

    const candidates = service(strapi, 'permissions')
      .filterReadableTypes(searchable, userAbility)
      .filter((descriptor: ContentTypeDescriptor) => !requested || requested.has(descriptor.uid));

    if (!candidates.length) return { ...empty, query };

    const truncatedTypes: string[] = [];
    const failedTypes: Array<{ uid: string; message: string }> = [];

    const perType = await mapWithConcurrency(
      candidates,
      settings.concurrency,
      async (descriptor: ContentTypeDescriptor) => {
        try {
          const entries = await withTimeout(
            () => this.queryContentType(descriptor, { query, locale, settings }),
            settings.queryTimeout,
            descriptor.uid
          );

          if (entries.length >= settings.perTypeLimit) truncatedTypes.push(descriptor.uid);

          return entries.map((entry) => this.toHit(descriptor, entry, query, settings));
        } catch (error) {
          // One broken or slow content type must never fail the whole search.
          failedTypes.push({ uid: descriptor.uid, message: (error as Error).message });
          strapi.log.warn(`[${PLUGIN_ID}] search failed for ${descriptor.uid}: ${(error as Error).message}`);

          return [];
        }
      }
    );

    const ranked = service(strapi, 'ranking')
      .sort(perType.flat())
      .slice(0, settings.maxResults) as RankedHit[];

    const total = ranked.length;
    const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const pageCount = Math.ceil(total / safePageSize) || 0;
    const safePage = Math.min(Math.max(Number(page) || 1, 1), pageCount || 1);
    const start = (safePage - 1) * safePageSize;
    const results = ranked.slice(start, start + safePageSize);

    // Group headers are built from the full ranked set, not the current page, so
    // the counts stay stable while paging.
    const groups = candidates
      .map((descriptor: ContentTypeDescriptor) => ({
        uid: descriptor.uid,
        label: descriptor.displayName,
        kind: descriptor.kind,
        count: ranked.filter((hit) => hit.contentTypeUid === descriptor.uid).length,
        truncated: truncatedTypes.includes(descriptor.uid),
      }))
      .filter((group: { count: number }) => group.count > 0)
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

    return {
      query,
      results,
      groups,
      pagination: { page: safePage, pageSize: safePageSize, total, pageCount },
      meta: {
        searchedTypes: candidates.length,
        truncatedTypes,
        failedTypes,
        minChars: settings.minChars,
        capped: total >= settings.maxResults,
      },
    };
  },
});
