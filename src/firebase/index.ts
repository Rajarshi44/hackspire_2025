'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Prefer initializing with an explicit config (works in dev, CI, and build).
    // If that fails, attempt automatic initialization (used when deployed to Firebase Hosting
    // which provides the config at runtime via hosting integration).
    let firebaseApp;
    try {
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      // If explicit config fails, try automatic init (may be necessary on Firebase Hosting).
      try {
        firebaseApp = initializeApp();
      } catch (autoErr) {
        // If both initializations fail, rethrow the explicit config error for visibility.
        console.error('Firebase initialization failed with explicit config and automatic init.', { explicitError: e, autoInitError: autoErr });
        throw e;
      }
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';