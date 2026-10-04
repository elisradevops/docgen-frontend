import { useEffect, useState } from 'react';

/** Returns `value` only after it has stopped changing for `delayMs` (default 300). */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
