import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

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
const sheetsProvider = new GoogleAuthProvider();
sheetsProvider.addScope(SHEETS_READ_SCOPE);
sheetsProvider.setCustomParameters({ prompt: "select_account" });

let sheetsAccess: { token: string; expiresAt: number } | null = null;
let sheetsAuthorization: Promise<string> | null = null;

async function requestGoogleSheetsAccessToken() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("O dispositivo está sem conexão. Reconecte-se à internet e tente novamente.");
  }

  const result = await signInWithPopup(auth, sheetsProvider);
  if (result.user.email?.toLowerCase() !== allowedEmail) {
    throw new Error("Use a conta Google autorizada para atualizar a planilha.");
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("O Google não concedeu acesso de leitura à planilha.");

  sheetsAccess = {
    token: credential.accessToken,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return sheetsAccess.token;
}

export async function signInWithGoogle() {
  await getGoogleSheetsAccessToken();
}

export async function getGoogleSheetsAccessToken() {
  if (sheetsAccess && sheetsAccess.expiresAt > Date.now()) return sheetsAccess.token;
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
}
