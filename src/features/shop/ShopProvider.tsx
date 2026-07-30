import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getEquippedItem,
  resolveShopAvatar,
  resolveShopEmote,
  resolveShopFrame,
} from '@/features/shop/shopUtils';
import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import {
  equipShopItem,
  getMyShopSummary,
  getShopCatalog,
  purchaseShopItem,
} from '@/services/shopService';
import type {
  ShopAvatarDisplay,
  ShopFrameDisplay,
  ShopItemRecord,
  ShopItemType,
  ShopSummary,
} from '@/types/shop';

interface ShopContextValue {
  items: ShopItemRecord[];
  summary: ShopSummary;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  equippedAvatar: ShopAvatarDisplay | null;
  equippedFrame: ShopFrameDisplay | null;
  equippedEmote: string | null;
  refresh: () => Promise<void>;
  purchaseItem: (itemId: string) => Promise<void>;
  equipItem: (itemId: string) => Promise<void>;
  getItemsByType: (itemType: ShopItemType) => ShopItemRecord[];
}

const emptySummary: ShopSummary = {
  coinBalance: 0,
  inventory: [],
  equipped: {},
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [items, setItems] = useState<ShopItemRecord[]>([]);
  const [summary, setSummary] = useState<ShopSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setItems([]);
      setSummary(emptySummary);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextItems, nextSummary] = await Promise.all([getShopCatalog(), getMyShopSummary()]);
      setItems(nextItems);
      setSummary(nextSummary);
    } catch (err) {
      setItems([]);
      setSummary(emptySummary);
      setError(formatUserError(err, 'Failed to load shop'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  const purchaseItem = useCallback(
    async (itemId: string) => {
      setIsUpdating(true);
      setError(null);

      try {
        await purchaseShopItem(itemId);
        await refresh();
      } catch (err) {
        setError(formatUserError(err, 'Failed to purchase item'));
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  const equipItem = useCallback(
    async (itemId: string) => {
      setIsUpdating(true);
      setError(null);

      try {
        await equipShopItem(itemId);
        await refresh();
      } catch (err) {
        setError(formatUserError(err, 'Failed to equip item'));
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equippedAvatarItem = getEquippedItem(items, summary.equipped, 'avatar');
  const equippedFrameItem = getEquippedItem(items, summary.equipped, 'frame');
  const equippedEmoteItem = getEquippedItem(items, summary.equipped, 'emote');

  const value = useMemo(
    () => ({
      items,
      summary,
      isLoading,
      isUpdating,
      error,
      equippedAvatar: resolveShopAvatar(equippedAvatarItem),
      equippedFrame: resolveShopFrame(equippedFrameItem),
      equippedEmote: resolveShopEmote(equippedEmoteItem),
      refresh,
      purchaseItem,
      equipItem,
      getItemsByType: (itemType: ShopItemType) => items.filter((item) => item.itemType === itemType),
    }),
    [
      items,
      summary,
      isLoading,
      isUpdating,
      error,
      equippedAvatarItem,
      equippedFrameItem,
      equippedEmoteItem,
      refresh,
      purchaseItem,
      equipItem,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within ShopProvider');
  }
  return context;
}
