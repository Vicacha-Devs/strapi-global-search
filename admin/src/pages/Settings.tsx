import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Flex,
  Grid,
  Main,
  NumberInput,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Toggle,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Check } from '@strapi/icons';
import { Layouts, Page, useNotification, useRBAC } from '@strapi/strapi/admin';
import { fetchAllTypes, fetchSettings, resetSettings, updateSettings } from '../api/searchApi';
import { invalidateSearchableTypes } from '../hooks/useSearchableTypes';
import pluginPermissions from '../permissions';
import type { ContentTypeSummary, PluginSettings } from '../types';

const NUMBER_FIELDS: Array<{
  name: keyof PluginSettings;
  label: string;
  hint: string;
}> = [
  { name: 'minChars', label: 'Minimum characters', hint: 'Shorter queries are not sent to the server.' },
  { name: 'debounce', label: 'Debounce (ms)', hint: 'How long to wait after the last keystroke.' },
  { name: 'perTypeLimit', label: 'Results per content type', hint: 'Rows fetched from each type.' },
  { name: 'maxResults', label: 'Maximum results', hint: 'Hard cap on the merged, ranked list.' },
  { name: 'maxDepth', label: 'Component depth', hint: 'How many component levels to search into.' },
  { name: 'queryTimeout', label: 'Query timeout (ms)', hint: 'A slower content type is skipped.' },
];

const SettingsPage = () => {
  const { toggleNotification } = useNotification();
  const { allowedActions } = useRBAC(pluginPermissions.settings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<PluginSettings | null>(null);
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);

  const canEdit = (allowedActions as { canSettings?: boolean }).canSettings !== false;

  const load = async () => {
    setIsLoading(true);

    try {
      const [nextSettings, schema] = await Promise.all([fetchSettings(), fetchAllTypes()]);

      setSettings(nextSettings);
      setContentTypes(schema.contentTypes || []);
    } catch (error) {
      toggleNotification({ type: 'danger', message: 'Could not load global search settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = <K extends keyof PluginSettings>(name: K, value: PluginSettings[K]) =>
    setSettings((previous) => (previous ? { ...previous, [name]: value } : previous));

  const toggleContentType = (uid: string) => {
    setSettings((previous) => {
      if (!previous) return previous;

      const excluded = previous.excludedContentTypes || [];

      return {
        ...previous,
        excludedContentTypes: excluded.includes(uid)
          ? excluded.filter((item) => item !== uid)
          : [...excluded, uid],
      };
    });
  };

  const save = async () => {
    if (!settings) return;

    setIsSaving(true);

    try {
      const saved = await updateSettings(settings);

      setSettings(saved);
      invalidateSearchableTypes();
      toggleNotification({ type: 'success', message: 'Global search settings saved.' });
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        (err.response &&
          err.response.data &&
          err.response.data.error &&
          err.response.data.error.message) ||
        'Could not save global search settings.';

      toggleNotification({ type: 'danger', message });
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefaults = async () => {
    setIsSaving(true);

    try {
      setSettings(await resetSettings());
      invalidateSearchableTypes();
      toggleNotification({ type: 'success', message: 'Defaults restored.' });
    } catch (error) {
      toggleNotification({ type: 'danger', message: 'Could not restore defaults.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) return <Page.Loading />;

  const excluded = settings.excludedContentTypes || [];

  return (
    <Main>
      <Layouts.Header
        title="Global Search"
        subtitle="Tune how the search page and the Ctrl/Cmd + K palette query your content."
        primaryAction={
          <Flex gap={2}>
            <Button variant="tertiary" onClick={restoreDefaults} disabled={!canEdit || isSaving}>
              Restore defaults
            </Button>
            <Button startIcon={<Check />} onClick={save} loading={isSaving} disabled={!canEdit}>
              Save
            </Button>
          </Flex>
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={6}>
          <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
            <Typography variant="delta">Search behaviour</Typography>

            <Box paddingTop={4}>
              <Grid.Root gap={4}>
                {NUMBER_FIELDS.map((field) => (
                  <Grid.Item key={field.name} col={4} s={12}>
                    <NumberInput
                      name={field.name}
                      label={field.label}
                      hint={field.hint}
                      value={settings[field.name] as number}
                      onValueChange={(value: number | undefined) =>
                        setField(field.name, value as PluginSettings[typeof field.name])
                      }
                      disabled={!canEdit}
                    />
                  </Grid.Item>
                ))}

                <Grid.Item col={4} s={12}>
                  <Toggle
                    name="deep"
                    label="Search inside components"
                    hint="Also match fields nested in components."
                    onLabel="On"
                    offLabel="Off"
                    checked={Boolean(settings.deep)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setField('deep', event.target.checked)
                    }
                    disabled={!canEdit}
                  />
                </Grid.Item>

                <Grid.Item col={4} s={12}>
                  <Toggle
                    name="includeDrafts"
                    label="Include drafts"
                    hint="Search unpublished entries too."
                    onLabel="On"
                    offLabel="Off"
                    checked={Boolean(settings.includeDrafts)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setField('includeDrafts', event.target.checked)
                    }
                    disabled={!canEdit}
                  />
                </Grid.Item>

                <Grid.Item col={4} s={12}>
                  <Toggle
                    name="includePluginContentTypes"
                    label="Include plugin content types"
                    hint="Also search visible content types registered by plugins."
                    onLabel="On"
                    offLabel="Off"
                    checked={settings.includePluginContentTypes !== false}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setField('includePluginContentTypes', event.target.checked)
                    }
                    disabled={!canEdit}
                  />
                </Grid.Item>
              </Grid.Root>
            </Box>
          </Box>

          <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
            <Typography variant="delta">Content types</Typography>
            <Box paddingTop={1} paddingBottom={4}>
              <Typography textColor="neutral600" variant="pi">
                Every API and visible plugin content type is discovered automatically. Turn one off
                to exclude it from search results.
              </Typography>
            </Box>

            <Table colCount={5} rowCount={contentTypes.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Content type</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Kind</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Main field</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Searchable fields</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Enabled</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {contentTypes.map((type) => (
                  <Tr key={type.uid}>
                    <Td>
                      <Box>
                        <Typography textColor="neutral800" fontWeight="semiBold">
                          {type.displayName}
                        </Typography>
                        <Box>
                          <Typography variant="pi" textColor="neutral500">
                            {type.uid}
                          </Typography>
                        </Box>
                      </Box>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600">
                        {type.kind === 'singleType' ? 'Single' : 'Collection'}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600">{type.mainField}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor={type.searchable ? 'neutral600' : 'danger600'}>
                        {type.searchable ? type.fieldCount : 'none'}
                      </Typography>
                    </Td>
                    <Td>
                      <Toggle
                        name={`enabled-${type.uid}`}
                        aria-label={`Enable search for ${type.displayName}`}
                        onLabel="On"
                        offLabel="Off"
                        checked={!excluded.includes(type.uid)}
                        onChange={() => toggleContentType(type.uid)}
                        disabled={!canEdit || !type.searchable}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Flex>
      </Layouts.Content>
    </Main>
  );
};

export { SettingsPage };
export default SettingsPage;
