export const toIsoOrEmpty = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
};

export const toLocalDateTimeInputValue = (value) => {
  const iso = toIsoOrEmpty(value);
  if (!iso) return '';
  const parsed = new Date(iso);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

export const formatDateTime = (value) => {
  const iso = toIsoOrEmpty(value);
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const rawHours = date.getHours();
    const meridiem = rawHours >= 12 ? 'PM' : 'AM';
    const hours12 = rawHours % 12 || 12;
    const hours = String(hours12).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes} ${meridiem}`;
  } catch {
    return iso;
  }
};

export const isHistoricalCompareResultCurrent = (
  compareResult,
  selectedQueryId,
  baselineInput,
  compareToInput,
) => {
  if (!compareResult) return false;
  const queryId = String(selectedQueryId || '').trim();
  if (!queryId) return false;

  const resultQueryId = String(compareResult?.queryId || '').trim();
  const resultBaselineIso = toIsoOrEmpty(compareResult?.baseline?.asOf || compareResult?.baselineTimestamp);
  const resultCompareToIso = toIsoOrEmpty(compareResult?.compareTo?.asOf || compareResult?.compareToTimestamp);
  const currentBaselineIso = toIsoOrEmpty(baselineInput);
  const currentCompareToIso = toIsoOrEmpty(compareToInput);

  if (!resultQueryId || !resultBaselineIso || !resultCompareToIso) return false;
  return (
    resultQueryId === queryId &&
    resultBaselineIso === currentBaselineIso &&
    resultCompareToIso === currentCompareToIso
  );
};

export const validateHistoricalCompareInputs = ({ selectedQueryId, baselineInput, compareToInput }) => {
  const queryId = String(selectedQueryId || '').trim();
  const baselineIso = toIsoOrEmpty(baselineInput);
  const compareToIso = toIsoOrEmpty(compareToInput);

  const errors = {
    query: '',
    baseline: '',
    compareTo: '',
    order: '',
  };

  if (!queryId) {
    errors.query = 'Please select a shared query.';
  }
  if (!baselineIso) {
    errors.baseline = 'Please provide a valid baseline date-time.';
  }
  if (!compareToIso) {
    errors.compareTo = 'Please provide a valid compare-to date-time.';
  }

  if (baselineIso && compareToIso) {
    const baselineTs = new Date(baselineIso).getTime();
    const compareToTs = new Date(compareToIso).getTime();
    if (baselineTs === compareToTs) {
      errors.order = 'Baseline and Compare To must be different.';
    } else if (baselineTs > compareToTs) {
      errors.order = 'Compare To must be later than Baseline.';
    }
  }

  const firstError = errors.query || errors.baseline || errors.compareTo || errors.order || '';
  return {
    isValid: !firstError,
    firstError,
    baselineIso,
    compareToIso,
    errors,
  };
};
