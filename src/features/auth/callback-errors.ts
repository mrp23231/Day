export type AuthCallbackFailure = "1" | "denied" | "provider";

/** Provider descriptions are untrusted; only return app-defined classifications. */
export function authCallbackFailure(params: URLSearchParams): AuthCallbackFailure | null {
  if (params.get("error_code") === "otp_expired") return "1";
  if (params.get("error") === "access_denied") return "denied";
  return params.get("error") || params.get("error_code") ? "provider" : null;
}

export function authCallbackMessage(failure: string | null): string | null {
  switch (failure) {
    case "denied": return "Вход отменён. Попробуйте снова или выберите электронную почту.";
    case "provider": return "Не удалось завершить вход через Google. Попробуйте ещё раз или выберите электронную почту.";
    case "1": return "Не удалось завершить вход. Попробуйте войти снова или запросите новое письмо.";
    default: return null;
  }
}
