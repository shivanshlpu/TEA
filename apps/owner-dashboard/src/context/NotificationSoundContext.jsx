// ── Notification & Sound Engine Context — Owner Dashboard ──
// Synthesizes crystal-clear alert sounds (Chime, Cash Register, Kitchen Digital, Doorbell)
// Supports custom audio file upload (.mp3, .wav, .ogg) stored locally
// Manages Web Push subscription, OS notification permissions, and top-of-screen live alert banner.

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth, SOCKET_URL, API_BASE } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const NotificationSoundContext = createContext(null);

const STORAGE_KEYS = {
  SOUND_TYPE: 'cafeos_owner_sound_type',
  CUSTOM_AUDIO_DATA: 'cafeos_owner_custom_audio',
  CUSTOM_AUDIO_NAME: 'cafeos_owner_custom_name',
  VOLUME: 'cafeos_owner_sound_volume',
  PROMPT_DISMISSED: 'cafeos_owner_perm_dismissed',
};

// Convert VAPID base64 string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String) {
  const cleanKey = (base64String || '').trim();
  const padding = '='.repeat((4 - (cleanKey.length % 4)) % 4);
  const base64 = (cleanKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationSoundProvider({ children }) {
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();

  const [soundType, setSoundType] = useState(() => localStorage.getItem(STORAGE_KEYS.SOUND_TYPE) || 'chime');
  const [customAudioData, setCustomAudioData] = useState(() => localStorage.getItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA) || null);
  const [customAudioName, setCustomAudioName] = useState(() => localStorage.getItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME) || '');
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [volume, setVolume] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEYS.VOLUME);
    return v !== null ? parseFloat(v) : 0.85;
  });

  const [permission, setPermission] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied';
  });
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null);

  const audioCtxRef = useRef(null);
  const customAudioRef = useRef(null);
  const bannerTimerRef = useRef(null);

  // Initialize or resume Web Audio Context on first user touch
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Unlock audio context on user interaction anywhere on page
  useEffect(() => {
    const unlock = () => {
      getAudioContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [getAudioContext]);

  // ── Sync notification sound preference from MongoDB Atlas on load/login ──
  useEffect(() => {
    let isMounted = true;

    const fetchCloudSound = async () => {
      try {
        let data = null;
        try {
          data = await apiFetch('/settings/notification-sound');
        } catch (fetchErr) {
          // Fallback to root /settings
          data = await apiFetch('/settings');
        }

        if (!isMounted || !data) return;
        const activeSoundType = data.soundType || data.notificationSoundType;
        if (activeSoundType) {
          setSoundType(activeSoundType);
          localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, activeSoundType);
        }
        if (data.customNotificationData) {
          setCustomAudioData(data.customNotificationData);
          setCustomAudioName(data.customNotificationName || 'Custom Ringtone');
          setIsCloudSynced(true);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA, data.customNotificationData);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME, data.customNotificationName || 'Custom Ringtone');
        } else {
          // If server explicitly reports no custom audio or another soundType
          if (activeSoundType && activeSoundType !== 'custom') {
            setCustomAudioData(null);
            setCustomAudioName('');
            setIsCloudSynced(false);
            localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
            localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
          } else {
            setIsCloudSynced(false);
          }
        }
      } catch (err) {
        console.warn('Could not fetch cloud notification sound (using cached):', err.message);
      }
    };

    fetchCloudSound();

    return () => {
      isMounted = false;
    };
  }, [user, apiFetch]);

  // ── Synthesized Audio Generators ──
  const playSynthesizedChime = useCallback((vol) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (crystal chord)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(vol * 0.35, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.75);
    });
  }, [getAudioContext]);

  const playSynthesizedCashRegister = useCallback((vol) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Metallic latch click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickGain.gain.setValueAtTime(vol * 0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.09);

    // Ka-Ching bells
    const bellPitches = [1760, 2637]; // A6, E7
    bellPitches.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.08 + idx * 0.05);

      gain.gain.setValueAtTime(0, now + 0.08 + idx * 0.05);
      gain.gain.linearRampToValueAtTime(vol * 0.45, now + 0.08 + idx * 0.05 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08 + idx * 0.05 + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + 0.08 + idx * 0.05);
      osc.stop(now + 0.08 + idx * 0.05 + 0.9);
    });
  }, [getAudioContext]);

  const playSynthesizedDigitalBuzzer = useCallback((vol) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const beeps = [880, 880, 1174]; // A5, A5, D6 urgent kitchen pattern

    beeps.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(vol * 0.22, now + idx * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.1);
    });
  }, [getAudioContext]);

  const playSynthesizedDoorbell = useCallback((vol) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Classic Ding-Dong (E5 -> C5)
    const tones = [{ f: 659.25, t: 0, d: 0.7 }, { f: 523.25, t: 0.35, d: 0.9 }];

    tones.forEach((tone) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.f, now + tone.t);

      gain.gain.setValueAtTime(0, now + tone.t);
      gain.gain.linearRampToValueAtTime(vol * 0.4, now + tone.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tone.t + tone.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + tone.t);
      osc.stop(now + tone.t + tone.d + 0.05);
    });
  }, [getAudioContext]);

  // Master Play Alert Function
  const playAlertSound = useCallback((targetType = null) => {
    const activeType = targetType || soundType;
    const currentVol = volume;

    if (activeType === 'custom' && customAudioData) {
      try {
        if (!customAudioRef.current) {
          customAudioRef.current = new Audio(customAudioData);
        } else {
          customAudioRef.current.src = customAudioData;
        }
        customAudioRef.current.volume = currentVol;
        customAudioRef.current.currentTime = 0;
        customAudioRef.current.play().catch((err) => {
          console.warn('Failed to play custom audio, falling back to chime:', err);
          playSynthesizedChime(currentVol);
        });
        return;
      } catch (err) {
        console.warn('Custom audio playback error:', err);
      }
    }

    switch (activeType) {
      case 'cash_register':
        playSynthesizedCashRegister(currentVol);
        break;
      case 'digital':
        playSynthesizedDigitalBuzzer(currentVol);
        break;
      case 'doorbell':
        playSynthesizedDoorbell(currentVol);
        break;
      case 'chime':
      default:
        playSynthesizedChime(currentVol);
        break;
    }
  }, [soundType, volume, customAudioData, playSynthesizedChime, playSynthesizedCashRegister, playSynthesizedDigitalBuzzer, playSynthesizedDoorbell]);

  // ── Custom Sound Upload Handler (Persists to MongoDB Atlas across all devices) ──
  const uploadCustomSound = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected'));
      if (!file.type.startsWith('audio/')) {
        return reject(new Error('Please upload a valid audio file (.mp3, .wav, .ogg, .m4a)'));
      }
      if (file.size > 3 * 1024 * 1024) {
        return reject(new Error('Audio file must be under 3MB'));
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        try {
          // Test if audio is decodable
          const testAudio = new Audio(base64);
          testAudio.volume = volume;
          await testAudio.play().catch(() => {});

          // 1. Update local state & cache immediately so user gets instant sound playback
          setCustomAudioData(base64);
          setCustomAudioName(file.name);
          setSoundType('custom');
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA, base64);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME, file.name);
          localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, 'custom');

          // 2. Persist to MongoDB Atlas across all devices
          setIsSyncing(true);
          const payload = {
            soundType: 'custom',
            customNotificationName: file.name,
            customNotificationData: base64,
          };

          try {
            let res = null;
            try {
              res = await apiFetch('/settings/notification-sound', {
                method: 'PUT',
                body: payload,
              });
            } catch (putErr) {
              console.warn('PUT /settings/notification-sound failed, attempting POST fallback:', putErr.message);
              try {
                res = await apiFetch('/settings/notification-sound', {
                  method: 'POST',
                  body: payload,
                });
              } catch (postErr) {
                console.warn('POST /settings/notification-sound failed, falling back to root PUT /settings:', postErr.message);
                res = await apiFetch('/settings', {
                  method: 'PUT',
                  body: {
                    notificationSoundType: 'custom',
                    customNotificationName: file.name,
                    customNotificationData: base64,
                  },
                });
              }
            }
            setIsCloudSynced(true);
            resolve({ name: file.name, size: file.size, synced: true });
          } catch (syncErr) {
            setIsCloudSynced(false);
            console.error('Cloud database sync error:', syncErr);
            reject(new Error(`Saved locally on this device, but failed to save to cloud database (${syncErr.message || 'Network error'}). Click 'Retry Sync' to sync to other devices.`));
          } finally {
            setIsSyncing(false);
          }
        } catch (err) {
          setIsSyncing(false);
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsDataURL(file);
    });
  };

  const retrySyncCustomSound = async () => {
    if (!customAudioData) {
      toast.error('No custom audio file loaded to sync.');
      return;
    }
    setIsSyncing(true);
    try {
      const payload = {
        soundType: 'custom',
        notificationSoundType: 'custom',
        customNotificationName: customAudioName || 'Custom Ringtone',
        customNotificationData: customAudioData,
      };
      try {
        await apiFetch('/settings/notification-sound', {
          method: 'PUT',
          body: payload,
        });
      } catch (putErr) {
        console.warn('PUT /settings/notification-sound failed, attempting fallback to PUT /settings:', putErr.message);
        await apiFetch('/settings', {
          method: 'PUT',
          body: payload,
        });
      }
      setIsCloudSynced(true);
      toast.success('Custom ringtone saved to database and synced across all devices!');
    } catch (err) {
      setIsCloudSynced(false);
      toast.error('Cloud database sync failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const removeCustomSound = async () => {
    setCustomAudioData(null);
    setCustomAudioName('');
    setSoundType('chime');
    setIsCloudSynced(false);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, 'chime');

    try {
      await apiFetch('/settings/notification-sound', { method: 'DELETE' });
    } catch (err) {
      console.warn('DELETE /settings/notification-sound failed, attempting fallback to PUT /settings:', err.message);
      try {
        await apiFetch('/settings', {
          method: 'PUT',
          body: {
            notificationSoundType: 'chime',
            customNotificationName: null,
            customNotificationData: null,
          },
        });
      } catch (fallbackErr) {
        console.warn('Failed to delete cloud notification sound:', fallbackErr.message);
      }
    }
  };

  const updateSoundType = async (type) => {
    setSoundType(type);
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, type);
    // Play preview of chosen sound
    playAlertSound(type);

    // Save to database across all devices
    try {
      try {
        await apiFetch('/settings/notification-sound', {
          method: 'PUT',
          body: { soundType: type },
        });
      } catch (subErr) {
        await apiFetch('/settings', {
          method: 'PUT',
          body: { notificationSoundType: type },
        });
      }
    } catch (err) {
      console.warn('Failed to sync sound type to server:', err.message);
    }
  };

  const updateVolume = (val) => {
    const num = Math.max(0, Math.min(1, parseFloat(val)));
    setVolume(num);
    localStorage.setItem(STORAGE_KEYS.VOLUME, num.toString());
  };

  // ── Top Floating Banner Alert ──
  const triggerTopBanner = useCallback((bannerInfo) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner(bannerInfo);
    // Auto dismiss after 14 seconds
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 14000);
  }, []);

  const dismissBanner = () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setActiveBanner(null);
  };

  // ── Auto-sync active push subscription on dashboard load ──
  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            setIsSubscribed(true);
            // Silently sync device subscription into MongoDB Atlas
            apiFetch('/notifications/push/subscribe', {
              method: 'POST',
              body: { subscription: sub },
            }).catch(() => {});
          } else {
            setIsSubscribed(false);
          }
        } catch (err) {
          console.warn('Silent push sync check:', err);
        }
      }).catch(() => {});
    }
  }, [user, apiFetch]);

  // ── Web Push Subscription & Device Registration ──
  const requestPermissionAndSubscribe = async (isManualClick = true) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      if (isManualClick) toast.error('This browser does not support Web Push notifications.');
      return false;
    }

    // Check iOS PWA requirement
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIOS && !isStandalone && isManualClick) {
      toast.info('📱 Note for iPhone/iPad: To receive alerts when the screen is locked, tap Share (bottom bar) ➔ "Add to Home Screen".');
    }

    setIsSubscribing(true);
    try {
      getAudioContext(); // Unlock audio context on tap

      let perm = Notification.permission;
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
        setPermission(perm);
      } else {
        setPermission('granted');
      }

      if (perm !== 'granted') {
        setIsSubscribed(false);
        if (isManualClick) toast.error('Notification permission was not granted. Please allow notifications in your browser/device settings.');
        return false;
      }

      // Fetch VAPID public key
      const { publicKey } = await apiFetch('/notifications/push/vapid-key');
      if (!publicKey) throw new Error('VAPID public key unavailable from server');

      // Ensure service worker is registered & active
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;

      if (!registration.pushManager) {
        throw new Error('Service Worker Push Manager is not supported or active on this browser');
      }

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        try {
          // Sync existing subscription to MongoDB Atlas
          await apiFetch('/notifications/push/subscribe', {
            method: 'POST',
            body: { subscription },
          });
          setIsSubscribed(true);
          if (isManualClick) {
            toast.success('🔔 Phone alerts re-synchronized & registered successfully!');
            playAlertSound();
          }
          return true;
        } catch (syncErr) {
          console.warn('Existing subscription could not be synced, renewing:', syncErr);
          try {
            await subscription.unsubscribe();
          } catch (_) {}
          subscription = null;
        }
      }

      // If no valid subscription exists, create fresh with retry
      let newSub;
      try {
        newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch (subErr) {
        console.warn('Initial push subscribe attempt error:', subErr);
        // Force cleanup any dangling or broken subscription before retry
        try {
          const stale = await registration.pushManager.getSubscription();
          if (stale) await stale.unsubscribe();
        } catch (_) {}
        // Wait briefly for browser push provider to reset state
        await new Promise((r) => setTimeout(r, 150));
        newSub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      // Save to MongoDB Atlas
      await apiFetch('/notifications/push/subscribe', {
        method: 'POST',
        body: { subscription: newSub },
      });

      setIsSubscribed(true);
      if (isManualClick) {
        toast.success('🔔 Phone alerts registered & enabled successfully!');
        playAlertSound();
      }
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      const msg = err.message || '';
      const isPushServiceError = msg.toLowerCase().includes('push service error');

      let isBrave = false;
      try {
        if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
          isBrave = await navigator.brave.isBrave();
        }
      } catch (_) {}

      if (isPushServiceError && isBrave) {
        toast.error('Brave Browser: Enable "Use Google services for push messaging" in brave://settings/privacy, then refresh.');
      } else if (isPushServiceError) {
        toast.error('Push Service Error: Google FCM push is blocked by your browser, adblocker, or network. (Live dashboard audio & banner alerts are active!).');
      } else if (isManualClick) {
        toast.error('Could not activate push notifications: ' + (err.message || 'Unknown error'));
      }
      return false;
    } finally {
      setIsSubscribing(false);
    }
  };

  // ── Clean Reset Service Worker & Reconnect Push ──
  const resetAndSubscribe = async () => {
    setIsSubscribing(true);
    try {
      getAudioContext();
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
          } catch (_) {}
          await reg.unregister();
        }
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      }
      return await requestPermissionAndSubscribe(true);
    } catch (err) {
      console.warn('Reset SW error:', err);
      toast.error('Could not reset service worker: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setIsSubscribing(false);
    }
  };

  // ── Native System OS Notification (Active whenever app/tab is open or in background) ──
  const showNativeNotification = useCallback((title, body, tag = 'tea-bhatti', data = { url: '/orders' }) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon.png',
            vibrate: [300, 100, 300],
            tag,
            renotify: true,
            data,
          }).catch(() => {
            try { new Notification(title, { body, icon: '/icons/icon-192x192.png', tag }); } catch (_) {}
          });
        }).catch(() => {
          try { new Notification(title, { body, icon: '/icons/icon-192x192.png', tag }); } catch (_) {}
        });
      } else {
        try { new Notification(title, { body, icon: '/icons/icon-192x192.png', tag }); } catch (_) {}
      }
    } catch (err) {
      console.warn('Native notification trigger warning:', err);
    }
  }, []);

  // ── Global Real-Time Socket Listener for Owner Events ──
  useEffect(() => {
    if (!user) return;

    let socket;
    try {
      socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      const bizId = user.businessId || 'default';
      socket.emit('join-business', bizId);

      // 1. New Order Placed
      socket.on('new-order', (ord) => {
        playAlertSound();
        const code = ord.pickupCode || (ord.orderId ? ord.orderId.slice(-4).toUpperCase() : 'ORD');
        triggerTopBanner({
          type: 'new_order',
          title: `New Order Received`,
          pickupCode: code,
          total: ord.total,
          message: `₹${ord.total || 0} • ${ord.items?.length || 1} item(s) to prepare`,
          orderId: ord.orderId,
        });
        showNativeNotification('New Order Received', `Order #${code} (₹${ord.total}) received.`, 'new-order', { url: '/orders' });
      });

      // 2. Customer Submitted UTR
      socket.on('payment-submitted', (data) => {
        playAlertSound();
        triggerTopBanner({
          type: 'utr_submitted',
          title: 'Payment Reference Submitted',
          pickupCode: data.pickupCode,
          customerName: data.customerName || 'Customer',
          utr: data.utr,
          total: data.total,
          message: `₹${data.total || 0} • UTR: ${data.utr}`,
          orderId: data.orderId,
        });
        showNativeNotification('Payment Submitted', `Token #${data.pickupCode} (₹${data.total}) submitted UTR.`, 'utr-submitted', { url: '/orders' });
      });

      // 3. Payment Verified
      socket.on('payment-verified', (data) => {
        const isVerified = data.action === 'verify';
        const title = isVerified ? 'Payment Verified' : 'Payment Marked Incorrect';
        const msg = isVerified ? `Order #${data.pickupCode} accepted and sent to kitchen.` : `Order #${data.pickupCode} customer asked to re-enter UTR.`;
        triggerTopBanner({
          type: 'payment_verified',
          title,
          pickupCode: data.pickupCode,
          total: data.total,
          message: msg,
          orderId: data.orderId,
        });
        showNativeNotification(title, msg, 'payment-verified', { url: '/orders' });
      });

      // 4. Remote Notification Sound & Custom Ringtone Changed by Any Device
      socket.on('notification-sound-updated', (data) => {
        console.log('🔄 Notification sound updated remotely across devices:', data.soundType);
        if (data.soundType) {
          setSoundType(data.soundType);
          localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, data.soundType);
        }
        if (data.customNotificationData) {
          setCustomAudioData(data.customNotificationData);
          setCustomAudioName(data.customNotificationName || 'Custom Ringtone');
          setIsCloudSynced(true);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA, data.customNotificationData);
          localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME, data.customNotificationName || 'Custom Ringtone');
          toast.info(`🔔 Ringtone updated across all devices: "${data.customNotificationName || 'Custom Ringtone'}"`);
        } else {
          setCustomAudioData(null);
          setCustomAudioName('');
          setIsCloudSynced(false);
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
          localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
          if (data.soundType) {
            toast.info(`🔔 Ringtone switched to ${data.soundType.replace('_', ' ')} across devices`);
          }
        }
      });
    } catch (err) {
      console.warn('Notification socket connection error:', err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, playAlertSound, triggerTopBanner, showNativeNotification]);

  return (
    <NotificationSoundContext.Provider value={{
      soundType,
      updateSoundType,
      customAudioData,
      customAudioName,
      isCloudSynced,
      isSyncing,
      uploadCustomSound,
      retrySyncCustomSound,
      removeCustomSound,
      volume,
      updateVolume,
      playAlertSound,
      permission,
      isSubscribing,
      isSubscribed,
      requestPermissionAndSubscribe,
      resetAndSubscribe,
      showNativeNotification,
      activeBanner,
      dismissBanner,
    }}>
      {children}
    </NotificationSoundContext.Provider>
  );
}

export function useNotificationSound() {
  const ctx = useContext(NotificationSoundContext);
  if (!ctx) throw new Error('useNotificationSound must be used within NotificationSoundProvider');
  return ctx;
}
