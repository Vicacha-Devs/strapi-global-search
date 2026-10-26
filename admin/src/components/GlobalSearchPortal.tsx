import { useEffect, useState } from 'react';
import { DesignSystemProvider } from '@strapi/design-system';
import useHotkey from '../hooks/useHotkey';
import { useAdminTheme } from '../utils/theme';
import { SearchOverlay } from './SearchOverlay';

const hasToken = (storage: Storage | undefined): boolean => {
  if (!storage) return false;
  try {
    const raw = storage.getItem('jwtToken');
    if (!raw) return false;
    return Boolean(JSON.parse(raw));
  } catch {
    return Boolean(storage.getItem('jwtToken'));
  }
};

const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (hasToken(window.localStorage) || hasToken(window.sessionStorage)) return true;

  return typeof document !== 'undefined' && /(?:^|;\s*)jwtToken=/.test(document.cookie || '');
};

/**
 * Root of the always-available palette. This component owns its own React root
 * (mounted from `bootstrap()`) and therefore its own DesignSystemProvider, kept
 * in sync with the admin's light/dark setting.
 */
const GlobalSearchPortal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useAdminTheme();

  useHotkey(() => setIsOpen((open) => (open ? false : isAuthenticated())));

  useEffect(() => {
    const onOpen = () => {
      if (isAuthenticated()) setIsOpen(true);
    };
    window.addEventListener('global-search:open', onOpen);
    return () => window.removeEventListener('global-search:open', onOpen);
  }, []);

  return (
    <DesignSystemProvider theme={theme} locale="en">
      {isOpen ? <SearchOverlay onClose={() => setIsOpen(false)} /> : null}
    </DesignSystemProvider>
  );
};

export { GlobalSearchPortal };
