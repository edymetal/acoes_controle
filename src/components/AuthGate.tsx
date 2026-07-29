import { type ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { BarChart3, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { allowedEmail, auth, clearGoogleSheetsAccessToken, signInWithGoogle } from "../firebase";
import { describeGoogleAuthorizationError } from "../lib/googleAuthError";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState = "loading" | "signed-out" | "authorized";

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<AuthState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setState("signed-out");
      return;
    }

    if (user.email?.toLowerCase() === allowedEmail) {
      setState("authorized");
      return;
    }

    clearGoogleSheetsAccessToken();
    await signOut(auth);
    setMessage("Esta conta não tem permissão para acessar o Controle de Ações.");
    setState("signed-out");
  }), []);

  const signIn = async () => {
    setIsSigningIn(true);
    setMessage(null);

    try {
      await signInWithGoogle();
    } catch (reason) {
      setMessage(describeGoogleAuthorizationError(reason));
    } finally {
      setIsSigningIn(false);
    }
  };

  if (state === "authorized") return <>{children}</>;

  if (state === "loading") {
    return <main className="state-screen"><div className="loader-mark"><LoaderCircle size={34} /><span>Verificando acesso...</span></div></main>;
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand auth-card__brand"><span className="brand__mark"><BarChart3 size={23} /></span><span><strong>Controle</strong><small>de Ações</small></span></div>
        <div className="auth-card__icon"><ShieldCheck size={30} /></div>
        <p className="eyebrow">ACESSO À INTERFACE</p>
        <h1 id="auth-title">Entre para acompanhar sua carteira</h1>
        <p>Use a conta Google autorizada para abrir seus indicadores e a estratégia anual.</p>
        {message && <p className="auth-card__message" role="alert">{message}</p>}
        <button className="google-login-button" type="button" onClick={signIn} disabled={isSigningIn}>
          {isSigningIn ? <LoaderCircle className="spin" size={18} /> : <LogIn size={18} />}
          {isSigningIn ? "Abrindo Google..." : "Entrar com Google"}
        </button>
      </section>
    </main>
  );
}
