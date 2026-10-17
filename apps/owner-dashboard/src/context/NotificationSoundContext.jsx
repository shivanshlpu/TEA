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
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
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

  // ── Custom Sound Upload Handler ──
  const uploadCustomSound = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected'));
      if (!file.type.startsWith('audio/')) {
        return reject(new Error('Please upload a valid audio file (.mp3, .wav, .ogg, .m4a)'));
      }
      if (file.size > 5 * 1024 * 1024) {
        return reject(new Error('Audio file must be under 5MB'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        try {
          // Test if audio is decodable
          const testAudio = new Audio(base64);
          testAudio.volume = volume;
          testAudio.play().then(() => {
            setCustomAudioData(base64);
            setCustomAudioName(file.name);
            setSoundType('custom');
            localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA, base64);
            localStorage.setItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME, file.name);
            localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, 'custom');
            resolve({ name: file.name, size: file.size });
          }).catch(reject);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const removeCustomSound = () => {
    setCustomAudioData(null);
    setCustomAudioName('');
    setSoundType('chime');
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_DATA);
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_AUDIO_NAME);
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, 'chime');
  };

  const updateSoundType = (type) => {
    setSoundType(type);
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPE, type);
    // Play preview of chosen sound
    playAlertSound(type);
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

      // If no valid subscription exists, create fresh
      const newSub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

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
      if (isManualClick) toast.error('Could not activate push notifications: ' + (err.message || 'Unknown error'));
      return false;
    } finally {
      setIsSubscribing(false);
    }
  };

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
        triggerTopBanner({
          type: 'new_order',
          title: 'New Order Received! ☕',
          pickupCode: ord.pickupCode || (ord.orderId ? ord.orderId.slice(-4).toUpperCase() : 'ORD'),
          total: ord.total,
          message: `Order #${ord.pickupCode || 'ORD'} for ₹${ord.total} received. Prepare fresh!`,
          orderId: ord.orderId,
        });
      });

      // 2. Customer Submitted UTR
      socket.on('payment-submitted', (data) => {
        playAlertSound();
        triggerTopBanner({
          type: 'utr_submitted',
          title: 'UTR Payment Submitted! 💰',
          pickupCode: data.pickupCode,
          customerName: data.customerName || 'Customer',
          utr: data.utr,
          total: data.total,
          message: `${data.customerName || 'Customer'} submitted UTR #${data.utr} for ₹${data.total}`,
          orderId: data.orderId,
        });
      });

      // 3. Payment Verified
      socket.on('payment-verified', (data) => {
        playAlertSound();
        triggerTopBanner({
          type: 'payment_verified',
          title: data.action === 'verify' ? 'Payment Verified! ✅' : 'Payment Rejected ❌',
          pickupCode: data.pickupCode,
          total: data.total,
          message: `Order #${data.pickupCode} payment ${data.action === 'verify' ? 'verified successfully' : 'marked as rejected'}.`,
          orderId: data.orderId,
        });
      });
    } catch (err) {
      console.warn('Notification socket connection error:', err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, playAlertSound, triggerTopBanner]);

  return (
    <NotificationSoundContext.Provider value={{
      soundType,
      updateSoundType,
      customAudioData,
      customAudioName,
      uploadCustomSound,
      removeCustomSound,
      volume,
      updateVolume,
      playAlertSound,
      permission,
      isSubscribing,
      isSubscribed,
      requestPermissionAndSubscribe,
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
