type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number | string;
};

type GooglePopupError = {
  type?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleIdentityServices = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: (error: GooglePopupError) => void;
      }) => GoogleTokenClient;
    };
  };
};

type GoogleIdentityWindow = Window & {
  google?: GoogleIdentityServices;
};

export type GoogleAccessToken = {
  accessToken: string;
  expiresInSeconds: number;
};

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
let googleIdentityScript: Promise<GoogleIdentityServices> | null = null;

function authorizationError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

export function describeGoogleIdentityPopupError(type: string | undefined) {
  switch (type) {
    case "popup_failed_to_open":
      return authorizationError(
        "auth/popup-blocked",
        "O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.",
      );
    case "popup_closed":
      return authorizationError(
        "auth/popup-closed-by-user",
        "A autorização do Google foi fechada antes de terminar. Tente novamente.",
      );
    default:
      return new Error("Não foi possível abrir a autorização do Google. Tente novamente.");
  }
}

export function describeGoogleTokenError(error: string, description?: string) {
  switch (error) {
    case "access_denied":
      return new Error("A autorização do Google não foi concedida. Tente novamente e confirme o acesso solicitado.");
    case "invalid_client":
    case "origin_mismatch":
      return authorizationError(
        "auth/unauthorized-domain",
        "Este endereço não está autorizado no cliente OAuth do Google.",
      );
    default:
      return new Error(description || `O Google recusou a autorização (${error}).`);
  }
}

function readGoogleIdentityServices() {
  return (window as GoogleIdentityWindow).google ?? null;
}

function loadGoogleIdentityServices() {
  const loaded = readGoogleIdentityServices();
  if (loaded) return Promise.resolve(loaded);
  if (googleIdentityScript) return googleIdentityScript;

  googleIdentityScript = new Promise<GoogleIdentityServices>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const cleanUpListeners = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const resetFailedScript = () => {
      cleanUpListeners();
      script.remove();
      googleIdentityScript = null;
    };
    const onLoad = () => {
      const services = readGoogleIdentityServices();
      if (services) {
        cleanUpListeners();
        resolve(services);
      } else {
        resetFailedScript();
        reject(new Error("A biblioteca de autorização do Google não ficou disponível."));
      }
    };
    const onError = () => {
      resetFailedScript();
      reject(new Error("Não foi possível carregar a autorização do Google. Verifique a conexão e tente novamente."));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });

  return googleIdentityScript;
}

export async function requestGoogleAccessToken(clientId: string, scopes: string[]): Promise<GoogleAccessToken> {
  const google = await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(" "),
      callback: (response) => {
        if (response.error) {
          reject(describeGoogleTokenError(response.error, response.error_description));
          return;
        }
        if (!response.access_token) {
          reject(new Error("O Google não forneceu o token de acesso solicitado."));
          return;
        }
        const expiresInSeconds = Number(response.expires_in);
        resolve({
          accessToken: response.access_token,
          expiresInSeconds: Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3_600,
        });
      },
      error_callback: (error) => reject(describeGoogleIdentityPopupError(error.type)),
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}
