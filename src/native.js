/**
 * Native bridge — detects if running inside native WebView (Expo) or browser.
 * The Expo app posts messages to the WebView; we listen and respond.
 */

// Check if we're inside a React Native WebView
export const isNative = typeof window !== 'undefined' && !!window.ReactNativeWebView;
export const platform = 'web'; // always web from this side

// ── Send message to native Expo shell ──
function postToNative(type, payload = {}) {
  if (!isNative) return;
  window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
}

// ── Haptics ──
export function hapticTap() {
  postToNative('haptic');
}
export function hapticSuccess() {
  postToNative('hapticSuccess');
}
export function hapticWarning() {
  postToNative('hapticWarning');
}
export function hapticHeavy() {
  postToNative('hapticHeavy');
}

// ── Status Bar ──
export function initStatusBar() {
  postToNative('initStatusBar');
}

// ── Request/response bridge ──
// Native side sends responses back via window.postMessage
const pendingRequests = new Map();
let reqId = 0;

function requestFromNative(type, payload = {}) {
  if (!isNative) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++reqId;
    pendingRequests.set(id, resolve);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type, id, ...payload }));
    // Timeout after 10s
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve(null);
      }
    }, 10000);
  });
}

// Listen for responses from native
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data?.responseId && pendingRequests.has(data.responseId)) {
        pendingRequests.get(data.responseId)(data.payload);
        pendingRequests.delete(data.responseId);
      }
      // Handle live pedometer updates
      if (data?.type === 'pedometerUpdate' && _pedometerCallback) {
        _pedometerCallback(data.steps);
      }
    } catch {}
  });
}

// ── Steps ──
export async function readNativeSteps() {
  if (!isNative) return { steps: 0, source: 'manual' };
  const result = await requestFromNative('readSteps');
  return result || { steps: 0, source: 'manual' };
}

export async function writeNativeSteps(steps) {
  if (!isNative) return false;
  postToNative('writeSteps', { steps });
  return true;
}

// ── Weight ──
export async function readNativeWeight() {
  if (!isNative) return [];
  const result = await requestFromNative('readWeight');
  return result || [];
}

// ── Camera ──
export async function takePhoto() {
  if (!isNative) return null;
  const result = await requestFromNative('takePhoto');
  return result; // { uri, format } or null
}

// ── Pick image from gallery ──
export async function pickImage() {
  if (!isNative) return null;
  const result = await requestFromNative('pickImage');
  return result; // { uri, format } or null
}

// ── Live Pedometer ──
let _pedometerCallback = null;
export function subscribePedometer(callback) {
  _pedometerCallback = callback;
  postToNative('subscribePedometer');
  return () => {
    _pedometerCallback = null;
    postToNative('unsubscribePedometer');
  };
}

// ── Share ──
export async function nativeShare(title, text) {
  if (!isNative) return false;
  postToNative('share', { title, text });
  return true;
}

// ── Notifications ──
export async function scheduleNotification(title, body, secondsFromNow) {
  if (!isNative) return false;
  postToNative('scheduleNotification', { title, body, seconds: secondsFromNow });
  return true;
}

// ── Keep screen awake (for workouts) ──
export function keepAwake(enabled) {
  postToNative('keepAwake', { enabled });
}
