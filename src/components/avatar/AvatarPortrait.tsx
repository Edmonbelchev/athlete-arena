import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import {
  AvatarFacialHair,
  AvatarHairBack,
  AvatarHairCap,
  AvatarHairFront,
  JAW_CLIP_RECT,
  beardClipPath,
  beardDrapePath,
  hairClipScale,
} from '@/components/avatar/AvatarHair';
import { AvatarBackgroundScene, isSceneStyle } from '@/components/avatar/AvatarBackgroundScene';
import {
  AvatarEarrings,
  AvatarFace,
  AvatarGlasses,
  AvatarHeadShapePart,
  AvatarHeadwear,
  AvatarNeck,
  AvatarTop,
} from '@/components/avatar/AvatarHeadParts';

/** How far hat crowns sit above the scalp (see hairOutlinePath). */
const HEADWEAR_VOLUME = 1.16;
import {
  FACE_VIEWBOX,
  PORTRAIT_VIEWBOX,
  hairOutlinePath,
  hairOutlineTop,
  headFitTransform,
  shoulderTransform,
} from '@/components/avatar/avatarGeometry';
import {
  BACKGROUND_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_COLORS,
  resolveColor,
} from '@/features/avatar/avatarOptions';
import {
  AvatarRaceEars,
  AvatarRaceOverFace,
  AvatarRaceUnderFace,
  androidGlowColor,
  raceSkinColor,
} from '@/components/avatar/AvatarRaceParts';
import { accessoryRace } from '@/features/avatar/avatarWardrobe';
import type { AvatarAccessoryStyles, AvatarAppearance } from '@/types/avatar';

interface AvatarPortraitProps {
  appearance: AvatarAppearance;
  accessories: AvatarAccessoryStyles;
  /** Width and height in points. */
  size: number;
  showBackground?: boolean;
  /** 'face' zooms in on the face; used for small option previews. */
  crop?: 'portrait' | 'face';
}

/**
 * Layered SVG head-and-shoulders avatar. Layer order (back to front):
 * hair back → neck → top → head (+ race brow / cheeks) → beard → face (+ orc tusks) → hair cap →
 * hair volume → race ears → earrings → glasses → headwear.
 * Hair caps and beards are clipped to the head outline so they fit every head shape.
 */
export function AvatarPortrait({
  appearance,
  accessories,
  size,
  showBackground = false,
  crop = 'portrait',
}: AvatarPortraitProps) {
  // Clip ids must be unique per SVG on screen; useId may contain characters invalid in url(#...).
  const idPrefix = `avatar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const hairClipId = `${idPrefix}hair`;
  const beardClipId = `${idPrefix}beard`;
  const beardDrapeClipId = `${idPrefix}beardDrape`;
  const jawClipId = `${idPrefix}jaw`;
  const topClipId = `${idPrefix}top`;
  const headwearClipId = `${idPrefix}headwear`;

  const race = accessoryRace(accessories);
  const skin = raceSkinColor(race, appearance.skinColor, resolveColor(SKIN_COLORS, appearance.skinColor));
  const hairColor = resolveColor(HAIR_COLORS, appearance.hairColor);
  const eyeColor = resolveColor(EYE_COLORS, appearance.eyeColor);
  const glow = androidGlowColor(appearance.eyeColor);
  const { x, y, size: box } = crop === 'face' ? FACE_VIEWBOX : PORTRAIT_VIEWBOX;
  const shape = appearance.headShape;
  const fit = headFitTransform(shape);
  const scene = accessories.background;
  const sceneStyle = scene && isSceneStyle(scene.style) ? scene.style : null;
  // Items outlined against the backdrop use the scene's horizon color when one is equipped.
  const background = scene && sceneStyle ? scene.colors.secondary : resolveColor(BACKGROUND_COLORS, appearance.background);
  const drapePath = beardDrapePath(appearance.facialHair);

  return (
    <Svg width={size} height={size} viewBox={`${x} ${y} ${box} ${box}`}>
      <Defs>
        <ClipPath id={hairClipId}>
          <Path d={hairOutlinePath(shape, hairClipScale(appearance.hair, appearance.bodyType))} />
        </ClipPath>
        <ClipPath id={beardClipId}>
          <Path d={beardClipPath(appearance.facialHair, shape)} />
        </ClipPath>
        {drapePath ? (
          <ClipPath id={beardDrapeClipId}>
            <Path d={drapePath} />
          </ClipPath>
        ) : null}
        <ClipPath id={jawClipId}>
          <Rect {...JAW_CLIP_RECT} />
        </ClipPath>
        <ClipPath id={headwearClipId}>
          <Path d={hairOutlinePath(shape, HEADWEAR_VOLUME)} />
        </ClipPath>
      </Defs>
      {showBackground && scene && sceneStyle ? (
        <AvatarBackgroundScene
          scene={sceneStyle}
          colors={scene.colors}
          x={PORTRAIT_VIEWBOX.x}
          y={PORTRAIT_VIEWBOX.y}
          size={PORTRAIT_VIEWBOX.size}
          idPrefix={idPrefix}
        />
      ) : showBackground ? (
        <Rect x={x} y={y} width={box} height={box} fill={background} />
      ) : null}
      <G transform={fit}>
        <AvatarHairBack hair={appearance.hair} bodyType={appearance.bodyType} color={hairColor} />
      </G>
      <G transform={shoulderTransform(appearance.bodyType)}>
        <AvatarNeck skin={skin} />
        <AvatarTop accessories={accessories} background={background} clipId={topClipId} />
      </G>
      <AvatarHeadShapePart shape={shape} skin={skin} showEars={race === null} showBlush={race === null} />
      {race ? (
        <AvatarRaceUnderFace race={race} skin={skin} plating={appearance.androidPlating} glow={glow} />
      ) : null}
      <AvatarFacialHair
        facialHair={appearance.facialHair}
        headShape={shape}
        color={hairColor}
        clipId={beardClipId}
        drapeClipId={beardDrapeClipId}
        jawClipId={jawClipId}
      />
      <AvatarFace appearance={appearance} skin={skin} eyeColor={eyeColor} hairColor={hairColor} />
      {race ? (
        <AvatarRaceOverFace
          race={race}
          bodyType={appearance.bodyType}
          tusks={appearance.tusks}
          skin={skin}
          androidEyes={appearance.androidEyes}
          glow={glow}
        />
      ) : null}
      <AvatarHairCap
        hair={appearance.hair}
        bodyType={appearance.bodyType}
        headShape={shape}
        color={hairColor}
        skin={skin}
        clipId={hairClipId}
      />
      <G transform={fit}>
        <AvatarHairFront hair={appearance.hair} bodyType={appearance.bodyType} color={hairColor} />
      </G>
      {/* Race ears go over the hair so the tips show through long hairstyles. */}
      {race ? (
        <AvatarRaceEars
          race={race}
          ears={race === 'elf' ? appearance.elfEars : appearance.orcEars}
          shape={shape}
          skin={skin}
          bodyType={appearance.bodyType}
          glow={glow}
        />
      ) : null}
      <AvatarEarrings accessories={accessories} headShape={shape} />
      <AvatarGlasses accessories={accessories} />
      <AvatarHeadwear
        accessories={accessories}
        background={background}
        clipId={headwearClipId}
        crownOutline={hairOutlinePath(shape, HEADWEAR_VOLUME)}
        crownTop={hairOutlineTop(shape, HEADWEAR_VOLUME)}
        fitTransform={fit}
      />
    </Svg>
  );
}
