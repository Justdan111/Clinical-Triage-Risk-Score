// Haptics (DESIGN.md §6). Fire-and-forget: a device without a haptic engine,
// or a rejected promise, must never affect the UI.

import * as Haptics from 'expo-haptics';

function safe(p: Promise<void>) {
  p.catch(() => undefined);
}

export const haptics = {
  /** A field became filled. */
  tick: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A chip or toggle option was chosen. */
  select: () => safe(Haptics.selectionAsync()),
  /** Submit pressed with all 7 vitals. */
  submit: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Dimmed submit pressed. */
  nudge: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** red_flagged, medium and high results. Never used for low. */
  warning: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
