import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDTMAbzmbHIKTUu23HTKWRO1Ysa1DoBw2E",
  authDomain: "controle-acoes-81f97.firebaseapp.com",
  projectId: "controle-acoes-81f97",
  storageBucket: "controle-acoes-81f97.firebasestorage.app",
  messagingSenderId: "422180198859",
  appId: "1:422180198859:web:2f35d2fd270de1d2bcfe4e",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const allowedEmail = "edneypugleise@gmail.com";
