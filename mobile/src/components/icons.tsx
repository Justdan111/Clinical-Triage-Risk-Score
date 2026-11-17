// Hand-drawn stroke icons on a 24×24 grid (react-native-svg, bundled in Expo Go).
// Decorative by default: the surrounding control carries the accessible label.

import Svg, { Circle, Path } from 'react-native-svg';

import type { BandIconName } from '@/triage/labels';

export type IconName =
  | 'lungs'
  | 'droplet'
  | 'gauge'
  | 'heartPulse'
  | 'thermometer'
  | 'brain'
  | 'air'
  | 'plus'
  | 'minus'
  | 'back'
  | 'info'
  | BandIconName;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {paths(name, stroke, color)}
    </Svg>
  );
}

type Stroke = { stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round'; fill: 'none' };

function paths(name: IconName, s: Stroke, color: string) {
  switch (name) {
    case 'lungs':
      return (
        <>
          <Path {...s} d="M12 3.5v7M12 10.5l-2.2 1.6M12 10.5l2.2 1.6" />
          <Path {...s} d="M9.8 8.4v7.2c0 2.2-1.3 3.8-3.4 4.1-1.9.3-3-1.1-3-3.3 0-4.3 2.5-8.8 5.2-9.4.7-.2 1.2.4 1.2 1.4z" />
          <Path {...s} d="M14.2 8.4v7.2c0 2.2 1.3 3.8 3.4 4.1 1.9.3 3-1.1 3-3.3 0-4.3-2.5-8.8-5.2-9.4-.7-.2-1.2.4-1.2 1.4z" />
        </>
      );
    case 'droplet':
      return <Path {...s} d="M12 3.5c3 3.7 6 7.3 6 10.6a6 6 0 0 1-12 0c0-3.3 3-6.9 6-10.6z" />;
    case 'gauge':
      return (
        <>
          <Path {...s} d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" />
          <Path {...s} d="M12 14l4-4.5" />
          <Circle cx={12} cy={14} r={1.6} fill={color} />
          <Path {...s} d="M7 11.2l-.9-.5M12 7.2V6.2M17 11.2l.9-.5" />
        </>
      );
    case 'heartPulse':
      return (
        <>
          <Path {...s} d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />
          <Path {...s} d="M6.2 12.6h2.6l1.4-2.3 2 4.6 1.4-2.3h4.2" />
        </>
      );
    case 'thermometer':
      return (
        <>
          <Path {...s} d="M10 5a2 2 0 0 1 4 0v8.8a4 4 0 1 1-4 0z" />
          <Path {...s} d="M12 15.2V9" />
          <Circle cx={12} cy={17} r={1.7} fill={color} />
        </>
      );
    case 'brain':
      return (
        <>
          <Path {...s} d="M11.5 5.2a2.6 2.6 0 0 0-4.9-.9A2.9 2.9 0 0 0 4.2 8a2.9 2.9 0 0 0-.3 4.9A3 3 0 0 0 6.6 18a2.7 2.7 0 0 0 4.9.6z" />
          <Path {...s} d="M12.5 5.2a2.6 2.6 0 0 1 4.9-.9A2.9 2.9 0 0 1 19.8 8a2.9 2.9 0 0 1 .3 4.9 3 3 0 0 1-2.7 5.1 2.7 2.7 0 0 1-4.9.6z" />
          <Path {...s} d="M7.5 10.5c1 0 1.8.6 2 1.5M16.5 10.5c-1 0-1.8.6-2 1.5" />
        </>
      );
    case 'air':
      return (
        <>
          <Path {...s} d="M3.5 9h10a2.8 2.8 0 1 0-2.8-2.8" />
          <Path {...s} d="M3.5 13h14.5a3 3 0 1 1-3 3" />
          <Path {...s} d="M3.5 17h6" />
        </>
      );
    case 'plus':
      return <Path {...s} d="M12 5.5v13M5.5 12h13" />;
    case 'minus':
      return <Path {...s} d="M5.5 12h13" />;
    case 'back':
      return <Path {...s} d="M14.5 5.5 8 12l6.5 6.5" />;
    case 'info':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={9} />
          <Path {...s} d="M12 11v5.5" />
          <Circle cx={12} cy={7.8} r={1.2} fill={color} />
        </>
      );
    case 'check':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={9} />
          <Path {...s} d="M8 12.4l2.7 2.7L16.2 9.6" />
        </>
      );
    case 'flag':
      return (
        <>
          <Path {...s} d="M5.5 21V3.5" />
          <Path {...s} d="M5.5 4.6c2.4-1.3 4.6-1.3 7 0s4.6 1.3 7 0v8.6c-2.4 1.3-4.6 1.3-7 0s-4.6-1.3-7 0" />
        </>
      );
    case 'triangle':
      return (
        <>
          <Path {...s} d="M12 3.8 21.5 20h-19z" />
          <Path {...s} d="M12 10v4.5" />
          <Circle cx={12} cy={17.3} r={1.2} fill={color} />
        </>
      );
    case 'octagon':
      return (
        <>
          <Path {...s} d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z" />
          <Path {...s} d="M12 7.5v5.8" />
          <Circle cx={12} cy={16.6} r={1.2} fill={color} />
        </>
      );
  }
}
