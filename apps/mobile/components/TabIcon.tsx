/**
 * TabIcon — lightweight tab-bar icon using an emoji glyph (no icon-font
 * dependency). Dims when inactive. Replaceable with a vector icon set later.
 */
import React from 'react';
import { Text } from 'react-native';

interface TabIconProps {
  glyph: string;
  color?: string;
  focused?: boolean;
  size?: number;
}

export function TabIcon({ glyph, focused, size = 22 }: TabIconProps) {
  return <Text style={{ fontSize: size, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;
}
