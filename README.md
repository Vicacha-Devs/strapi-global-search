# strapi-global-search

[![npm version](https://img.shields.io/npm/v/strapi-global-search.svg)](https://www.npmjs.com/package/strapi-global-search)
[![Strapi 5](https://img.shields.io/badge/strapi-v5-blue)](https://strapi.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Spotlight-style **global search** for the Strapi v5 admin: every collection type and single type, from a dedicated page or a <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> palette.

Install it, enable it, and start Strapi. It introspects your content types at boot and never needs to know your schema ahead of time.

**Strapi 4:** use [`strapi-global-search@1.x`](https://www.npmjs.com/package/strapi-global-search/v/1.0.0). This major (`2.x`) is Strapi 5 only.

## Features

- **Searches everything** — every `api::` and Content-Manager-visible `plugin::` collection type _and_ single type, including text fields nested inside components.
- **Two surfaces** — a full search page under the plugins menu, and an instant SPA-navigating command palette (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>) available from anywhere in the admin.
- **Predictable ordering** — results are ranked id → name → other fields → nested fields (see below), never by an opaque relevance score.
- **Respects your permissions** — an editor only ever sees content types they can read in the Content Manager.
- **i18n and draft/publish aware** — searches every locale by default and finds drafts.
- **No index, no extra services** — plain database queries, nothing to keep in sync.

## Installation

```bash
npm install strapi-global-search
# or
yarn add strapi-global-search
```

Enable it in `config/plugins.js` or `config/plugins.ts`:

```js
module.exports = {
	"global-search": {
		enabled: true,
	},
};
```

Then start your Strapi app (`npm run develop`). There is no extra build step.

This package has **no** `preinstall` / `install` / `postinstall` scripts and does not use git or remote URL dependencies. On [npm v12](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/) you do not need an `allowScripts` entry for `strapi-global-search`.

## Result ordering

| Priority | Match                                       |
| -------- | ------------------------------------------- |
| 1        | `id` / `documentId` exact                   |
| 2        | `id` / `documentId` partial                 |
| 3        | Name (the Content Manager main field) exact |
| 4        | Name starts with the query                  |
| 5        | Name contains the query                     |
| 6        | Any other top-level text field              |
| 7        | Any text field inside a component           |

Ties break on an exact-case match, then the shortest matching value, then the most recently updated entry.

## Configuration

Everything is optional and can be changed at **Settings → Global Search → Configuration**, or pinned in `config/plugins.js` / `config/plugins.ts`:

```js
module.exports = {
	"global-search": {
		enabled: true,
		config: {
			minChars: 2, // minimum query length
			debounce: 250, // ms to wait after the last keystroke
			perTypeLimit: 20, // rows fetched per content type
			maxResults: 100, // cap on the merged, ranked result set
			deep: true, // search inside components
			maxDepth: 3, // how many component levels to walk
			includeDrafts: true, // include unpublished entries
			includePluginContentTypes: true, // include visible plugin::* content types
			queryTimeout: 4000, // per-content-type timeout in ms
			concurrency: 8, // content types queried in parallel
			excludedContentTypes: [], // e.g. ['api::log.log']
			excludedFields: [], // e.g. ['api::article.article:body']
			displayFields: {}, // extra fields in the result row, keyed by UID
		},
	},
};
```

## Permissions

Two RBAC actions are registered and can be assigned per role:

- `plugin::global-search.read` — use the search page and the palette.
- `plugin::global-search.settings` — change the configuration.

Search results are additionally filtered by each user's Content Manager read permissions.

## Performance notes

Searching runs live database `LIKE` queries — there is no index to maintain, but a query on a very large table is only as fast as your database makes it. The plugin keeps this bounded with a per-content-type row limit, a bounded column projection, a per-type timeout, a concurrency cap and a client-side debounce. For very large tables, consider a database index on the fields people actually search, or disable those content types in Settings.

Reported result counts reflect the capped set (`perTypeLimit` rows per type, `maxResults` overall) — a `+` in the UI means there were more matches than were fetched.

## Limitations

- **Dynamic zones** and **blocks** fields are not searched: the query engine cannot filter polymorphic JSON columns.
- Relations, media and JSON fields are not searched.
- Internal Strapi system plugin content types (such as `plugin::upload.file`, `plugin::i18n.locale`, and `plugin::users-permissions.*`) are skipped automatically.

## Compatibility

|        |                                     |
| ------ | ----------------------------------- |
| Strapi | `^5.0.0` (developed against 5.52.0) |
| Node   | 20 – 26                             |
| React  | 18                                  |

## Publishing and supply chain

Public releases are published from GitHub Actions with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC). There is no long-lived 2FA-bypass granular access token. See [npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/).

## License

MIT
