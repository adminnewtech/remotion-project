/**
 * Geo helpers for field apps. Live tasks carry an address with lat/lng;
 * in demo mode we synthesize a stable destination per task id around Kuwait
 * City so the maps render meaningfully without a backend.
 */
import type { LatLng } from '../components';
import { KUWAIT_CENTER } from './sampleData';

/** Deterministic pseudo-coordinate near Kuwait City for a given task id. */
export function demoDestinationFor(taskId: string): LatLng {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = (h * 31 + taskId.charCodeAt(i)) % 1000;
  const dLat = ((h % 100) - 50) / 1000; // ±0.05
  const dLng = (((h / 100) % 100) - 50) / 1000;
  return { latitude: KUWAIT_CENTER.latitude + dLat, longitude: KUWAIT_CENTER.longitude + dLng };
}
