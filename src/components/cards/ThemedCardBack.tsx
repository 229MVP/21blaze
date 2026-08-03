import { CardBack, type CardBackVariant } from './CardBack';
import { resolveThemeDefinition } from '../../themes/themeRegistry';

type Props = {
  /** A `ThemeDefinition.themeId` in the `card_back` category, e.g. `'ember_card_back'`. */
  themeId: string;
  width?: number;
  height?: number;
};

/**
 * Version 1.2A — theme-registry-aware card back. Resolves `themeId`
 * through the registry (falling back to classic when missing/disabled)
 * and renders the existing, working `CardBack` component underneath —
 * this never introduces a second card-back rendering engine.
 */
export function ThemedCardBack({ themeId, width, height }: Props) {
  const definition = resolveThemeDefinition('card_back', themeId);
  const variant: CardBackVariant = definition.themeId === 'ember_card_back' ? 'ember' : 'classic';
  return <CardBack width={width} height={height} variant={variant} />;
}
