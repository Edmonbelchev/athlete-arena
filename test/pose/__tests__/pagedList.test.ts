import { describe, expect, it } from '@jest/globals';

import { pageItems } from '@/hooks/use-paged-list';

describe('pageItems', () => {
  const items = Array.from({ length: 11 }, (_, index) => index);

  it('shows the first page and counts what is left', () => {
    expect(pageItems(items, 4)).toEqual({ visibleItems: [0, 1, 2, 3], remainingCount: 7 });
  });

  it('shows everything once the count covers the list', () => {
    expect(pageItems(items, 12)).toEqual({ visibleItems: items, remainingCount: 0 });
    expect(pageItems([], 4)).toEqual({ visibleItems: [], remainingCount: 0 });
  });
});
