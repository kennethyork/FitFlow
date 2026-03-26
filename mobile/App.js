import { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, BackHandler, Share, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { Pedometer } from 'expo-sensors';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

// ── Config ──
// For dev: 'http://10.0.2.2:5173' (emulator) or 'http://192.168.x.x:5173' (real device)
// For production: your GitHub Pages URL
const DEV_URL = 'http://10.0.2.2:5173'; // Android emulator
// const DEV_URL = 'http://192.168.1.X:5173'; // Uncomment for real device (use your local IP)
const WEB_APP_URL = __DEV__
  ? DEV_URL
  : 'https://kennethyork.github.io/FitFlow/';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const webviewRef = useRef(null);
  const pedometerSub = useRef(null);
  const [loading, setLoading] = useState(true);

  // Handle Android back button → go back in WebView history
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, []);

  // Request notification permissions on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // ── Send response back to WebView ──
  function sendResponse(id, payload) {
    const msg = JSON.stringify({ responseId: id, payload });
    webviewRef.current?.injectJavaScript(`
      window.postMessage(${JSON.stringify(msg)}, '*');
      true;
    `);
  }

  // Send a push event to WebView (no request ID)
  function pushToWebView(type, payload) {
    const msg = JSON.stringify({ type, ...payload });
    webviewRef.current?.injectJavaScript(`
      window.postMessage(${JSON.stringify(msg)}, '*');
      true;
    `);
  }

  // ── Handle messages from WebView ──
  async function onMessage(event) {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    const { type, id } = data;

    switch (type) {
      // ── Haptics ──
      case 'haptic':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'hapticSuccess':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'hapticWarning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'hapticHeavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;

      case 'initStatusBar':
        // StatusBar is handled declaratively below
        break;

      // ── Pedometer: one-shot read ──
      case 'readSteps':
        try {
          const available = await Pedometer.isAvailableAsync();
          if (!available) {
            sendResponse(id, { steps: 0, source: 'manual' });
            break;
          }
          const { status } = await Pedometer.requestPermissionsAsync();
          if (status !== 'granted') {
            sendResponse(id, { steps: 0, source: 'manual' });
            break;
          }
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const result = await Pedometer.getStepCountAsync(startOfDay, now);
          sendResponse(id, { steps: result.steps || 0, source: 'pedometer' });
        } catch (e) {
          console.warn('Pedometer error:', e);
          sendResponse(id, { steps: 0, source: 'manual' });
        }
        break;

      // ── Pedometer: live subscription ──
      case 'subscribePedometer':
        if (pedometerSub.current) pedometerSub.current.remove();
        try {
          const avail = await Pedometer.isAvailableAsync();
          if (avail) {
            const { status } = await Pedometer.requestPermissionsAsync();
            if (status === 'granted') {
              pedometerSub.current = Pedometer.watchStepCount(({ steps }) => {
                pushToWebView('pedometerUpdate', { steps });
              });
            }
          }
        } catch (e) {
          console.warn('Pedometer subscribe error:', e);
        }
        break;

      case 'unsubscribePedometer':
        if (pedometerSub.current) {
          pedometerSub.current.remove();
          pedometerSub.current = null;
        }
        break;

      case 'writeSteps':
        sendResponse(id, true);
        break;

      case 'readWeight':
        sendResponse(id, []);
        break;

      // ── Camera ──
      case 'takePhoto':
        try {
          const camPerm = await ImagePicker.requestCameraPermissionsAsync();
          if (camPerm.status !== 'granted') {
            sendResponse(id, null);
            break;
          }
          const camResult = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
          });
          if (camResult.canceled) {
            sendResponse(id, null);
          } else {
            sendResponse(id, {
              uri: camResult.assets[0].uri,
              format: camResult.assets[0].mimeType || 'image/jpeg',
            });
          }
        } catch (e) {
          console.warn('Camera error:', e);
          sendResponse(id, null);
        }
        break;

      // ── Gallery picker ──
      case 'pickImage':
        try {
          const galPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (galPerm.status !== 'granted') {
            sendResponse(id, null);
            break;
          }
          const galResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
          });
          if (galResult.canceled) {
            sendResponse(id, null);
          } else {
            sendResponse(id, {
              uri: galResult.assets[0].uri,
              format: galResult.assets[0].mimeType || 'image/jpeg',
            });
          }
        } catch (e) {
          console.warn('Gallery error:', e);
          sendResponse(id, null);
        }
        break;

      // ── Share ──
      case 'share':
        try {
          await Share.share({
            title: data.title || 'FitFlow',
            message: data.text || '',
          });
        } catch (e) {
          console.warn('Share error:', e);
        }
        break;

      // ── Notifications ──
      case 'scheduleNotification':
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: data.title || 'FitFlow',
              body: data.body || '',
              sound: true,
            },
            trigger: { seconds: data.seconds || 60 },
          });
        } catch (e) {
          console.warn('Notification error:', e);
        }
        break;

      // ── Keep screen awake ──
      case 'keepAwake':
        // expo-keep-awake can be added later if needed
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }

  // Cleanup pedometer on unmount
  useEffect(() => {
    return () => {
      if (pedometerSub.current) pedometerSub.current.remove();
    };
  }, []);

  // JavaScript injected into WebView to mark it as native
  const injectedJS = `
    window.ReactNativeWebView = window.ReactNativeWebView || true;
    true;
  `;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f1117" />
      <WebView
        ref={webviewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowFileAccess={true}
        allowsBackForwardNavigationGestures={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="compatibility"
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#6c5ce7" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  loader: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1117',
  },
});
