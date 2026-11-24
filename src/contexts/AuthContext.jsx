import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { auth, db, col, ADMIN_EMAIL, BRANCH_NAME } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null) // { name, role, active }
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u)
      if (!u) {
        setProfile(null)
        setProfileLoading(false)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    setProfileLoading(true)
    const ref = doc(db, col('users'), firebaseUser.uid)
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        setProfile(snap.data())
      } else if (firebaseUser.email === ADMIN_EMAIL || firebaseUser.email === 'admin@lottee.internal') {
        const fallbackProfile = {
          name: BRANCH_NAME || 'GoShip Rạch Giá',
          role: 'admin',
          active: true,
          email: firebaseUser.email,
        }
        setProfile(fallbackProfile)
        try {
          await setDoc(ref, fallbackProfile)
        } catch (e) {
          // ignore if rules don't permit client write yet
        }
      } else {
        setProfile(null)
      }
      setProfileLoading(false)
    }, (err) => {
      if (firebaseUser.email === ADMIN_EMAIL || firebaseUser.email === 'admin@lottee.internal') {
        setProfile({
          name: BRANCH_NAME || 'GoShip Rạch Giá',
          role: 'admin',
          active: true,
          email: firebaseUser.email,
        })
      } else {
        setProfile(null)
      }
      setProfileLoading(false)
    })
    return unsub
  }, [firebaseUser])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => fbSignOut(auth)

  const loading = firebaseUser === undefined || (firebaseUser && profileLoading)

  const value = {
    user: firebaseUser || null,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || firebaseUser?.email === ADMIN_EMAIL || firebaseUser?.email === 'admin@lottee.internal',
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
