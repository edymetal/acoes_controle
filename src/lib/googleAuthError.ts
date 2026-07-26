type FirebaseErrorLike = {
  code?: unknown;
  message?: unknown;
};

function firebaseErrorCode(reason: unknown) {
  if (!reason || typeof reason !== "object") return null;
  const code = (reason as FirebaseErrorLike).code;
  return typeof code === "string" ? code : null;
}

export function describeGoogleAuthorizationError(reason: unknown) {
  switch (firebaseErrorCode(reason)) {
    case "auth/network-request-failed":
      return "Falha de conexão com o Google. Verifique a internet e tente novamente.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.";
    case "auth/popup-closed-by-user":
      return "A autorização do Google foi fechada antes de terminar. Tente novamente.";
    case "auth/cancelled-popup-request":
      return "Já existe uma autorização do Google em andamento. Aguarde e tente novamente.";
    case "auth/unauthorized-domain":
      return "Este endereço não está autorizado no Firebase. Revise os domínios permitidos do projeto.";
    default:
      return reason instanceof Error && !reason.message.startsWith("Firebase:")
        ? reason.message
        : "Não foi possível concluir a autorização do Google. Tente novamente.";
  }
}
