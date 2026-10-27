import styled from 'styled-components';
import { Badge, Box, Flex, Typography } from '@strapi/design-system';
import { Highlight } from './Highlight';
import type { SearchHit } from '../types';

interface RowThemeProps {
  theme: { colors: Record<string, string> };
  $active?: boolean;
}

const Row = styled(Box)<{ $active?: boolean }>`
  cursor: pointer;
  border-left: 3px solid
    ${({ theme, $active }: RowThemeProps) =>
      $active ? theme.colors.primary600 : 'transparent'};
  background: ${({ theme, $active }: RowThemeProps) =>
    $active ? theme.colors.primary100 : 'transparent'};

  &:hover {
    background: ${({ theme, $active }: RowThemeProps) =>
      $active ? theme.colors.primary100 : theme.colors.neutral100};
  }
`;

interface ResultItemProps {
  hit: SearchHit;
  query: string;
  isActive: boolean;
  onSelect: (hit: SearchHit) => void;
  onHover?: () => void;
}

/** One hit in the Cmd+K palette: identity first, then what actually matched. */
const ResultItem = ({ hit, query, isActive, onSelect, onHover = () => {} }: ResultItemProps) => (
  <Row
    $active={isActive}
    paddingTop={3}
    paddingBottom={3}
    paddingLeft={4}
    paddingRight={4}
    onClick={() => onSelect(hit)}
    onMouseEnter={onHover}
    role="option"
    aria-selected={isActive}
    id={`global-search-option-${hit.contentTypeUid}-${hit.documentId || hit.id}`}
  >
    <Flex justifyContent="space-between" gap={4} alignItems="flex-start">
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Flex gap={2} alignItems="center">
          <Typography fontWeight="semiBold" textColor="neutral800" ellipsis>
            {hit.title}
          </Typography>
          <Typography variant="pi" textColor="neutral500">
            #{hit.documentId || hit.id}
          </Typography>
        </Flex>

        {hit.matchedSnippet && hit.matchedField !== hit.mainField ? (
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral500">
              {hit.matchedFieldLabel}:{' '}
            </Typography>
            <Typography variant="pi" tag="span">
              <Highlight text={hit.matchedSnippet} query={query} />
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Flex gap={2} alignItems="center" shrink={0}>
        {hit.locale ? (
          <Typography variant="pi" textColor="neutral500">
            {hit.locale}
          </Typography>
        ) : null}
        {hit.status ? <Badge>{hit.status}</Badge> : null}
        <Typography variant="pi" textColor="neutral600">
          {hit.contentTypeLabel}
        </Typography>
      </Flex>
    </Flex>
  </Row>
);

export { ResultItem };
