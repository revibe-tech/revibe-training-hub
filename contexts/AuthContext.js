'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const AuthContext = createContext({});

const ADMIN_EMAIL = 'youssf.rehem@revibe.me';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result on page load for users who fall back to redirect auth
    getRedirectResult(auth).catch((error) => {
      console.error("Error handling redirect result:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Determine role from email first (always works, no network needed)
        let currentRole = 'trainee';
        if (firebaseUser.email && firebaseUser.email.toLowerCase() === ADMIN_EMAIL) {
          currentRole = 'trainer';
        }

        // Try to sync with Firestore, but don't block if it fails
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            if (firebaseUser.email?.toLowerCase() === ADMIN_EMAIL && userDoc.data().role !== 'trainer') {
              await setDoc(userRef, { role: 'trainer', lastLogin: new Date().toISOString() }, { merge: true });
            } else {
              currentRole = userDoc.data().role || currentRole;
              await setDoc(userRef, { lastLogin: new Date().toISOString() }, { merge: true });
            }
          } else {
            await setDoc(userRef, {
              uid: firebaseUser.uid, // required by the users create rule
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: currentRole,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString()
            });
          }
        } catch (error) {
          console.warn('Firestore sync failed, using email-based role:', error.message);
          // Role is already set from email check above, so the app still works
        }

        setUser(firebaseUser);
        setRole(currentRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Presence heartbeat: while a tab is open and visible, stamp lastActive on
  // the user's doc every 45s. The Users page treats anyone whose lastActive is
  // within the last ~2 minutes as "Online now". Only writes a non-role field,
  // so it's allowed by the owner update rule.
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      setDoc(ref, { lastActive: new Date().toISOString() }, { merge: true }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 45000);
    const onVisible = () => beat();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [user]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      // Automatic fallback to Redirect if Popup is blocked by the user's browser / adblocker
      if (error.code === 'auth/popup-blocked' || error.message?.includes('popup')) {
        console.warn("Popup blocked, falling back to signInWithRedirect...");
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error("Error signing in with Google Redirect", redirectErr);
          throw redirectErr;
        }
      }
      console.error("Error signing in with Google", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, isTrainer: role === 'trainer', signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
