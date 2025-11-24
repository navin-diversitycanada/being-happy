import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyB833LIkA3T7HQ3I7xf7R6d1sao3PQrNqA",
  authDomain: "being-happy-pwa.firebaseapp.com",
  projectId: "being-happy-pwa",
  storageBucket: "being-happy-pwa.firebasestorage.app",
  messagingSenderId: "766119682523",
  appId: "1:766119682523:web:16e82d1ac786d19acc47fe",
  measurementId: "G-GGXDRM7Z59"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export functions client so AdminPanel can call the setUserRole callable function
export const functions = getFunctions(app);

// Providers exported for reuse
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();