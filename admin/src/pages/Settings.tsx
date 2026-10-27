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
import useTrad from '../utils/useTrad';
import type { ContentTypeSummary, PluginSettings } from '../types';

const NUMBER_FIELDS: Array<keyof PluginSettings> = [
  'minChars',
  'debounce',
  'perTypeLimit',
  'maxResults',
  'maxDepth',
  'queryTimeout',
];

const SettingsPage = () => {
  const t = useTrad();
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
      toggleNotification({ type: 'danger', message: t('settings.notify.loadError') });
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
      toggleNotification({ type: 'success', message: t('settings.notify.saved') });
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        (err.response &&
          err.response.data &&
          err.response.data.error &&
          err.response.data.error.message) ||
        t('settings.notify.saveError');

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
      toggleNotification({ type: 'success', message: t('settings.notify.restored') });
    } catch (error) {
      toggleNotification({ type: 'danger', message: t('settings.notify.restoreError') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) return <Page.Loading />;

  const excluded = settings.excludedContentTypes || [];

  return (
    <Main>
      <Layouts.Header
        title={t('plugin.name')}
        subtitle={t('settings.subtitle')}
        primaryAction={
          <Flex gap={2}>
            <Button variant="tertiary" onClick={restoreDefaults} disabled={!canEdit || isSaving}>
              {t('settings.restore')}
            </Button>
            <Button startIcon={<Check />} onClick={save} loading={isSaving} disabled={!canEdit}>
              {t('settings.save')}
            </Button>
          </Flex>
        }
      />

      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={6}>
          <Box background="neutral0" padding={6} hasRadius shadow="tableShadow">
            <Typography variant="delta">{t('settings.behaviour')}</Typography>

            <Box paddingTop={4}>
              <Grid.Root gap={4}>
                {NUMBER_FIELDS.map((field) => (
                  <Grid.Item key={field} col={4} s={12}>
                    <NumberInput
                      name={field}
                      label={t(`settings.field.${field}.label`)}
                      hint={t(`settings.field.${field}.hint`)}
                      value={settings[field] as number}
                      onValueChange={(value: number | undefined) =>
                        setField(field, value as PluginSettings[typeof field])
                      }
                      disabled={!canEdit}
                    />
                  </Grid.Item>
                ))}

                <Grid.Item col={4} s={12}>
                  <Toggle
                    name="deep"
                    label={t('settings.deep.label')}
                    hint={t('settings.deep.hint')}
                    onLabel={t('common.on')}
                    offLabel={t('common.off')}
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
                    label={t('settings.includeDrafts.label')}
                    hint={t('settings.includeDrafts.hint')}
                    onLabel={t('common.on')}
                    offLabel={t('common.off')}
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
                    label={t('settings.includePlugin.label')}
                    hint={t('settings.includePlugin.hint')}
                    onLabel={t('common.on')}
                    offLabel={t('common.off')}
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
            <Typography variant="delta">{t('settings.contentTypes.title')}</Typography>
            <Box paddingTop={1} paddingBottom={4}>
              <Typography textColor="neutral600" variant="pi">
                {t('settings.contentTypes.description')}
              </Typography>
            </Box>

            <Table colCount={5} rowCount={contentTypes.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">{t('settings.col.contentType')}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t('settings.col.kind')}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t('settings.col.mainField')}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t('settings.col.searchable')}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t('settings.col.enabled')}</Typography>
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
                        {type.kind === 'singleType' ? t('settings.kind.single') : t('settings.kind.collection')}
                      </Typography>
                    </Td>
                    <Td>
                      <Typography textColor="neutral600">{type.mainField}</Typography>
                    </Td>
                    <Td>
                      <Typography textColor={type.searchable ? 'neutral600' : 'danger600'}>
                        {type.searchable ? type.fieldCount : t('settings.none')}
                      </Typography>
                    </Td>
                    <Td>
                      <Toggle
                        name={`enabled-${type.uid}`}
                        aria-label={t('settings.enableFor', { name: type.displayName })}
                        onLabel={t('common.on')}
                        offLabel={t('common.off')}
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
