/**
 * Exercises the global-search plugin services against a fake Strapi instance.
 * No Strapi boot, no database, no test runner: `npm test` (tsx).
 */
import assert from 'assert';
import type { StrapiLike } from '../server/types';

import schemaFactory from '../server/services/schema';
import queryFactory from '../server/services/query';
import rankingFactory from '../server/services/ranking';
import permissionsFactory from '../server/services/permissions';
import settingsFactory from '../server/services/settings';
import searchFactory from '../server/services/search';

const contentTypes = {
  'api::article.article': {
    uid: 'api::article.article',
    kind: 'collectionType',
    info: { displayName: 'Article', singularName: 'article' },
    options: { draftAndPublish: true },
    pluginOptions: { i18n: { localized: true } },
    attributes: {
      title: { type: 'string' },
      slug: { type: 'uid' },
      body: { type: 'richtext' },
      views: { type: 'integer' },
      cover: { type: 'media' },
      author: { type: 'relation', relation: 'oneToOne' },
      payload: { type: 'json' },
      secret: { type: 'string', private: true },
      password: { type: 'string' },
      zone: { type: 'dynamiczone', components: ['shared.seo'] },
      seo: { type: 'component', component: 'shared.seo' },
      tags: { type: 'component', component: 'shared.tag', repeatable: true },
    },
  },
  'api::homepage.homepage': {
    uid: 'api::homepage.homepage',
    kind: 'singleType',
    info: { displayName: 'Homepage' },
    options: { draftAndPublish: false },
    attributes: { name: { type: 'string' }, intro: { type: 'text' } },
  },
  'api::secret.secret': {
    uid: 'api::secret.secret',
    kind: 'collectionType',
    info: { displayName: 'Secret' },
    attributes: { blob: { type: 'json' } }, // nothing searchable
  },
};

const components = {
  'shared.seo': {
    attributes: {
      metaTitle: { type: 'string' },
      metaDescription: { type: 'text' },
      social: { type: 'component', component: 'shared.social' },
    },
  },
  // Deliberately cyclic: social -> seo -> social ...
  'shared.social': {
    attributes: { handle: { type: 'string' }, seo: { type: 'component', component: 'shared.seo' } },
  },
  'shared.tag': { attributes: { label: { type: 'string' } } },
};

const rows: Record<string, unknown> = {
  'api::article.article': [
    { id: 7, documentId: 'doc-careers', title: 'Careers', slug: 'careers', body: 'x', updatedAt: '2026-01-01', publishedAt: '2026-01-01', locale: 'en' },
    { id: 12, title: 'Career advice', slug: 'career-advice', body: 'y', updatedAt: '2026-02-01', publishedAt: null, locale: 'en' },
    { id: 3, title: 'Random', slug: 'random', body: 'we are hiring for careers now', updatedAt: '2026-03-01', publishedAt: '2026-03-01', locale: 'en' },
    { id: 9, title: 'Nested', slug: 'nested', body: 'z', updatedAt: '2026-04-01', locale: 'en', seo: { metaTitle: 'careers page' } },
    { id: 55, title: 'Repeatable', slug: 'rep', body: 'z', updatedAt: '2026-05-01', locale: 'en', tags: [{ label: 'other' }, { label: 'careers team' }] },
  ],
  'api::homepage.homepage': { id: 1, name: 'careers', intro: 'hello', updatedAt: '2026-01-05' },
};

const services: Record<string, any> = {};

const strapi: StrapiLike = {
  contentTypes,
  components,
  config: { get: () => ({}) },
  store: () => ({ get: async () => ({}), set: async () => {} }),
  log: {
    debug() {},
    warn(msg: string) {
      console.log('  [warn]', msg);
    },
    error(msg: string) {
      console.log('  [error]', msg);
    },
  },
  plugin: (id: string) => {
    if (id === 'content-manager') {
      return {
        service: () => ({
          findConfiguration: async (ct: { uid: string }) => ({
            settings: { mainField: ct.uid === 'api::article.article' ? 'title' : 'name' },
          }),
        }),
      };
    }

    return { service: (name: string) => services[name] };
  },
  documents: (uid: string) => ({
    findMany: async () => {
      const data = rows[uid];
      if (!data) return [];
      return Array.isArray(data) ? data : [data];
    },
  }),
  admin: { services: { permission: { actionProvider: { registerMany() {} } } } },
};

