import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchEntries, isCanceled } from '../api/searchApi';
import type { SearchResponse } from '../types';

const EMPTY: SearchResponse = {
  results: [],
  groups: [],
  pagination: { page: 1, pageSize: 20, total: 0, pageCount: 0 },
  meta: {},
};

export interface UseGlobalSearchOptions {
  debounce?: number;
  minChars?: number;
  pageSize?: number;
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchState {
  status: SearchStatus;
  data: SearchResponse;
  error: unknown;
}

/**
 * Debounced search with two guards that keep the list from flickering:
 * an AbortController cancels the in-flight request, and a monotonic request id
 * means a slow early response can never overwrite a newer one.
 */
const useGlobalSearch = ({ debounce = 250, minChars = 2, pageSize = 20 }: UseGlobalSearchOptions = {}) => {
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [locale, setLocale] = useState('all');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<SearchState>({ status: 'idle', data: EMPTY, error: null });

  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const typesKey = useMemo(() => selectedTypes.join(','), [selectedTypes]);

  // Any change to the criteria invalidates the current page.
  useEffect(() => {
    setPage(1);
  }, [query, typesKey, locale]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < minChars) {
      if (controller.current) controller.current.abort();
      requestId.current += 1;
      setState({ status: 'idle', data: EMPTY, error: null });

      return undefined;
    }

    requestId.current += 1;
    const id = requestId.current;

    const timer = setTimeout(async () => {
      if (controller.current) controller.current.abort();
      controller.current = new AbortController();

      setState((previous) => ({ ...previous, status: 'loading' }));

      try {
        const data = await searchEntries(
          { q: trimmed, types: selectedTypes, locale, page, pageSize },
          controller.current.signal
        );

        if (id === requestId.current) setState({ status: 'success', data, error: null });
      } catch (error) {
        if (isCanceled(error) || id !== requestId.current) return;
        setState({ status: 'error', data: EMPTY, error });
      }
    }, debounce);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typesKey, locale, page, pageSize, debounce, minChars]);

  useEffect(
    () => () => {
      if (controller.current) controller.current.abort();
    },
    []
  );

  const toggleType = useCallback((uid: string) => {
    setSelectedTypes((previous) =>
      previous.includes(uid) ? previous.filter((item) => item !== uid) : [...previous, uid]
    );
  }, []);

  const clearTypes = useCallback(() => setSelectedTypes([]), []);

  return {
    query,
    setQuery,
    selectedTypes,
    setSelectedTypes,
    toggleType,
    clearTypes,
    locale,
    setLocale,
    page,
    setPage,
    status: state.status,
    error: state.error,
    data: state.data || EMPTY,
    isBelowMinChars: query.trim().length > 0 && query.trim().length < minChars,
  };
};

export default useGlobalSearch;
