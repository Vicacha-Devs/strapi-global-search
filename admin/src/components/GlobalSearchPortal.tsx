import { useState } from 'react';
import { DesignSystemProvider } from '@strapi/design-system';
import { IntlProvider } from 'react-intl';
import useHotkey from '../hooks/useHotkey';
import { useAdminTheme } from '../utils/theme';
import { getBuiltinMessages, readAdminLocale } from '../translations';
import { SearchOverlay } from './SearchOverlay';

const isAuthenticated = (): boolean => {
  try {
    const raw = window.localStorage.getItem('jwtToken');
    if (!raw) return false;

    const parsed = JSON.parse(raw);

    return Boolean(parsed);
  } catch (error) {
    return Boolean(window.localStorage.getItem('jwtToken'));
  }
};

/**
 * Root of the always-available palette. This component owns its own React root
 * (mounted from `bootstrap()`) and therefore its own DesignSystemProvider and
 * IntlProvider, kept in sync with the admin's light/dark and language settings.
 */
const GlobalSearchPortal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useAdminTheme();
  const locale = readAdminLocale();

  useHotkey(() => setIsOpen((open) => (open ? false : isAuthenticated())));

  return (
    <IntlProvider locale={locale} messages={getBuiltinMessages(locale)} defaultLocale="en">
      <DesignSystemProvider theme={theme} locale={locale}>
        {isOpen ? <SearchOverlay onClose={() => setIsOpen(false)} /> : null}
      </DesignSystemProvider>
    </IntlProvider>
  );
};

export { GlobalSearchPortal };
