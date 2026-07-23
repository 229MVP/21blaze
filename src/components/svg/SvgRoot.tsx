/**
 * Web-safe Svg root for react-native-svg.
 *
 * Prefer the named `Svg` export. On Expo Web, default-import interop can wrap
 * the module so `import Svg from 'react-native-svg'` is not a valid component.
 */
import { Svg } from 'react-native-svg';

export const SvgRoot = Svg;
