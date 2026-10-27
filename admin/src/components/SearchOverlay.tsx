import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import {
  Box,
  Divider,
  Flex,
  Loader,
  Modal,
  TextInput,
  Typography,
  VisuallyHidden,
} from '@strapi/design-system';
import { Search } from '@strapi/icons';
import useGlobalSearch from '../hooks/useGlobalSearch';
import useSearchableTypes from '../hooks/useSearchableTypes';
import { toAdminUrl } from '../utils/adminBase';
import useTrad from '../utils/useTrad';
import { ResultItem } from './ResultItem';
import type { SearchHit } from '../types';

const ResultsScroller = styled(Box)`
  max-height: 45vh;
  overflow-y: auto;
`;

const PALETTE_PAGE_SIZE = 30;

interface SearchOverlayProps {
  onClose: () => void;
}

/**
 * Spotlight-style command palette. It is rendered outside the admin's React
 * tree, so navigation is a full URL assignment rather than a router push.
 */
const SearchOverlay = ({ onClose }: SearchOverlayProps) => {
  const t = useTrad();
  const { settings } = useSearchableTypes();
  const search = useGlobalSearch({
    debounce: settings.debounce || 250,
    minChars: settings.minChars || 2,
    pageSize: PALETTE_PAGE_SIZE,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => search.data.results || [], [search.data]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current && inputRef.current.focus(), 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [search.query, results.length]);

  const open = (hit: SearchHit, newTab = false) => {
    if (!hit) return;

    const url = toAdminUrl(hit.adminUrl);

    if (newTab) {
      window.open(url, '_blank', 'noopener');
      return;
    }

    onClose();
    window.location.assign(url);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length ? (index - 1 + results.length) % results.length : 0
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) open(hit, event.metaKey || event.ctrlKey);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const renderBody = () => {
    if (search.isBelowMinChars) {
      return (
        <Box padding={6}>
          <Typography textColor="neutral500">
            {t('common.minChars', { count: settings.minChars || 2 })}
          </Typography>
        </Box>
      );
    }

    if (search.status === 'idle') {
      return (
        <Box padding={6}>
          <Typography textColor="neutral500">
            {t('palette.idle')}
          </Typography>
        </Box>
      );
    }

    if (search.status === 'error') {
      return (
        <Box padding={6}>
          <Typography textColor="danger600">
            {t('palette.error')}
          </Typography>
        </Box>
      );
    }

    if (search.status === 'loading' && !results.length) {
      return (
        <Flex justifyContent="center" padding={6}>
          <Loader>{t('common.searching')}</Loader>
        </Flex>
      );
    }

    if (!results.length) {
      return (
        <Box padding={6}>
          <Typography textColor="neutral500">
            {t('common.noResults', { query: search.query })}
          </Typography>
        </Box>
      );
    }

    return (
      <ResultsScroller role="listbox" aria-label={t('palette.resultsLabel')}>
        {results.map((hit, index) => (
          <ResultItem
            key={`${hit.contentTypeUid}-${hit.documentId || hit.id}-${hit.locale || ''}`}
            hit={hit}
            query={search.query.trim()}
            isActive={index === activeIndex}
            onSelect={open}
            onHover={() => setActiveIndex(index)}
          />
        ))}
      </ResultsScroller>
    );
  };

  return (
    <Modal.Root open onOpenChange={(open: boolean) => !open && onClose()}>
      <Modal.Content>
        <Box onKeyDown={onKeyDown}>
          <VisuallyHidden>
            <Typography id="global-search-palette-title">{t('palette.title')}</Typography>
          </VisuallyHidden>

          <Box paddingLeft={4} paddingRight={4} paddingTop={4} paddingBottom={3}>
            <TextInput
              ref={inputRef}
              name="global-search-palette"
              aria-label={t('palette.title')}
              placeholder={t('palette.placeholder')}
              startIcon={<Search />}
              value={search.query}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                search.setQuery(event.target.value)
              }
              autoComplete="off"
            />
          </Box>

          <Divider />

          <Modal.Body>{renderBody()}</Modal.Body>

          <Divider />

          <Flex justifyContent="space-between" padding={3} paddingLeft={4} paddingRight={4}>
            <Typography variant="pi" textColor="neutral500">
              {t('palette.hints')}
            </Typography>
            {search.status === 'success' && search.data.pagination.total > 0 ? (
              <Typography variant="pi" textColor="neutral500">
                {t('common.results', {
                  count: search.data.pagination.total,
                  capped: search.data.meta.capped ? '+' : '',
                })}
              </Typography>
            ) : null}
          </Flex>
        </Box>
      </Modal.Content>
    </Modal.Root>
  );
};

export { SearchOverlay };
