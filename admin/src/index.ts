import React from 'react';
import { createRoot } from 'react-dom/client';
import pluginId from './pluginId';
import pluginPermissions from './permissions';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { GlobalSearchPortal } from './components/GlobalSearchPortal';
import { BUILTIN_TRANSLATIONS, prefix } from './translations';

const PORTAL_ROOT_ID = 'global-search-portal-root';

interface StrapiApp {
  addMenuLink: (options: Record<string, unknown>) => void;
  addSettingsLink: (
    section: Record<string, unknown>,
    links: Array<Record<string, unknown>>
  ) => void;
  registerPlugin: (plugin: Record<string, unknown>) => void;
}

export default {
  register(app: StrapiApp) {
    app.addMenuLink({
      to: `plugins/${pluginId}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: 'Global Search',
      },
      permissions: pluginPermissions.main,
      Component: () => import('./pages/App'),
    });

    app.addSettingsLink(
      {
        id: pluginId,
        intlLabel: { id: `${pluginId}.settings.section`, defaultMessage: 'Global Search' },
      },
      [
        {
          intlLabel: { id: `${pluginId}.settings.link`, defaultMessage: 'Configuration' },
          id: `${pluginId}-settings`,
          to: pluginId,
          permissions: pluginPermissions.settings,
          Component: () => import('./pages/Settings'),
        },
      ]
    );

    app.registerPlugin({
      id: pluginId,
      initializer: Initializer,
      isReady: false,
      name: pluginId,
    });
  },

  /**
   * The Ctrl/Cmd + K palette is mounted on document.body so it is available on
   * every admin screen, not only the plugin page.
   */
  bootstrap() {
    if (typeof document === 'undefined' || document.getElementById(PORTAL_ROOT_ID)) return;

    const container = document.createElement('div');
    container.id = PORTAL_ROOT_ID;
    document.body.appendChild(container);

    createRoot(container).render(React.createElement(GlobalSearchPortal));
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const data =
            BUILTIN_TRANSLATIONS[locale] ||
            ((await import(`./translations/${locale}.json`)).default as Record<string, string>);

          return { data: prefix(data), locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
