import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Height of the on-screen keyboard in points (0 when hidden).
 *
 * Used to lift a footer above the keyboard. Expo apps are edge-to-edge on
 * Android, so the window no longer resizes for the keyboard, and on iOS the
 * keyboard always covers the app; either way the screen must move its own
 * content. The screen bottom is the window bottom here (no tab bar), so the
 * keyboard's height is exactly how far the footer must rise.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => setHeight(e.endCoordinates.height);
    const onHide = () => setHeight(0);

    // iOS has "will" events (move in step with the keyboard animation) and
    // reports frame changes (e.g. switching keyboards); Android only has "did".
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShow),
            Keyboard.addListener('keyboardWillChangeFrame', onShow),
            Keyboard.addListener('keyboardWillHide', onHide),
          ]
        : [Keyboard.addListener('keyboardDidShow', onShow), Keyboard.addListener('keyboardDidHide', onHide)];

    return () => subs.forEach((s) => s.remove());
  }, []);

  return height;
}
