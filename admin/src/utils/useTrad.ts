import { useIntl } from 'react-intl';
import en from '../translations/en.json';
import getTrad from './getTrad';

const DEFAULTS = en as Record<string, string>;

type Values = Record<string, string | number | boolean | null | undefined>;

/** `t('home.next')` — English from en.json is the fallback for any missing translation. */
const useTrad = () => {
  const { formatMessage } = useIntl();

  return (id: string, values?: Values): string =>
    formatMessage({ id: getTrad(id), defaultMessage: DEFAULTS[id] || id }, values);
};

export default useTrad;
