/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { AlbumState } from "./types";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "anonymous",
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves a local fallback version of the album state
 */
export function saveLocalAlbum(state: AlbumState) {
  localStorage.setItem("copa_2026_local_album", JSON.stringify(state));
}

/**
 * Loads the local backup or fresh state
 */
export function loadLocalAlbum(): AlbumState {
  const saved = localStorage.getItem("copa_2026_local_album");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        albumCode: parsed.albumCode || null,
        glued: parsed.glued || {},
        repeated: parsed.repeated || {},
        updatedAt: parsed.updatedAt || null,
      };
    } catch (e) {
      console.error("Error parsing local album, resetting", e);
    }
  }
  return {
    albumCode: null,
    glued: {},
    repeated: {},
    updatedAt: null,
  };
}

/**
 * Uploads a secure, synced layout of the album to Firestore document `/albums/{albumCode}`
 */
export async function syncAlbumToCloud(albumCode: string, glued: Record<string, boolean>, repeated: Record<string, number>): Promise<void> {
  const cleanCode = albumCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanCode) return;

  const path = `albums/${cleanCode}`;
  try {
    const albumDocRef = doc(db, "albums", cleanCode);
    await setDoc(albumDocRef, {
      albumCode: cleanCode,
      glued: glued,
      repeated: repeated,
      updatedAt: serverTimestamp() // Generates server time matching rule expectation
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to real-time events of a shared album and executes state update callbacks.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToAlbum(
  albumCode: string, 
  onUpdate: (data: Partial<AlbumState>) => void,
  onError: (err: any) => void
) {
  const cleanCode = albumCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const path = `albums/${cleanCode}`;
  const albumDocRef = doc(db, "albums", cleanCode);

  return onSnapshot(
    albumDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          albumCode: cleanCode,
          glued: data.glued || {},
          repeated: data.repeated || {},
          updatedAt: data.updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        });
      } else {
        // Document does not exist yet; the subscriber is notified so it can initialize it.
        onUpdate({
          albumCode: cleanCode,
          glued: {},
          repeated: {},
          updatedAt: null
        });
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        onError(err);
      }
    }
  );
}
