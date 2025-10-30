import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";



const firebaseConfig = {
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

export const googleProvider = new GoogleAuthProvider();
// Apple provider
export const appleProvider = new OAuthProvider('apple.com');