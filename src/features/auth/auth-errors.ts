import { isAuthError } from "@supabase/supabase-js";

const errorMessages: Record<string, string> = {
  invalid_credentials: "Неверная почта или пароль. Проверьте данные или восстановите пароль.",
  email_not_confirmed: "Подтвердите почту по ссылке в письме, затем войдите снова.",
  over_request_rate_limit: "Слишком много попыток. Подождите несколько минут и попробуйте снова.",
  over_email_send_rate_limit: "Слишком много попыток. Подождите несколько минут и попробуйте снова.",
  weak_password: "Выберите более надёжный пароль: используйте буквы, цифры и символы.",
  email_address_not_authorized: "Не удалось отправить письмо на этот адрес. Выберите вход через Google или попробуйте позже.",
  signup_disabled: "Регистрация сейчас недоступна. Если у вас уже есть аккаунт, войдите в него.",
  provider_disabled: "Вход через Google сейчас недоступен. Выберите электронную почту или попробуйте позже.",
  oauth_provider_not_supported: "Вход через Google сейчас недоступен. Выберите электронную почту или попробуйте позже.",
};

/** Use stable SDK codes and app-owned copy; never display provider internals. */
export function authErrorMessage(error: unknown, fallback: string): string {
  return isAuthError(error) && error.code && Object.hasOwn(errorMessages, error.code)
    ? errorMessages[error.code]
    : fallback;
}
