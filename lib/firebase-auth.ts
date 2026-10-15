import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

declare global {
  interface Window {
    google?: any;
  }
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/tasks'
];

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let authSuccessCallback: ((user: User, token: string) => void) | null = null;
let authFailureCallback: (() => void) | null = null;

const STORAGE_TOKEN_KEY = 'topicalgap_gis_token';
const STORAGE_USER_KEY = 'topicalgap_gis_user';

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (onAuthSuccess) authSuccessCallback = onAuthSuccess;
  if (onAuthFailure) authFailureCallback = onAuthFailure;

  // 1. Try to restore cached Google Identity Services session from localStorage
  if (typeof window !== 'undefined') {
    try {
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
      if (storedToken && storedUser) {
        cachedAccessToken = storedToken;
        cachedUser = JSON.parse(storedUser);
        if (cachedUser && authSuccessCallback) {
          authSuccessCallback(cachedUser, storedToken);
        }
      }
    } catch (e) {
      console.warn('Failed to restore cached auth:', e);
    }
  }

  // 2. Also listen for Firebase Auth state changes as secondary observer
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      cachedUser = user;
      if (authSuccessCallback) authSuccessCallback(user, cachedAccessToken);
    } else if (!user && !cachedAccessToken) {
      if (authFailureCallback) authFailureCallback();
    }
  });
};

/**
 * Ensures Google Identity Services (GIS) client script is fully loaded and ready
 */
async function ensureGisReady(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 35; // 3.5 seconds

    const checkInterval = setInterval(() => {
      attempts++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkInterval);
        resolve();
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // Fallback: create script element if somehow missing
        const existing = document.getElementById('google-gis-script');
        if (!existing) {
          const script = document.createElement('script');
          script.id = 'google-gis-script';
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            if (window.google?.accounts?.oauth2) resolve();
            else reject(new Error('Google Identity Services library failed to load.'));
          };
          script.onerror = () => reject(new Error('Failed to load Google GIS script from Google servers.'));
          document.head.appendChild(script);
        } else {
          // If script tag exists but oauth2 is still unavailable
          resolve(); // Resolve anyway so caller can inspect window.google
        }
      }
    }, 100);
  });
}

/**
 * Sign in directly via Google Identity Services (GIS) Token Flow.
 * Completely eliminates Firebase Auth's auth/unauthorized-domain restriction,
 * enabling seamless Drive & Sheets access from any Cloud Run, preview, or custom domain.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  isSigningIn = true;

  try {
    await ensureGisReady();

    if (!window.google?.accounts?.oauth2) {
      throw new Error(
        'مكتبة تسجيل الدخول المباشر من جوجل (Google Identity Services) غير جاهزة حالياً. يرجى التحقق من اتصال الإنترنت أو السماح بالنوافذ المنبثقة.'
      );
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      throw new Error('OAuth Client ID is not configured in firebase-applet-config.json');
    }

    return await new Promise<{ user: User; accessToken: string } | null>((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES.join(' '),
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'access_denied') {
                resolve(null);
                return;
              }
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }

            const token = tokenResponse.access_token;
            if (!token) {
              reject(new Error('لم يتم استلام رمز وصول صالح من حساب جوجل.'));
              return;
            }

            cachedAccessToken = token;

            // Fetch user profile info with the token
            let userProfile: any = null;
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                userProfile = await res.json();
              }
            } catch (err) {
              console.warn('Could not fetch user profile:', err);
            }

            const userObj: any = {
              uid: userProfile?.sub || `gis_user_${Date.now()}`,
              displayName: userProfile?.name || userProfile?.email?.split('@')[0] || 'Google User',
              email: userProfile?.email || 'user@google.com',
              photoURL: userProfile?.picture || null,
              emailVerified: Boolean(userProfile?.email_verified)
            };

            cachedUser = userObj as User;

            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(STORAGE_TOKEN_KEY, token);
                localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
              } catch {
                // ignore
              }
            }

            if (authSuccessCallback) {
              authSuccessCallback(userObj, token);
            }

            resolve({ user: userObj, accessToken: token });
          },
          error_callback: (error: any) => {
            console.warn('Google GIS error:', error);
            if (error?.type === 'popup_closed' || error?.type === 'user_cancel') {
              resolve(null);
            } else {
              reject(new Error(error?.message || 'تم إغلاق نافذة تسجيل الدخول أو حظرها من المتصفح.'));
            }
          }
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  } catch (gisError: any) {
    console.error('Google Identity Services sign in error:', gisError);
    // Never call signInWithPopup(auth) as fallback because it produces auth/unauthorized-domain on ephemeral domains!
    throw new Error(
      gisError?.message ||
      'تعذر إتمام تسجيل الدخول عبر Google. يرجى التأكد من السماح بالنوافذ المنبثقة (Popups) وإعادة المحاولة.'
    );
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessTokenManually = (token: string | null, customUser?: { name?: string; email?: string }) => {
  cachedAccessToken = token;
  if (token) {
    const userObj: any = {
      uid: `manual_${Date.now()}`,
      displayName: customUser?.name || 'Google Workspace User',
      email: customUser?.email || 'connected@google.com',
      photoURL: null,
      emailVerified: true
    };
    cachedUser = userObj as User;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_TOKEN_KEY, token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
      } catch {
        // ignore
      }
    }
    if (authSuccessCallback) {
      authSuccessCallback(userObj, token);
    }
  } else {
    cachedUser = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
      } catch {
        // ignore
      }
    }
    if (authFailureCallback) {
      authFailureCallback();
    }
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
  cachedUser = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch {
      // ignore
    }
  }
  if (authFailureCallback) authFailureCallback();
};