services.schema = schemaFactory({ strapi });
services.query = queryFactory();
services.ranking = rankingFactory();
services.permissions = permissionsFactory();
services.settings = settingsFactory({ strapi });
services.search = searchFactory({ strapi });

const run = async () => {
  let failures = 0;
  const check = (label: string, fn: () => void) => {
    try {
      fn();
      console.log(`  PASS  ${label}`);
    } catch (error) {
      failures += 1;
      console.log(`  FAIL  ${label}\n        ${(error as Error).message}`);
    }
  };

  console.log('\n== schema introspection ==');
  const types = await services.schema.getSearchableContentTypes();
  const article = types.find((t: { uid: string }) => t.uid === 'api::article.article');
  const homepage = types.find((t: { uid: string }) => t.uid === 'api::homepage.homepage');

  check('discovers collection + single types', () => assert.strictEqual(types.length, 3));
  check('types with no text fields remain searchable by documentId', () =>
    assert.ok(types.find((t: { uid: string }) => t.uid === 'api::secret.secret')));
  check('resolves mainField from content-manager config', () =>
    assert.strictEqual(article.mainField, 'title'));
  check('detects single type kind', () => assert.strictEqual(homepage.kind, 'singleType'));
  check('detects i18n + draft&publish', () =>
    assert.ok(article.localized && article.draftAndPublish));
  check('collects id fields including documentId', () =>
    assert.deepStrictEqual(article.idFields, ['documentId', 'slug']));
  check('collects top-level string fields, minus mainField/id fields', () =>
    assert.deepStrictEqual(article.topLevelFields.sort(), ['body']));
  check('skips media/relation/json/dynamiczone/private/password', () => {
    const all = [...article.topLevelFields, ...article.nestedFields].join(',');
    ['cover', 'author', 'payload', 'secret', 'password', 'zone', 'views'].forEach((name) =>
      assert.ok(!all.includes(name), `${name} should not be searchable`));
  });
  check('walks into components (depth 1 + 2)', () => {
    assert.ok(article.nestedFields.includes('seo.metaTitle'));
    assert.ok(article.nestedFields.includes('seo.social.handle'));
    assert.ok(article.nestedFields.includes('tags.label'));
  });
  check('breaks component cycles instead of hanging', () =>
    assert.ok(!article.nestedFields.some((p: string) => p.split('.').length > 4)));

  console.log('\n== query builder ==');
  const filtersText = services.query.buildFilters(article, 'careers');
  const filtersNumeric = services.query.buildFilters(article, '42');

  check('always matches documentId as a string', () =>
    assert.deepStrictEqual(filtersText.$or[0], { documentId: { $containsi: 'careers' } }));
  check('no $eq on numeric id for a text query', () =>
    assert.ok(!JSON.stringify(filtersText).includes('"$eq"')));
  check('adds id $eq for a numeric query', () =>
    assert.ok(filtersNumeric.$or.some((c: any) => c.id && c.id.$eq === 42)));
  check('nests component paths', () =>
    assert.ok(
      filtersText.$or.some(
        (c: any) => c.seo && c.seo.social && c.seo.social.handle && c.seo.social.handle.$containsi === 'careers'
      )
    ));
  check('builds a nested populate tree only for searched components', () => {
    const populate = services.query.buildPopulate(['seo.metaTitle', 'seo.social.handle', 'tags.label']);
    assert.deepStrictEqual(populate, {
      seo: { populate: { social: true } },
      tags: true,
    });
  });

  const params = services.query.buildParams(article, {
    query: 'careers',
    locale: 'all',
    limit: 20,
    includeDrafts: true,
  });
  check('projects a bounded field list (no populate: *)', () => {
    assert.ok(params.fields.includes('title') && params.fields.includes('publishedAt'));
    assert.ok(!params.fields.includes('id'));
  });
  check('passes status + locale for i18n/D&P types', () => {
    assert.strictEqual(params.status, 'draft');
    assert.strictEqual(params.locale, '*');
  });
  check('omits locale/status for plain types', () => {
    const plain = services.query.buildParams(homepage, { query: 'x', limit: 5, includeDrafts: true });
    assert.ok(!('locale' in plain) && !('status' in plain));
  });

  console.log('\n== ranking ==');
  const tier = (entry: unknown) => services.ranking.score(entry, article, 'careers').tier;
  check('id exact beats everything', () =>
    assert.strictEqual(services.ranking.score({ id: 7, slug: 'careers' }, article, 'careers').tier, 0));
  check('name exact -> tier 2', () => assert.strictEqual(tier({ id: 1, title: 'Careers' }), 2));
  check('name starts-with -> tier 3', () => assert.strictEqual(tier({ id: 1, title: 'Careers page' }), 3));
  check('name contains -> tier 4', () => assert.strictEqual(tier({ id: 1, title: 'Our careers' }), 4));
  check('other field -> tier 5', () =>
    assert.strictEqual(tier({ id: 1, title: 'x', body: 'see careers' }), 5));
  check('nested component field -> tier 6', () =>
    assert.strictEqual(tier({ id: 1, title: 'x', seo: { metaTitle: 'careers' } }), 6));
  check('repeatable component values are reachable', () =>
    assert.strictEqual(tier({ id: 1, title: 'x', tags: [{ label: 'no' }, { label: 'careers' }] }), 6));
  check('snippet is extracted and de-marked-up', () => {
    const scored = services.ranking.score(
      { id: 1, title: 'x', body: '<p>we are hiring for careers now</p>' },
      article,
      'careers'
    );
    assert.ok(scored.matchedSnippet.includes('careers'));
    assert.ok(!scored.matchedSnippet.includes('<p>'));
    assert.strictEqual(scored.matchedFieldLabel, 'Body');
  });

  console.log('\n== search end to end ==');
  const result = await services.search.search({ query: 'careers', pageSize: 10 });
  const order = result.results.map((h: any) => `${h.contentTypeUid}#${h.id}:${h.tierLabel}`);
  console.log('  order:', order.join('\n         '));

  check('ranks id > name-exact > starts-with > contains > field > nested', () =>
    assert.deepStrictEqual(
      result.results.map((h: any) => h.tier),
      [...result.results.map((h: any) => h.tier)].sort((a: number, b: number) => a - b)
    ));
  check('slug "careers" wins the top spot', () =>
    assert.strictEqual(result.results[0].id, 7));
  check('single type is included and linked correctly', () => {
    const single = result.results.find((h: any) => h.kind === 'singleType');
    assert.ok(single, 'homepage single type missing');
    assert.strictEqual(single.adminUrl, '/content-manager/single-types/api::homepage.homepage');
  });
  check('collection links use documentId and locale', () =>
    assert.strictEqual(
      result.results.find((h: any) => h.id === 7).adminUrl,
      '/content-manager/collection-types/api::article.article/doc-careers?locale=en'
    ));
  check('draft/published status is reported', () => {
    const draft = result.results.find((h: any) => h.id === 12);
    assert.strictEqual(draft.status, 'draft');
  });
  check('groups summarise per content type', () =>
    assert.strictEqual(result.groups.reduce((sum: number, g: any) => sum + g.count, 0), result.pagination.total));

  const short = await services.search.search({ query: 'a' });
  check('queries below minChars return nothing', () =>
    assert.strictEqual(short.results.length, 0));

  const wildcard = await services.search.search({ query: '%%%%' });
  check('a bare wildcard query cannot match everything', () =>
    assert.strictEqual(wildcard.results.length, 0));

  const denied = await services.search.search({
    query: 'careers',
    userAbility: { can: (_action: string, uid: string) => uid === 'api::homepage.homepage' },
  });
  check('RBAC filter hides content types the user cannot read', () =>
    assert.ok(denied.results.every((h: any) => h.contentTypeUid === 'api::homepage.homepage')));

  const filtered = await services.search.search({
    query: 'careers',
    types: ['api::homepage.homepage'],
  });
  check('type filter is honoured', () =>
    assert.ok(filtered.results.every((h: any) => h.contentTypeUid === 'api::homepage.homepage')));

  const paged = await services.search.search({ query: 'careers', page: 2, pageSize: 2 });
  check('pagination slices the ranked set', () => {
    assert.strictEqual(paged.pagination.page, 2);
    assert.strictEqual(paged.results.length, 2);
    assert.notStrictEqual(paged.results[0].id, result.results[0].id);
  });

  console.log('\n== resilience ==');
  const originalDocuments = strapi.documents;
  strapi.documents = (uid: string) => ({
    findMany: async (params: unknown) => {
      if (uid === 'api::article.article') throw new Error('boom');
      return originalDocuments(uid).findMany(params);
    },
  });
  const partial = await services.search.search({ query: 'careers' });
  strapi.documents = originalDocuments;

  check('one broken content type does not fail the whole search', () => {
    assert.ok(partial.results.length > 0);
    assert.strictEqual(partial.meta.failedTypes.length, 1);
  });

  console.log('\n== plugin content types & structured rich text ==');
  (contentTypes as Record<string, unknown>)['plugin::events.event'] = {
    uid: 'plugin::events.event',
    kind: 'collectionType',
    info: { displayName: 'Event' },
    options: { draftAndPublish: true },
    attributes: {
      title: { type: 'string' },
      content: { type: 'customField', customField: 'plugin::tiptap-editor.RichText' },
    },
  };
  (contentTypes as Record<string, unknown>)['plugin::upload.file'] = {
    uid: 'plugin::upload.file',
    kind: 'collectionType',
    info: { displayName: 'File' },
    attributes: { name: { type: 'string' } },
  };
  (contentTypes as Record<string, unknown>)['plugin::custom.hidden'] = {
    uid: 'plugin::custom.hidden',
    kind: 'collectionType',
    info: { displayName: 'Hidden' },
    pluginOptions: { 'content-manager': { visible: false } },
    attributes: { name: { type: 'string' } },
  };

  services.schema.clearCache();
  const withPlugins = await services.schema.getSearchableContentTypes({ force: true });
  const eventDescriptor = withPlugins.find(
    (t: { uid: string }) => t.uid === 'plugin::events.event'
  );

  check('discovers visible plugin::* content types while skipping system/hidden plugins', () => {
    assert.ok(eventDescriptor, 'plugin::events.event should be discovered');
    assert.ok(!withPlugins.some((t: { uid: string }) => t.uid === 'plugin::upload.file'));
    assert.ok(!withPlugins.some((t: { uid: string }) => t.uid === 'plugin::custom.hidden'));
  });
  check('indexes customField attributes as searchable top-level fields', () => {
    assert.ok(eventDescriptor.topLevelFields.includes('content'));
  });
  check('extracts plain text from ProseMirror/Tiptap JSON without matching JSON keys', () => {
    const tiptapPayload = JSON.stringify({
      doc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Join our Friday community lecture on careers' }],
          },
        ],
      },
      metrics: { words: 7, readingTimeMinutes: 1 },
    });

    const hitScore = services.ranking.score(
      { id: 101, title: 'Weekly Gathering', content: tiptapPayload },
      eventDescriptor,
      'careers'
    );
    assert.strictEqual(hitScore.tier, 5);
    assert.ok(hitScore.matchedSnippet.includes('Friday community lecture on careers'));
    assert.ok(!hitScore.matchedSnippet.includes('readingTimeMinutes'));

    const jsonKeyScore = services.ranking.score(
      { id: 101, title: 'Weekly Gathering', content: tiptapPayload },
      eventDescriptor,
      'readingTimeMinutes'
    );
    assert.strictEqual(jsonKeyScore.tier, 7);
  });

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error('harness crashed:', error);
  process.exit(1);
});
