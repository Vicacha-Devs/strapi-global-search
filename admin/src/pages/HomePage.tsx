import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  Badge,
  Box,
  Button,
  Flex,
  Loader,
  Main,
  MultiSelect,
  MultiSelectOption,
  Searchbar,
  SearchForm,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Layouts } from '@strapi/strapi/admin';
import useGlobalSearch from '../hooks/useGlobalSearch';
import useSearchableTypes from '../hooks/useSearchableTypes';
import { fetchLocales } from '../api/searchApi';
import { Highlight } from '../components/Highlight';
import useTrad from '../utils/useTrad';
import type { LocaleOption } from '../types';

const ClickableRow = styled(Tr)`
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.neutral100};
  }
`;

const PAGE_SIZES = [10, 20, 50];

const HomePage = () => {
  const t = useTrad();
  const navigate = useNavigate();
  const { contentTypes, settings, status: schemaStatus } = useSearchableTypes();
  const [pageSize, setPageSize] = useState(20);
  const [locales, setLocales] = useState<LocaleOption[]>([]);

  const search = useGlobalSearch({
    debounce: settings.debounce || 250,
    minChars: settings.minChars || 2,
    pageSize,
  });

  useEffect(() => {
    let cancelled = false;

    fetchLocales().then((data) => {
      if (!cancelled) setLocales(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const { results, groups, pagination, meta } = search.data;
  const minChars = settings.minChars || 2;
  const trimmed = search.query.trim();

  const renderResults = () => {
    if (search.status === 'error') {
      return (
        <Box padding={8} background="neutral0" hasRadius>
          <Typography textColor="danger600">
            {t('home.error')}
          </Typography>
        </Box>
      );
    }

    if (search.isBelowMinChars || (search.status === 'idle' && !trimmed)) {
      return (
        <Box padding={8} background="neutral0" hasRadius>
          <Typography variant="delta" textColor="neutral600">
            {search.isBelowMinChars
              ? t('common.minChars', { count: minChars })
              : t('home.idle')}
          </Typography>
          <Box paddingTop={2}>
            <Typography textColor="neutral500">
              {t('home.idleHint')}
            </Typography>
          </Box>
        </Box>
      );
    }

    if (search.status === 'loading' && !results.length) {
      return (
        <Flex justifyContent="center" padding={8}>
          <Loader>{t('common.searching')}</Loader>
        </Flex>
      );
    }

    if (!results.length) {
      return (
        <Box padding={8} background="neutral0" hasRadius>
          <Typography variant="delta" textColor="neutral600">
            {t('common.noResults', { query: trimmed })}
          </Typography>
          <Box paddingTop={2}>
            <Typography textColor="neutral500">
              {search.selectedTypes.length
                ? t('home.noResults.clearFilters')
                : t('home.noResults.shorter')}
            </Typography>
          </Box>
        </Box>
      );
    }

    return (
      <Table colCount={7} rowCount={results.length}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">{t('home.table.type')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.id')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.name')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.matched')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.locale')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.status')}</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">{t('home.table.updated')}</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {results.map((hit) => (
            <ClickableRow
              key={`${hit.contentTypeUid}-${hit.documentId || hit.id}-${hit.locale || ''}`}
              onClick={() => navigate(hit.adminUrl)}
            >
              <Td>
                <Typography textColor="neutral800">{hit.contentTypeLabel}</Typography>
              </Td>
              <Td>
                <Typography textColor="neutral600">{hit.documentId || hit.id}</Typography>
              </Td>
              <Td>
                <Typography fontWeight="semiBold" textColor="neutral800">
                  <Highlight text={String(hit.title)} query={trimmed} textColor="neutral800" />
                </Typography>
              </Td>
              <Td>
                {hit.matchedField ? (
                  <Box maxWidth="32rem">
                    <Typography variant="pi" textColor="neutral500">
                      {hit.matchedFieldLabel}
                    </Typography>
                    <Box>
                      <Typography variant="pi">
                        <Highlight text={hit.matchedSnippet || ''} query={trimmed} />
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography textColor="neutral400">—</Typography>
                )}
              </Td>
              <Td>
                <Typography textColor="neutral600">{hit.locale || '—'}</Typography>
              </Td>
              <Td>
                {hit.status ? <Badge>{hit.status}</Badge> : <Typography textColor="neutral400">—</Typography>}
              </Td>
              <Td>
                <Typography textColor="neutral600">
                  {hit.updatedAt ? new Date(hit.updatedAt).toLocaleDateString() : '—'}
                </Typography>
              </Td>
            </ClickableRow>
          ))}
        </Tbody>
      </Table>
    );
  };

  return (
    <Main aria-busy={search.status === 'loading'}>
      <Layouts.Header
        title={t('plugin.name')}
        subtitle={
          schemaStatus === 'success'
            ? t('home.subtitle', { count: contentTypes.length })
            : t('home.subtitleLoading')
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4}>
          <Flex gap={2} alignItems="flex-end" wrap="wrap">
            <Box grow={1} minWidth="16rem">
              <SearchForm>
                <Searchbar
                  name="global-search"
                  value={search.query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    search.setQuery(event.target.value)
                  }
                  onClear={() => search.setQuery('')}
                  clearLabel={t('home.search.clear')}
                  placeholder={t('home.search.placeholder')}
                >
                  {t('home.search.label')}
                </Searchbar>
              </SearchForm>
            </Box>

            {contentTypes.length ? (
              <Box minWidth="18rem" maxWidth="28rem">
                <MultiSelect
                  aria-label={t('home.filter.contentTypes')}
                  placeholder={t('home.filter.contentTypesPlaceholder')}
                  value={search.selectedTypes}
                  onChange={(value: string[]) => search.setSelectedTypes(value)}
                  onClear={search.clearTypes}
                  clearLabel={t('home.filter.contentTypesClear')}
                  withTags
                  size="S"
                >
                  {contentTypes.map((type) => {
                    const group = groups.find((item) => item.uid === type.uid);
                    const countLabel = group
                      ? ` (${group.count}${group.truncated ? '+' : ''})`
                      : '';

                    return (
                      <MultiSelectOption key={type.uid} value={type.uid}>
                        {type.displayName}
                        {countLabel}
                      </MultiSelectOption>
                    );
                  })}
                </MultiSelect>
              </Box>
            ) : null}

            {locales.length > 1 ? (
              <Box minWidth="16rem">
                <SingleSelect
                  aria-label={t('home.filter.locale')}
                  value={search.locale}
                  onChange={search.setLocale as (value: string | number) => void}
                  size="S"
                >
                  <SingleSelectOption value="all">{t('home.filter.allLocales')}</SingleSelectOption>
                  {locales.map((locale) => (
                    <SingleSelectOption key={locale.code} value={locale.code}>
                      {locale.name || locale.code}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Box>
            ) : null}
          </Flex>

          {renderResults()}

          {results.length ? (
            <Flex justifyContent="space-between" alignItems="center">
              <Flex gap={2} alignItems="center">
                <Typography textColor="neutral600" variant="pi">
                  {t('home.summary', {
                    results: t('common.results', {
                      count: pagination.total,
                      capped: meta.capped ? '+' : '',
                    }),
                    groups: groups.length,
                  })}
                  {meta.truncatedTypes && meta.truncatedTypes.length ? t('home.truncated') : ''}
                </Typography>
                <Box minWidth="7rem">
                  <SingleSelect
                    aria-label={t('home.perPageLabel')}
                    value={String(pageSize)}
                    onChange={(value: string | number) => setPageSize(Number(value))}
                    size="S"
                  >
                    {PAGE_SIZES.map((size) => (
                      <SingleSelectOption key={size} value={String(size)}>
                        {t('home.perPage', { size })}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Box>
              </Flex>

              <Flex gap={2} alignItems="center">
                <Button
                  variant="tertiary"
                  disabled={pagination.page <= 1}
                  onClick={() => search.setPage(pagination.page - 1)}
                >
                  {t('home.previous')}
                </Button>
                <Typography variant="pi" textColor="neutral600">
                  {t('home.page', {
                    page: pagination.page,
                    pageCount: pagination.pageCount || 1,
                  })}
                </Typography>
                <Button
                  variant="tertiary"
                  disabled={pagination.page >= pagination.pageCount}
                  onClick={() => search.setPage(pagination.page + 1)}
                >
                  {t('home.next')}
                </Button>
              </Flex>
            </Flex>
          ) : null}
        </Flex>
      </Layouts.Content>
    </Main>
  );
};

export { HomePage };
export default HomePage;
