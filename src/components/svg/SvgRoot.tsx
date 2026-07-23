/**
 * Named Svg export for reliable Expo Web / Metro interop.
 * Prefer this over the default Svg import from react-native-svg.
 */
import { Svg } from 'react-native-svg';

export const SvgRoot = Svg;
