import { useCallback, useEffect, useRef } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { duration, reveal, springs } from '@/theme/tokens';

import { staggerEndMs } from './easing';
import { haptics } from './haptics';

/** Each driver card fades/rises over this long, starting reveal.drivers.stepMs after the previous one. */
export const DRIVER_ENTER_MS = 260;

export function driversEndMs(count: number): number {
  return staggerEndMs(count, reveal.drivers.stepMs, DRIVER_ENTER_MS);
}

export interface Reveal {
  /** 0 → 1: background bg → band tint. */
  tint: SharedValue<number>;
  /** 0 → 1 (spring): band icon + label. */
  label: SharedValue<number>;
  /** 0 → 1 linear clock for the gauge; the arc and count-up apply easeOutCubic to it. */
  gauge: SharedValue<number>;
  /** 0 → 1 (spring): scale-bar marker. */
  marker: SharedValue<number>;
  /** Elapsed ms of the driver stagger, 0 → driversEndMs(count). */
  drivers: SharedValue<number>;
  /** Whole-screen opacity: used only for the Reduce Motion fade-in. */
  fade: SharedValue<number>;
  reduced: boolean;
  /** Jump straight to the final state (tap anywhere). */
  skip: () => void;
}

/**
 * The result reveal (DESIGN.md §5, approved order): tint and band label first
 * (≈0.4 s), then gauge fill and count-up, then the scale marker, then the
 * driver stagger. A tap skips to the end. Reduce Motion: everything final at
 * once, with a single short fade. The warning haptic fires exactly once.
 */
export function useReveal({ driverCount, warn }: { driverCount: number; warn: boolean }): Reveal {
  const reduced = useReducedMotion();
  const end = driversEndMs(driverCount);

  const tint = useSharedValue(reduced ? 1 : 0);
  const label = useSharedValue(reduced ? 1 : 0);
  const gauge = useSharedValue(reduced ? 1 : 0);
  const marker = useSharedValue(reduced ? 1 : 0);
  const drivers = useSharedValue(reduced ? end : 0);
  const fade = useSharedValue(reduced ? 0 : 1);

  const hapticFired = useRef(false);
  const fireHaptic = useCallback(() => {
    if (hapticFired.current) return;
    hapticFired.current = true;
    if (warn) haptics.warning(); // never for low: no celebration
  }, [warn]);

  useEffect(() => {
    if (reduced) {
      fade.value = withTiming(1, { duration: duration.fast });
    } else {
      tint.value = withTiming(1, { duration: reveal.tint.ms, easing: Easing.inOut(Easing.cubic) });
      label.value = withSpring(1, springs.label);
      gauge.value = withDelay(reveal.gauge.at, withTiming(1, { duration: reveal.gauge.ms, easing: Easing.linear }));
      marker.value = withDelay(reveal.marker.at, withSpring(1, springs.gentle));
      drivers.value = withDelay(reveal.drivers.at, withTiming(end, { duration: end, easing: Easing.linear }));
    }
    const t = setTimeout(fireHaptic, reveal.labelLands);
    return () => clearTimeout(t);
    // Runs once per mounted result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = useCallback(() => {
    // Setting a plain value cancels any running or delayed animation.
    tint.set(1);
    label.set(1);
    gauge.set(1);
    marker.set(1);
    drivers.set(end);
    fade.set(1);
    fireHaptic();
  }, [tint, label, gauge, marker, drivers, fade, end, fireHaptic]);

  return { tint, label, gauge, marker, drivers, fade, reduced, skip };
}
