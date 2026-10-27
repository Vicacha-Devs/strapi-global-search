import pluginId from '../pluginId';
import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import ar from './ar.json';
import tr from './tr.json';

type Messages = Record<string, string>;

const BUILTIN_TRANSLATIONS: Record<string, Messages> = {
  en,
  fr,
  es,
  ar,
  tr,
};

const ADMIN_LANGUAGE_KEY = 'strapi-admin-language';

const prefix = (data: Messages): Messages => {
  const prefixed: Messages = {};

  Object.keys(data).forEach((key) => {
    prefixed[`${pluginId}.${key}`] = data[key];
  });

  return prefixed;
};

/** The admin's current language, read the way the admin itself persists it. */
const readAdminLocale = (): string => {
  try {
    const raw = window.localStorage.getItem(ADMIN_LANGUAGE_KEY);

    return raw ? raw.replace(/^"|"$/g, '') : 'en';
  } catch {
    return 'en';
  }
};

/** Built-in messages for a locale (falling back to its base language, then English). */
const getBuiltinMessages = (locale: string): Messages => ({
  ...prefix(en),
  ...prefix(BUILTIN_TRANSLATIONS[locale] || BUILTIN_TRANSLATIONS[locale.split('-')[0]] || {}),
});

export { BUILTIN_TRANSLATIONS, getBuiltinMessages, prefix, readAdminLocale };
export type { Messages };
