import type { ReactNode } from 'react';
import { Image, ImageBackground, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { blazeAssets } from '../../assets/blazeAssets';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { resolveThemeDefinition } from '../../themes/themeRegistry';
import { colors } from '../../theme/uiKit';

export type ArenaBackgroundVariant = 'home' | 'gameplay' | 'plain' | 'dramatic';
export type ArenaCropMode = 'cover' | 'contain' | 'anchored';

const BASE_SOURCES: Record<ArenaBackgroundVariant, ImageSourcePropType> = {
  home: blazeAssets.lavaBackground,
  gameplay: blazeAssets.gameplayEmbers,
  plain: blazeAssets.gameplayEmbersSubtle,
  dramatic: blazeAssets.lavaBackground,
};

const CROP_TO_RESIZE_MODE: Record<ArenaCropMode, 'cover' | 'contain' | 'center'> = {
  cover: 'cover',
  contain: 'contain',
  anchored: 'center',
};

type Props = {
  children: ReactNode;
  /** A `ThemeDefinition.themeId` in the `arena` category, e.g. `'lava_arena_tint'`. */
  arenaThemeId: string;
  variant?: ArenaBackgroundVariant;
  cropMode?: ArenaCropMode;
  /** Lightweight ambient particles (embers). Always off under Reduced Motion. */
  ambientEffect?: boolean;
};

/**
 * Version 1.2A — layered, theme-aware arena background:
 *   1. Base background image (static, per `variant`)
 *   2. Gradient treatment (contrast for cards/UI readability)
 *   3. Optional foreground overlay (only when the resolved arena theme
 *      calls for one, e.g. the lava tint)
 *   4. Optional lightweight ambient effect (static under Reduced Motion)
 *
 * New, additive component — does not replace `BlazeScreenBackground` or
 * `BlazeBackground` (both still power production Home/Gameplay/Results
 * and Store/Settings/Progression respectively). Intended for the Theme
 * Preview screen now and as the composition target for 1.2B.
 */
export function ThemedArenaBackground({
  children,
  arenaThemeId,
  variant = 'gameplay',
  cropMode = 'cover',
  ambientEffect = false,
}: Props) {
  const reduceMotion = useReducedMotionSetting();
  const definition = resolveThemeDefinition('arena', arenaThemeId);
  const isLava = definition.themeId === 'lava_arena_tint';
  const showAmbient = ambientEffect && !reduceMotion;

  return (
    <ImageBackground
      source={BASE_SOURCES[variant]}
      resizeMode={CROP_TO_RESIZE_MODE[cropMode]}
      style={styles.fill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={['rgba(3,5,7,.20)', 'rgba(3,5,7,.70)']}
        style={styles.fill}
      >
        {isLava ? (
          <LinearGradient
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            colors={['transparent', 'transparent', 'rgba(120,16,4,0.32)', 'rgba(20,4,2,0.5)']}
            locations={[0, 0.55, 0.85, 1]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.content}>{children}</View>
        {showAmbient ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[StyleSheet.absoluteFill, styles.embers]}
          >
            <Image
              source={blazeAssets.emberOverlay}
              style={styles.embersImage}
              resizeMode="cover"
            />
          </View>
        ) : null}
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background.primary },
  content: { flex: 1 },
  embers: {
    opacity: 0.35,
  },
  embersImage: {
    width: '100%',
    height: '100%',
  },
});
