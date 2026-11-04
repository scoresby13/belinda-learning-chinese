/**
 * Platform layer — the bits that make Learning Chinese behave like a phone app.
 *
 *  - Lock-screen / notification media controls (Media Session)
 *      · Web & installed PWA: the browser's navigator.mediaSession
 *      · Android app (Capacitor): @capgo/capacitor-media-session, which also runs a
 *        foreground "media playback" service so audio keeps playing with the screen off
 *  - Offline: registers the service worker (web only) and stores lesson audio for offline use
 */
import { Capacitor } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();
export const AUDIO_CACHE = 'lc-audio-v1'; // shared with public/sw.js — keep in sync

// ───────────────────────────── Media Session ─────────────────────────────
let nativePlugin = null;
const nativeReady = isNativeApp
  ? import('@capgo/capacitor-media-session').then((m) => { nativePlugin = m.MediaSession; }).catch((err) => {
      console.warn('Media session plugin unavailable:', err);
    })
  : Promise.resolve();

const webSession = !isNativeApp && 'mediaSession' in navigator ? navigator.mediaSession : null;

/** The native plugin can't download from the app's virtual https://localhost, so pass artwork as data URLs. */
async function toDataUrl(src) {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export const mediaSession = {
  async setMetadata({ title, artist, album, artwork = [] }) {
    try {
      if (webSession && 'MediaMetadata' in window) {
        webSession.metadata = new window.MediaMetadata({ title, artist, album, artwork });
      } else if (isNativeApp) {
        await nativeReady;
        if (!nativePlugin) return;
        const art = artwork.length ? [{ ...artwork[artwork.length - 1], src: await toDataUrl(artwork[artwork.length - 1].src) }] : [];
        await nativePlugin.setMetadata({ title, artist, album, artwork: art });
      }
    } catch (err) { console.warn('setMetadata failed', err); }
  },

  async setPlaybackState(playbackState) {
    try {
      if (webSession) webSession.playbackState = playbackState;
      else if (isNativeApp) { await nativeReady; await nativePlugin?.setPlaybackState({ playbackState }); }
    } catch (err) { console.warn('setPlaybackState failed', err); }
  },

  async setPositionState({ duration, position, playbackRate }) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    const state = { duration, position: Math.min(Math.max(0, position), duration), playbackRate: playbackRate || 1 };
    try {
      if (webSession?.setPositionState) webSession.setPositionState(state);
      else if (isNativeApp) { await nativeReady; await nativePlugin?.setPositionState(state); }
    } catch { /* some browsers reject during track changes — harmless */ }
  },

  /** handlers: { play, pause, seekbackward, seekforward, previoustrack, nexttrack, seekto(details) } */
  async setActionHandlers(handlers) {
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        if (webSession) webSession.setActionHandler(action, handler);
        else if (isNativeApp) {
          await nativeReady;
          await nativePlugin?.setActionHandler({ action }, (details) => handler(details || {}));
        }
      } catch { /* action not supported on this platform */ }
    }
  }
};

// ───────────────────────────── Offline ─────────────────────────────
export function registerServiceWorker() {
  if (isNativeApp || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => console.warn('SW registration failed', err));
  });
}

/**
 * Keep a full copy of a lesson's audio for offline listening (web/PWA).
 * Done in the background after the lesson loads; the service worker serves it with Range support.
 */
export async function cacheAudioForOffline(url) {
  if (isNativeApp || !('caches' in window) || !url) return false;
  try {
    const abs = new URL(url, location.href).href;
    const cache = await caches.open(AUDIO_CACHE);
    if (await cache.match(abs)) return true;
    const res = await fetch(abs, { cache: 'no-store' });
    if (!res.ok || res.status !== 200) return false;
    await cache.put(abs, res);
    return true;
  } catch { return false; }
}
