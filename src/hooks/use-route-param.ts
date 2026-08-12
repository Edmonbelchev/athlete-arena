import { useLocalSearchParams } from 'expo-router';

/** Normalize expo-router params that may be string or string[]. */
export function useRouteParam(name: string): string | undefined {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}
