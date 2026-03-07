import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCwPmUAvQmrlo6qtkDD54TaLfTze_jHc2I",
    authDomain: "dboywebsite.firebaseapp.com",
    projectId: "dboywebsite",
    storageBucket: "dboywebsite.firebasestorage.app",
    messagingSenderId: "865131472051",
    appId: "1:865131472051:web:bc15c42c88e929c8f77cc6",
    measurementId: "G-ZP7FWBHK0T"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
