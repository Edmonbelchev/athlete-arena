import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { mapShopItem, mapShopSummary } from '@/features/shop/shopUtils';
import type { ShopItemRecord, ShopItemType, ShopSummary } from '@/types/shop';

interface ShopCatalogRpcRow {
  id: string;
  item_type: string;
  title: string;
  description: string;
  image_url: string | null;
  price_coins: number;
  sort_order: number;
  metadata: unknown;
  owned: boolean;
  equipped: boolean;
}

export async function getShopCatalog(itemType?: ShopItemType): Promise<ShopItemRecord[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_shop_catalog', {
    p_item_type: itemType ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapShopItem(row as ShopCatalogRpcRow))
    .filter((item): item is ShopItemRecord => item !== null);
}

export async function getMyShopSummary(): Promise<ShopSummary> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_shop_summary');

  if (error) {
    throw error;
  }

  return mapShopSummary(data);
}

export async function purchaseShopItem(itemId: string): Promise<'purchased' | 'already_owned'> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('purchase_shop_item', {
    p_item_id: itemId,
  });

  if (error) {
    throw error;
  }

  return (data as 'purchased' | 'already_owned') ?? 'already_owned';
}

export async function equipShopItem(itemId: string): Promise<'equipped'> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('equip_shop_item', {
    p_item_id: itemId,
  });

  if (error) {
    throw error;
  }

  return (data as 'equipped') ?? 'equipped';
}
