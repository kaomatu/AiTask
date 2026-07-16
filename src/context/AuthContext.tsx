import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  onboardingCompleted: boolean;
  setOnboardingCompleted: (val: boolean) => void;
  signOut: () => Promise<void>;
  checkOnboardingStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const checkOnboardingStatus = async (currentUser: User | null = user) => {
    if (currentUser) {
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'settings', 'onboarding_completed');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().value === 'true') {
          setOnboardingCompleted(true);
        } else {
          setOnboardingCompleted(false);
        }
      } catch (e) {
        console.error("Failed to check onboarding settings:", e);
        setOnboardingCompleted(false);
      }
    } else {
      setOnboardingCompleted(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkOnboardingStatus(currentUser);
      } else {
        setOnboardingCompleted(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      onboardingCompleted, 
      setOnboardingCompleted, 
      signOut, 
      checkOnboardingStatus 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
