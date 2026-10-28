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

export type AccessorySlot = 'top' | 'headwear' | 'earrings';
export type WearableBodyType = AvatarBodyType | 'unisex';

export type WearableStyle =
  | 'tee'
  | 'hoodie'
  | 'headband'
  | 'cap'
  | 'beanie'
  | 'studs'
  | 'hoops'
  | 'drops';

export interface WearableColors {
  primary: string;
  secondary: string;
}

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
  starter: boolean;
  owned: boolean;
}

/** Equipped wearable item ids by slot. Every slot is optional; a default tee is drawn without a top. */
export type AvatarAccessories = Partial<Record<AccessorySlot, string>>;

/** Equipped wearables resolved for rendering (no ownership info needed). */
export type AvatarAccessoryStyles = Partial<
  Record<AccessorySlot, { style: WearableStyle; colors: WearableColors }>
>;

export interface UserAvatar {
  appearance: AvatarAppearance;
  accessories: AvatarAccessories;
  version: number;
}
