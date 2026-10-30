export type AvatarBodyType = 'male' | 'female';

export type AvatarHeadShape = 'oval' | 'round' | 'square' | 'long';
export type AvatarEyes =
  | 'round'
  | 'almond'
  | 'big'
  | 'narrow'
  | 'lashes'
  | 'happy'
  | 'sleepy'
  | 'wink'
  | 'determined';
export type AvatarBrows =
  | 'straight'
  | 'arched'
  | 'thin'
  | 'thick'
  | 'bushy'
  | 'raised'
  | 'determined';
export type AvatarNose = 'button' | 'small' | 'soft' | 'pointed';
export type AvatarMouth =
  | 'smile'
  | 'grin'
  | 'laugh'
  | 'smirk'
  | 'tongue'
  | 'lips'
  | 'neutral'
  | 'serious';
export type AvatarHair =
  | 'bald'
  | 'buzz'
  | 'short'
  | 'side_part'
  | 'spiky'
  | 'short_spiky'
  | 'undercut'
  | 'mohawk'
  | 'man_bun'
  | 'curly'
  | 'afro'
  | 'dreads'
  | 'pixie'
  | 'bob'
  | 'long'
  | 'wavy'
  | 'ponytail'
  | 'high_ponytail'
  | 'bun'
  | 'space_buns'
  | 'braids';
export type AvatarFacialHair =
  | 'none'
  | 'stubble'
  | 'mustache'
  | 'handlebar'
  | 'goatee'
  | 'soul_patch'
  | 'chinstrap'
  | 'beard'
  | 'full_beard';

export interface AvatarAppearance {
  bodyType: AvatarBodyType;
  headShape: AvatarHeadShape;
  skinColor: string;
  eyes: AvatarEyes;
  eyeColor: string;
  brows: AvatarBrows;
  nose: AvatarNose;
  mouth: AvatarMouth;
  hair: AvatarHair;
  hairColor: string;
  facialHair: AvatarFacialHair;
  background: string;
}

export type AccessorySlot = 'top' | 'headwear' | 'glasses' | 'earrings' | 'background';
export type WearableBodyType = AvatarBodyType | 'unisex';

export type WearableStyle =
  | 'tee'
  | 'hoodie'
  | 'headband'
  | 'cap'
  | 'cap_back'
  | 'bucket'
  | 'visor'
  | 'beanie'
  | 'crown'
  | 'round_glasses'
  | 'square_glasses'
  | 'sunglasses'
  | 'aviators'
  | 'studs'
  | 'hoops'
  | 'drops'
  | 'scene_mountains'
  | 'scene_snowy_mountains'
  | 'scene_beach'
  | 'scene_sunset'
  | 'scene_forest'
  | 'scene_city'
  | 'scene_space'
  | 'scene_aurora'
  | 'scene_gym'
  | 'scene_stadium'
  | 'scene_boxing_ring'
  | 'scene_rainy_city'
  | 'scene_volcano';

export interface WearableColors {
  primary: string;
  secondary: string;
}

/** Optional chest detail on tops (used by higher shop tiers). */
export type WearablePattern = 'stripe' | 'star' | 'camo';

/** Shop price tier: basic (cheap), rare (middle), legendary (expensive). */
export type WearableTier = 'basic' | 'rare' | 'legendary';

export interface WearableItem {
  id: string;
  title: string;
  description: string;
  priceCoins: number;
  sortOrder: number;
  slot: AccessorySlot;
  bodyType: WearableBodyType;
  style: WearableStyle;
  colors: WearableColors;
  pattern?: WearablePattern;
  tier?: WearableTier;
  starter: boolean;
  owned: boolean;
}

/** Equipped wearable item ids by slot. Every slot is optional; a default tee is drawn without a top. */
export type AvatarAccessories = Partial<Record<AccessorySlot, string>>;

/** Equipped wearables resolved for rendering (no ownership info needed). */
export type AvatarAccessoryStyles = Partial<
  Record<AccessorySlot, { style: WearableStyle; colors: WearableColors; pattern?: WearablePattern }>
>;

export interface UserAvatar {
  appearance: AvatarAppearance;
  accessories: AvatarAccessories;
  version: number;
}
