import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { WearableColors, WearableStyle } from '@/types/avatar';

export type SceneStyle = Extract<WearableStyle, `scene_${string}`>;

export const SCENE_STYLES: SceneStyle[] = [
  'scene_mountains',
  'scene_snowy_mountains',
  'scene_beach',
  'scene_sunset',
  'scene_forest',
  'scene_city',
  'scene_space',
  'scene_aurora',
  'scene_gym',
  'scene_stadium',
  'scene_boxing_ring',
  'scene_rainy_city',
  'scene_volcano',
];

export function isSceneStyle(style: WearableStyle | undefined): style is SceneStyle {
  return typeof style === 'string' && style.startsWith('scene_');
}

interface AvatarBackgroundSceneProps {
  scene: SceneStyle;
  /** primary = top of the sky, secondary = horizon. */
  colors: WearableColors;
  /** Portrait view box the scene fills. */
  x: number;
  y: number;
  size: number;
  idPrefix: string;
}

/**
 * Illustrated backdrops drawn behind the avatar. Shapes are laid out on a 0-1 grid over the
 * view box; the avatar covers the lower middle, so detail sits along the top and sides.
 */
export function AvatarBackgroundScene({ scene, colors, x, y, size, idPrefix }: AvatarBackgroundSceneProps) {
  const skyId = `${idPrefix}sky`;
  const px = (u: number) => x + u * size;
  const py = (v: number) => y + v * size;
  /** Path from normalized points: [[u, v], ...] closed. */
  const poly = (points: [number, number][]) =>
    `M${points.map(([u, v]) => `${px(u)} ${py(v)}`).join(' L')} Z`;

  const sky = (
    <>
      <Defs>
        <LinearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} />
          <Stop offset="1" stopColor={colors.secondary} />
        </LinearGradient>
      </Defs>
      <Rect x={x} y={y} width={size} height={size} fill={`url(#${skyId})`} />
    </>
  );

  switch (scene) {
    case 'scene_mountains':
      return (
        <G>
          {sky}
          <Circle cx={px(0.8)} cy={py(0.18)} r={size * 0.07} fill="#FDE68A" />
          <Path d={poly([[0, 0.62], [0.18, 0.34], [0.34, 0.55], [0.52, 0.3], [0.72, 0.52], [0.88, 0.36], [1, 0.5], [1, 1], [0, 1]])} fill="#64748B" />
          <Path d={poly([[0, 0.72], [0.2, 0.5], [0.42, 0.7], [0.62, 0.48], [0.84, 0.68], [1, 0.58], [1, 1], [0, 1]])} fill="#3F6B4E" />
          <Path d={poly([[0, 0.86], [0.3, 0.76], [0.62, 0.84], [1, 0.74], [1, 1], [0, 1]])} fill="#2F5540" />
        </G>
      );
    case 'scene_snowy_mountains':
      return (
        <G>
          {sky}
          <Path d={poly([[0, 0.6], [0.14, 0.28], [0.4, 0.62], [0.6, 0.5], [0.84, 0.24], [1, 0.46], [1, 1], [0, 1]])} fill="#94A3B8" />
          <Path d={poly([[0.096, 0.38], [0.14, 0.28], [0.216, 0.38], [0.18, 0.355], [0.15, 0.39], [0.12, 0.36]])} fill="#F8FAFC" />
          <Path d={poly([[0.738, 0.35], [0.84, 0.24], [0.92, 0.35], [0.885, 0.33], [0.85, 0.365], [0.79, 0.33]])} fill="#F8FAFC" />
          <Path d={poly([[0, 0.74], [0.24, 0.56], [0.46, 0.72], [0.7, 0.54], [1, 0.7], [1, 1], [0, 1]])} fill="#CBD5E1" />
          <Path d={poly([[0, 0.86], [0.35, 0.78], [0.7, 0.86], [1, 0.8], [1, 1], [0, 1]])} fill="#F1F5F9" />
          {[[0.08, 0.12], [0.3, 0.08], [0.48, 0.16], [0.86, 0.1], [0.94, 0.3], [0.04, 0.4]].map(([u, v]) => (
            <Circle key={`${u}-${v}`} cx={px(u)} cy={py(v)} r={size * 0.008} fill="#FFFFFF" />
          ))}
        </G>
      );
    case 'scene_beach':
      return (
        <G>
          {sky}
          <Circle cx={px(0.2)} cy={py(0.2)} r={size * 0.08} fill="#FDE047" />
          <Ellipse cx={px(0.7)} cy={py(0.16)} rx={size * 0.1} ry={size * 0.03} fill="#FFFFFF" opacity={0.85} />
          <Rect x={px(0)} y={py(0.55)} width={size} height={size * 0.25} fill="#0EA5E9" />
          <Path
            d={`M${px(0)} ${py(0.62)} Q ${px(0.125)} ${py(0.6)} ${px(0.25)} ${py(0.62)} T ${px(0.5)} ${py(0.62)} T ${px(0.75)} ${py(0.62)} T ${px(1)} ${py(0.62)}`}
            stroke="#BAE6FD"
            strokeWidth={size * 0.012}
            fill="none"
          />
          <Path d={poly([[0, 0.78], [0.4, 0.72], [1, 0.76], [1, 1], [0, 1]])} fill="#FCD34D" />
          <Path d={`M${px(0.9)} ${py(0.78)} Q ${px(0.88)} ${py(0.55)} ${px(0.93)} ${py(0.42)}`} stroke="#92400E" strokeWidth={size * 0.02} fill="none" />
          <Path d={poly([[0.93, 0.42], [0.8, 0.44], [0.86, 0.4]])} fill="#16A34A" />
          <Path d={poly([[0.93, 0.42], [1, 0.48], [0.97, 0.4]])} fill="#16A34A" />
          <Path d={poly([[0.93, 0.42], [0.88, 0.32], [0.95, 0.36]])} fill="#22C55E" />
        </G>
      );
    case 'scene_sunset':
      return (
        <G>
          {sky}
          <Circle cx={px(0.16)} cy={py(0.5)} r={size * 0.12} fill="#FDBA74" opacity={0.9} />
          <Path d={poly([[0, 0.66], [0.25, 0.58], [0.5, 0.66], [0.78, 0.56], [1, 0.64], [1, 1], [0, 1]])} fill="#7C2D12" opacity={0.85} />
          <Path d={poly([[0, 0.78], [0.3, 0.7], [0.6, 0.78], [1, 0.7], [1, 1], [0, 1]])} fill="#431407" />
          {[[0.15, 0.2], [0.22, 0.17], [0.8, 0.26], [0.86, 0.23]].map(([u, v]) => (
            <Path
              key={`${u}-${v}`}
              d={`M${px(u - 0.02)} ${py(v)} Q ${px(u)} ${py(v - 0.02)} ${px(u + 0.02)} ${py(v)}`}
              stroke="#431407"
              strokeWidth={size * 0.006}
              fill="none"
            />
          ))}
        </G>
      );
    case 'scene_forest': {
      const pine = (u: number, base: number, height: number, fill: string) => (
        <Path key={`${u}-${base}`} d={poly([[u, base - height], [u + height * 0.32, base], [u - height * 0.32, base]])} fill={fill} />
      );
      return (
        <G>
          {sky}
          <Rect x={px(0)} y={py(0.66)} width={size} height={size * 0.34} fill="#2F5D3A" />
          {[0.04, 0.2, 0.36, 0.64, 0.8, 0.96].map((u, index) => pine(u, 0.7, 0.34 + (index % 2) * 0.08, '#2F5D3A'))}
          {[0.1, 0.28, 0.72, 0.9].map((u) => pine(u, 0.84, 0.36, '#1E4029'))}
          <Rect x={px(0)} y={py(0.84)} width={size} height={size * 0.16} fill="#14301F" />
        </G>
      );
    }
    case 'scene_city': {
      const buildings: [number, number, number][] = [
        [0, 0.12, 0.42],
        [0.12, 0.1, 0.3],
        [0.22, 0.12, 0.5],
        [0.66, 0.12, 0.46],
        [0.78, 0.1, 0.28],
        [0.88, 0.12, 0.4],
      ];
      return (
        <G>
          {sky}
          <Circle cx={px(0.82)} cy={py(0.14)} r={size * 0.05} fill="#F8FAFC" />
          {[[0.1, 0.1], [0.3, 0.2], [0.55, 0.08], [0.66, 0.22]].map(([u, v]) => (
            <Circle key={`${u}-${v}`} cx={px(u)} cy={py(v)} r={size * 0.006} fill="#E2E8F0" />
          ))}
          {buildings.map(([u, width, height]) => (
            <G key={u}>
              <Rect x={px(u)} y={py(1 - height)} width={size * width} height={size * height} fill="#1E293B" />
              {Array.from({ length: Math.floor(height / 0.08) }, (_, row) => (
                <G key={row}>
                  <Rect x={px(u + width * 0.2)} y={py(1 - height + 0.04 + row * 0.08)} width={size * width * 0.2} height={size * 0.03} fill={row % 2 ? '#FACC15' : '#475569'} />
                  <Rect x={px(u + width * 0.6)} y={py(1 - height + 0.04 + row * 0.08)} width={size * width * 0.2} height={size * 0.03} fill={row % 3 ? '#475569' : '#FACC15'} />
                </G>
              ))}
            </G>
          ))}
        </G>
      );
    }
    case 'scene_space':
      return (
        <G>
          {sky}
          {[[0.06, 0.1], [0.2, 0.32], [0.34, 0.06], [0.12, 0.6], [0.62, 0.1], [0.92, 0.42], [0.86, 0.7], [0.04, 0.84], [0.95, 0.9], [0.48, 0.04]].map(([u, v], index) => (
            <Circle key={`${u}-${v}`} cx={px(u)} cy={py(v)} r={size * (index % 3 === 0 ? 0.01 : 0.006)} fill="#F8FAFC" />
          ))}
          <Circle cx={px(0.8)} cy={py(0.2)} r={size * 0.09} fill="#A855F7" />
          <Ellipse cx={px(0.8)} cy={py(0.2)} rx={size * 0.15} ry={size * 0.035} stroke="#F0ABFC" strokeWidth={size * 0.012} fill="none" />
          <Circle cx={px(0.14)} cy={py(0.18)} r={size * 0.04} fill="#38BDF8" />
        </G>
      );
    case 'scene_aurora':
      return (
        <G>
          {sky}
          <Path
            d={`M${px(0)} ${py(0.3)} Q ${px(0.25)} ${py(0.12)} ${px(0.5)} ${py(0.28)} T ${px(1)} ${py(0.22)} L ${px(1)} ${py(0.36)} Q ${px(0.75)} ${py(0.44)} ${px(0.5)} ${py(0.38)} T ${px(0)} ${py(0.42)} Z`}
            fill="#34D399"
            opacity={0.55}
          />
          <Path
            d={`M${px(0)} ${py(0.18)} Q ${px(0.3)} ${py(0.04)} ${px(0.6)} ${py(0.16)} T ${px(1)} ${py(0.1)} L ${px(1)} ${py(0.2)} Q ${px(0.7)} ${py(0.3)} ${px(0.4)} ${py(0.24)} T ${px(0)} ${py(0.28)} Z`}
            fill="#A78BFA"
            opacity={0.45}
          />
          {[[0.1, 0.06], [0.42, 0.08], [0.78, 0.04], [0.92, 0.3]].map(([u, v]) => (
            <Circle key={`${u}-${v}`} cx={px(u)} cy={py(v)} r={size * 0.006} fill="#F8FAFC" />
          ))}
          <Path d={poly([[0, 0.8], [0.3, 0.72], [0.6, 0.8], [1, 0.74], [1, 1], [0, 1]])} fill="#E2E8F0" />
        </G>
      );
    case 'scene_gym':
      return (
        <G>
          {sky}
          <Rect x={px(0)} y={py(0.42)} width={size} height={size * 0.05} fill="#F97316" opacity={0.8} />
          <Rect x={px(0)} y={py(0.8)} width={size} height={size * 0.2} fill="#1F2937" />
          <Rect x={px(0.02)} y={py(0.56)} width={size * 0.24} height={size * 0.025} fill="#94A3B8" />
          <Rect x={px(0.02)} y={py(0.7)} width={size * 0.24} height={size * 0.025} fill="#94A3B8" />
          <Rect x={px(0.03)} y={py(0.56)} width={size * 0.02} height={size * 0.24} fill="#64748B" />
          <Rect x={px(0.23)} y={py(0.56)} width={size * 0.02} height={size * 0.24} fill="#64748B" />
          {[0.07, 0.14, 0.21].map((u) => (
            <G key={u}>
              <Circle cx={px(u)} cy={py(0.535)} r={size * 0.026} fill="#111827" />
              <Circle cx={px(u)} cy={py(0.675)} r={size * 0.03} fill="#111827" />
            </G>
          ))}
          <Rect x={px(0.74)} y={py(0.5)} width={size * 0.26} height={size * 0.018} fill="#CBD5E1" />
          <Rect x={px(0.77)} y={py(0.44)} width={size * 0.035} height={size * 0.13} rx={size * 0.006} fill="#DC2626" />
          <Rect x={px(0.95)} y={py(0.44)} width={size * 0.035} height={size * 0.13} rx={size * 0.006} fill="#DC2626" />
          <Path
            d={`M${px(0.84)} ${py(0.8)} Q ${px(0.84)} ${py(0.68)} ${px(0.88)} ${py(0.68)} Q ${px(0.92)} ${py(0.68)} ${px(0.92)} ${py(0.8)} Z`}
            fill="#111827"
          />
          <Circle cx={px(0.88)} cy={py(0.66)} r={size * 0.02} stroke="#111827" strokeWidth={size * 0.012} fill="none" />
        </G>
      );
    case 'scene_stadium': {
      const light = (u: number) => (
        <G key={u}>
          <Rect x={px(u - 0.008)} y={py(0.14)} width={size * 0.016} height={size * 0.4} fill="#475569" />
          <Rect x={px(u - 0.06)} y={py(0.08)} width={size * 0.12} height={size * 0.07} rx={size * 0.01} fill="#E2E8F0" />
          {[-0.035, 0, 0.035].map((offset) => (
            <Circle key={offset} cx={px(u + offset)} cy={py(0.115)} r={size * 0.012} fill="#FEF9C3" />
          ))}
          <Path d={poly([[u - 0.06, 0.15], [u + 0.06, 0.15], [u + 0.2, 0.62], [u - 0.2, 0.62]])} fill="#FEF9C3" opacity={0.12} />
        </G>
      );
      return (
        <G>
          {sky}
          {light(0.12)}
          {light(0.88)}
          <Rect x={px(0)} y={py(0.5)} width={size} height={size * 0.22} fill="#1E293B" />
          {Array.from({ length: 3 }, (_, row) =>
            Array.from({ length: 16 }, (_, col) => (
              <Circle
                key={`${row}-${col}`}
                cx={px(0.03 + col * 0.063 + (row % 2) * 0.03)}
                cy={py(0.55 + row * 0.055)}
                r={size * 0.011}
                fill={['#F87171', '#60A5FA', '#FBBF24', '#E2E8F0'][(row + col) % 4]}
              />
            )),
          )}
          <Rect x={px(0)} y={py(0.72)} width={size} height={size * 0.28} fill="#15803D" />
          <Rect x={px(0)} y={py(0.8)} width={size} height={size * 0.012} fill="#F8FAFC" opacity={0.8} />
        </G>
      );
    }
    case 'scene_boxing_ring':
      return (
        <G>
          {sky}
          <Path d={poly([[0.38, 0], [0.62, 0], [0.9, 0.78], [0.1, 0.78]])} fill="#FEF3C7" opacity={0.14} />
          <Rect x={px(0)} y={py(0.76)} width={size} height={size * 0.24} fill="#1D4ED8" />
          <Rect x={px(0)} y={py(0.76)} width={size} height={size * 0.03} fill="#1E3A8A" />
          <Rect x={px(0.03)} y={py(0.4)} width={size * 0.045} height={size * 0.38} fill="#E2E8F0" />
          <Rect x={px(0.925)} y={py(0.4)} width={size * 0.045} height={size * 0.38} fill="#E2E8F0" />
          <Rect x={px(0.03)} y={py(0.4)} width={size * 0.045} height={size * 0.05} fill="#DC2626" />
          <Rect x={px(0.925)} y={py(0.4)} width={size * 0.045} height={size * 0.05} fill="#2563EB" />
          {[
            [0.47, '#DC2626'],
            [0.57, '#F8FAFC'],
            [0.67, '#2563EB'],
          ].map(([v, color]) => (
            <Rect key={v as number} x={px(0.05)} y={py(v as number)} width={size * 0.9} height={size * 0.018} fill={color as string} />
          ))}
        </G>
      );
    case 'scene_rainy_city': {
      const towers: [number, number, number][] = [
        [0, 0.14, 0.5],
        [0.14, 0.12, 0.36],
        [0.26, 0.1, 0.44],
        [0.64, 0.1, 0.4],
        [0.74, 0.12, 0.52],
        [0.86, 0.14, 0.34],
      ];
      return (
        <G>
          {sky}
          <Ellipse cx={px(0.2)} cy={py(0.1)} rx={size * 0.22} ry={size * 0.07} fill="#64748B" />
          <Ellipse cx={px(0.75)} cy={py(0.08)} rx={size * 0.26} ry={size * 0.08} fill="#475569" />
          {towers.map(([u, width, height]) => (
            <G key={u}>
              <Rect x={px(u)} y={py(1 - height)} width={size * width} height={size * height} fill="#334155" />
              {Array.from({ length: Math.floor(height / 0.1) }, (_, row) => (
                <Rect
                  key={row}
                  x={px(u + width * 0.3)}
                  y={py(1 - height + 0.05 + row * 0.1)}
                  width={size * width * 0.4}
                  height={size * 0.035}
                  fill={row % 2 ? '#FDE68A' : '#1E293B'}
                  opacity={0.8}
                />
              ))}
            </G>
          ))}
          {Array.from({ length: 22 }, (_, index) => {
            const u = ((index * 37) % 100) / 100;
            const v = 0.18 + ((index * 53) % 70) / 100;
            return (
              <Path
                key={index}
                d={`M${px(u)} ${py(v)} L${px(u - 0.025)} ${py(v + 0.07)}`}
                stroke="#BAE6FD"
                strokeWidth={size * 0.006}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}
        </G>
      );
    }
    case 'scene_volcano':
      return (
        <G>
          {sky}
          <Ellipse cx={px(0.82)} cy={py(0.12)} rx={size * 0.12} ry={size * 0.06} fill="#57534E" opacity={0.85} />
          <Ellipse cx={px(0.7)} cy={py(0.06)} rx={size * 0.1} ry={size * 0.05} fill="#44403C" opacity={0.8} />
          <Path d={poly([[0.52, 1], [0.74, 0.3], [0.88, 0.3], [1.1, 1]])} fill="#292524" />
          <Path d={poly([[0.74, 0.3], [0.88, 0.3], [0.84, 0.34], [0.78, 0.34]])} fill="#F97316" />
          <Path d={poly([[0.8, 0.33], [0.83, 0.33], [0.86, 0.6], [0.82, 0.55], [0.79, 0.7], [0.77, 0.5]])} fill="#EA580C" />
          <Circle cx={px(0.8)} cy={py(0.24)} r={size * 0.018} fill="#FB923C" />
          <Circle cx={px(0.86)} cy={py(0.2)} r={size * 0.012} fill="#FDBA74" />
          <Path d={poly([[0, 0.72], [0.18, 0.56], [0.36, 0.7], [0.5, 0.66], [0.56, 1], [0, 1]])} fill="#44403C" />
          <Rect x={px(0)} y={py(0.86)} width={size} height={size * 0.14} fill="#1C1917" />
        </G>
      );
  }
}
