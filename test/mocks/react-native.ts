/** Minimal react-native stand-in for logic tests; pose constants only read Platform.OS. */
export const Platform = {
  OS: 'ios' as const,
  select<T>(options: { ios?: T; native?: T; default?: T }): T | undefined {
    return options.ios ?? options.native ?? options.default;
  },
};
