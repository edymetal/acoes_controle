import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { requestGoogleAccessToken } from "./lib/googleIdentity";
import {
  clearGoogleSheetsAccessSession,
  loadGoogleSheetsAccessSession,
  saveGoogleSheetsAccessSession,
} from "./lib/googleSheetsAccessSession";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "controle-acoes-81f97.firebaseapp.com",
  projectId: "controle-acoes-81f97",
  storageBucket: "controle-acoes-81f97.firebasestorage.app",
  messagingSenderId: "422180198859",
  appId: "1:422180198859:web:2f35d2fd270de1d2bcfe4e",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const allowedEmail = "edneypugleise@gmail.com";

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const GOOGLE_IDENTITY_SCOPES = ["openid", "email", "profile", SHEETS_READ_SCOPE];
const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim()
  || "422180198859-9sk862qq6t4v53rh763a39qqmf8s3o2m.apps.googleusercontent.com";

let sheetsAccess = loadGoogleSheetsAccessSession();
let sheetsAuthorization: Promise<string> | null = null;

function activeGoogleSheetsAccess() {
  if (!sheetsAccess) return null;
  if (sheetsAccess.expiresAt > Date.now()) return sheetsAccess;
  sheetsAccess = null;
  clearGoogleSheetsAccessSession();
  return null;
}

async function authenticateFirebaseWithGoogleToken(accessToken: string) {
  const credential = GoogleAuthProvider.credential(null, accessToken);
  const result = await signInWithCredential(auth, credential);
  if (result.user.email?.toLowerCase() !== allowedEmail) {
    await signOut(auth);
    throw new Error("Use a conta Google autorizada para atualizar a planilha.");
  }
}

async function requestGoogleSheetsAccessToken() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("O dispositivo está sem conexão. Reconecte-se à internet e tente novamente.");
  }

  const googleToken = await requestGoogleAccessToken(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_IDENTITY_SCOPES);
  await authenticateFirebaseWithGoogleToken(googleToken.accessToken);

  sheetsAccess = {
    token: googleToken.accessToken,
    expiresAt: Date.now() + Math.max(0, googleToken.expiresInSeconds - 300) * 1_000,
  };
  saveGoogleSheetsAccessSession(sheetsAccess);
  return sheetsAccess.token;
}

export async function signInWithGoogle() {
  const activeAccess = activeGoogleSheetsAccess();
  if (activeAccess) {
    await authenticateFirebaseWithGoogleToken(activeAccess.token);
    return activeAccess.token;
  }
  return getGoogleSheetsAccessToken();
}

export function hasGoogleSheetsAccessToken() {
  return Boolean(activeGoogleSheetsAccess());
}

export async function getGoogleSheetsAccessToken() {
  const activeAccess = activeGoogleSheetsAccess();
  if (activeAccess) return activeAccess.token;
  if (!sheetsAuthorization) {
    sheetsAuthorization = requestGoogleSheetsAccessToken()
      .finally(() => {
        sheetsAuthorization = null;
      });
  }
  return sheetsAuthorization;
}

export function clearGoogleSheetsAccessToken() {
  sheetsAccess = null;
  clearGoogleSheetsAccessSession();
}
