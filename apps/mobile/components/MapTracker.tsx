/**
 * MapTracker — live tracking map built on react-native-maps. Renders the
 * destination, the live driver/technician position (animated as new GPS pings
 * arrive), and optionally the path between them. Used by:
 *  - customer order tracking (driver marker)
 *  - driver active delivery (self + destination)
 *  - technician active job (self + destination)
 *
 * It is a pure presentational component — callers feed it coordinates; GPS
 * sourcing (expo-location stream or realtime channel) lives in the screens.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { palette, radii } from '../lib/palette';
import { AppText } from './Text';

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface MapTrackerProps {
  /** Moving actor (driver/technician). */
  origin?: LatLng | null;
  /** Fixed target (customer address / job site). */
  destination?: LatLng | null;
  height?: number;
  originLabel?: string;
  destinationLabel?: string;
  showRoute?: boolean;
  style?: object;
}

function regionFor(points: LatLng[]): Region {
  if (points.length === 0) {
    return { latitude: 29.3759, longitude: 47.9774, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.6, 0.02);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.6, 0.02);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

export function MapTracker({
  origin,
  destination,
  height = 260,
  originLabel,
  destinationLabel,
  showRoute = true,
  style,
}: MapTrackerProps) {
  const points = [origin, destination].filter(Boolean) as LatLng[];
  const region = regionFor(points);

  return (
    <View style={[styles.wrap, { height }, style]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        showsUserLocation={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        {destination ? (
          <Marker coordinate={destination} title={destinationLabel} pinColor={palette.danger} />
        ) : null}
        {origin ? (
          <Marker coordinate={origin} title={originLabel} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <View style={styles.driverDot} />
            </View>
          </Marker>
        ) : null}
        {showRoute && origin && destination ? (
          <Polyline
            coordinates={[origin, destination]}
            strokeColor={palette.primary}
            strokeWidth={4}
            lineDashPattern={[8, 8]}
          />
        ) : null}
      </MapView>

      {points.length === 0 ? (
        <View style={styles.placeholder}>
          <AppText tone="muted">—</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: palette.neutral200,
  },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  driverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(67,56,202,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
