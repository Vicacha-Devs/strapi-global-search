import {
  PLUGIN_ID,
  SEARCHABLE_SCALAR_TYPES,
  SYSTEM_PLUGIN_PREFIXES,
  SKIPPED_ATTRIBUTE_TYPES,
  BLOCKLISTED_ATTRIBUTE_NAMES,
  IDENTIFIER_FIELDS,
  MAIN_FIELD_FALLBACKS,
} from '../utils/constants';
import type { ContentTypeDescriptor, PluginSettings, StrapiLike } from '../types';

export interface AttributeLike {
  type?: string;
  private?: boolean;
  component?: string;
}

export interface ContentTypeLike {
  uid: string;
  kind?: string;
  apiName?: string;
  attributes?: Record<string, AttributeLike>;
  info?: { displayName?: string; singularName?: string };
  pluginOptions?: {
    i18n?: { localized?: boolean };
    'content-manager'?: { visible?: boolean };
  };
  options?: { draftAndPublish?: boolean };
}

interface SchemaCache {
  signature: string;
  types: ContentTypeDescriptor[];
}

let cache: SchemaCache | null = null;

export default ({ strapi }: { strapi: StrapiLike }) => ({
  /**
   * Content types the plugin is allowed to look at: the app's own `api::` types
   * plus user-facing `plugin::` types (excluding internal Strapi system plugins
   * and types explicitly hidden from the Content Manager).
   */
  listCandidateUids(includePluginContentTypes = true): string[] {
    return Object.keys(strapi.contentTypes).filter((uid) => {
      if (uid.startsWith('api::')) return true;
      if (!includePluginContentTypes || !uid.startsWith('plugin::')) return false;
      if (SYSTEM_PLUGIN_PREFIXES.some((prefix) => uid.startsWith(prefix))) return false;

      const contentType = strapi.contentTypes[uid] as ContentTypeLike | undefined;
      if (contentType?.pluginOptions?.['content-manager']?.visible === false) return false;

      return true;
    });
  },

  isSearchableAttribute(name: string, attribute: AttributeLike | undefined): boolean {
    if (!attribute || BLOCKLISTED_ATTRIBUTE_NAMES.includes(name)) return false;
    if (attribute.private === true) return false;
    if (attribute.type && SKIPPED_ATTRIBUTE_TYPES.includes(attribute.type)) return false;

    return Boolean(attribute.type && SEARCHABLE_SCALAR_TYPES.includes(attribute.type));
  },

  /**
   * Flattens an attribute map into dotted, searchable field paths, walking into
   * components up to `maxDepth`. `visited` breaks component cycles (a component
   * that, directly or not, contains itself).
   */
  collectFieldPaths(
    attributes: Record<string, AttributeLike> = {},
    {
      maxDepth,
      depth = 0,
      prefix = '',
      visited = new Set<string>(),
    }: { maxDepth: number; depth?: number; prefix?: string; visited?: Set<string> } = {
      maxDepth: 0,
    }
  ): string[] {
    const paths: string[] = [];

    Object.entries(attributes).forEach(([name, attribute]) => {
      const path = prefix ? `${prefix}.${name}` : name;

      if (this.isSearchableAttribute(name, attribute)) {
        paths.push(path);
        return;
      }

      if (attribute.type !== 'component' || depth >= maxDepth) return;

      const component = strapi.components[attribute.component as string];
      if (!component || !attribute.component || visited.has(attribute.component)) return;

      paths.push(
        ...this.collectFieldPaths(component.attributes, {
          maxDepth,
          depth: depth + 1,
          prefix: path,
          visited: new Set([...visited, attribute.component]),
        })
      );
    });

    return paths;
  },

  /** Resolves the field the Content Manager uses to label an entry. */
  async resolveMainField(contentType: ContentTypeLike): Promise<string> {
    try {
      const configuration = await strapi
        .plugin('content-manager')
        .service('content-types')
        .findConfiguration(contentType);

      const mainField = configuration && configuration.settings && configuration.settings.mainField;

      if (mainField && mainField !== 'id' && contentType.attributes?.[mainField]) {
        return mainField;
      }
    } catch (error) {
      strapi.log.debug(
        `[${PLUGIN_ID}] could not read Content-Manager configuration for ${contentType.uid}: ${(error as Error).message}`
      );
    }

    const fallback = MAIN_FIELD_FALLBACKS.find((name) =>
      this.isSearchableAttribute(name, contentType.attributes?.[name])
    );

    return fallback || 'id';
  },

  async describeContentType(uid: string, settings: PluginSettings): Promise<ContentTypeDescriptor | null> {
    const contentType = strapi.contentTypes[uid] as ContentTypeLike | undefined;
    if (!contentType) return null;

    const attributes = contentType.attributes || {};
    const excludedForType = new Set(
      (settings.excludedFields || [])
        .filter((entry) => entry.startsWith(`${uid}:`))
        .map((entry) => entry.slice(uid.length + 1))
    );

    const allPaths = this.collectFieldPaths(attributes, { maxDepth: settings.maxDepth }).filter(
      (path) => !excludedForType.has(path)
    );

    const mainField = await this.resolveMainField(contentType);

    const idFields = [
      'documentId',
      ...IDENTIFIER_FIELDS.filter((name) => this.isSearchableAttribute(name, attributes[name])),
    ];

    const topLevelFields = allPaths.filter(
      (path) => !path.includes('.') && path !== mainField && !idFields.includes(path)
    );

    const nestedFields = settings.deep ? allPaths.filter((path) => path.includes('.')) : [];

    return {
      uid,
      kind: contentType.kind || 'collectionType',
      displayName:
        (contentType.info && (contentType.info.displayName || contentType.info.singularName)) || uid,
      apiName: contentType.apiName,
      mainField,
      idFields,
      topLevelFields,
      nestedFields,
      localized: Boolean(
        contentType.pluginOptions &&
          contentType.pluginOptions.i18n &&
          contentType.pluginOptions.i18n.localized
      ),
      draftAndPublish: Boolean(contentType.options && contentType.options.draftAndPublish),
      /** Nothing to match against — the type is listed but never queried. */
      searchable:
        idFields.length > 0 ||
        topLevelFields.length > 0 ||
        nestedFields.length > 0 ||
        this.isSearchableAttribute(mainField, attributes[mainField]),
    };
  },

  async getSearchableContentTypes({ force = false }: { force?: boolean } = {}): Promise<
    ContentTypeDescriptor[]
  > {
    const settings = (await strapi.plugin(PLUGIN_ID).service('settings').get()) as PluginSettings;

    if (cache && !force && cache.signature === JSON.stringify(settings)) {
      return cache.types;
    }

    const excluded = new Set(settings.excludedContentTypes || []);
    const includePlugins = settings.includePluginContentTypes !== false;

    const described = await Promise.all(
      this.listCandidateUids(includePlugins)
        .filter((uid) => !excluded.has(uid))
        .map((uid) => this.describeContentType(uid, settings))
    );

    const types = described
      .filter((type): type is ContentTypeDescriptor => Boolean(type && type.searchable))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    cache = { signature: JSON.stringify(settings), types };

    return types;
  },

  /** Every candidate type, searchable or not — the Settings page needs the full list. */
  async getAllContentTypes(): Promise<ContentTypeDescriptor[]> {
    const settings = (await strapi.plugin(PLUGIN_ID).service('settings').get()) as PluginSettings;
    const includePlugins = settings.includePluginContentTypes !== false;
    const described = await Promise.all(
      this.listCandidateUids(includePlugins).map((uid) => this.describeContentType(uid, settings))
    );

    return described
      .filter((type): type is ContentTypeDescriptor => Boolean(type))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },

  clearCache() {
    cache = null;
  },
});
