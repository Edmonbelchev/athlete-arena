import { useCallback, useRef, useState } from 'react';

/** setState that skips React updates when the next value is unchanged (===). */
export function useStableState<T>(initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState(initial);
  const valueRef = useRef(initial);

  const setStableValue = useCallback((next: T) => {
    if (Object.is(valueRef.current, next)) {
      return;
    }

    valueRef.current = next;
    setValue(next);
  }, []);

  return [value, setStableValue];
}
