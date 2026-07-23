import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";

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

export async function getGoogleSheetsAccessToken() {
  if (sheetsAccess && sheetsAccess.expiresAt > Date.now()) return sheetsAccess.token;
  const user = auth.currentUser;
  if (!user) throw new Error("Entre novamente com a conta Google para atualizar a planilha.");

  const result = await reauthenticateWithPopup(user, sheetsProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("O Google não concedeu acesso de leitura à planilha.");

  sheetsAccess = {
    token: credential.accessToken,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return sheetsAccess.token;
}

export function clearGoogleSheetsAccessToken() {
  sheetsAccess = null;
}
