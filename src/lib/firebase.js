import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyCwPmUAvQmrlo6qtkDD54TaLfTze_jHc2I",
    authDomain: "dboywebsite.firebaseapp.com",
    projectId: "dboywebsite",
    storageBucket: "dboywebsite.firebasestorage.app",
    messagingSenderId: "865131472051",
    appId: "1:865131472051:web:bc15c42c88e929c8f77cc6",
    measurementId: "G-ZP7FWBHK0T"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Connect to Local Firebase Emulators for backend logic only
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log("🔥 Connected to Firebase Functions Emulator (Using LIVE Firestore Data)");
}
