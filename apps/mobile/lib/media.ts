/**
 * Photo capture + upload helper for proof-of-delivery and installation jobs.
 *
 * Captures via expo-image-picker (camera or library) and, when a live backend
 * is present, uploads to the Supabase Storage `field-media` bucket returning a
 * public URL. In demo mode it returns the local file URI so the UI still shows
 * the captured image.
 */
import * as ImagePicker from 'expo-image-picker';
import { getSupabase } from './supabase';
import { hasLiveBackend } from './env';

export interface CapturedPhoto {
  /** Local URI (always present) for immediate preview. */
  uri: string;
  /** Remote URL after upload (live backend only). */
  remoteUrl?: string;
}

/** Launch the camera, capture a photo, and (live) upload it. */
export async function capturePhoto(folder: string): Promise<CapturedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!lib.granted) return null;
    return pickFromLibrary(folder);
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    base64: hasLiveBackend,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  if (result.canceled || !result.assets[0]) return null;
  return upload(result.assets[0], folder);
}

async function pickFromLibrary(folder: string): Promise<CapturedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.6,
    base64: hasLiveBackend,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  if (result.canceled || !result.assets[0]) return null;
  return upload(result.assets[0], folder);
}

async function upload(asset: ImagePicker.ImagePickerAsset, folder: string): Promise<CapturedPhoto> {
  const client = getSupabase();
  if (!hasLiveBackend || !client || !asset.base64) {
    return { uri: asset.uri };
  }
  const path = `${folder}/${Date.now()}.jpg`;
  const bytes = decodeBase64(asset.base64);
  const { error } = await client.storage.from('field-media').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) return { uri: asset.uri };
  const { data } = client.storage.from('field-media').getPublicUrl(path);
  return { uri: asset.uri, remoteUrl: data.publicUrl };
}

/** Base64 → Uint8Array (RN has atob via the url-polyfill / global). */
function decodeBase64(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}
