import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from './config'

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function signOut() {
  return fbSignOut(auth)
}

export function onAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}
