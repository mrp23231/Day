import { createClient } from "@supabase/supabase-js";
import { serverSupabase } from "@/lib/supabase/server";
import { apiError, limitedJson } from "@/lib/ai-server";
import { NextResponse } from "next/server";
import { boundedFetch, withNetworkDeadline } from "@/lib/network-deadline";

const photoIdPattern = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

export async function DELETE(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return apiError("Запрос не разрешён.", 403);
    const body = await limitedJson(request, 1000);
    if (!body || typeof body !== "object" || !("confirmation" in body) || body.confirmation !== "УДАЛИТЬ"
      || !("accountId" in body) || typeof body.accountId !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.accountId)) {
      return apiError("Подтвердите удаление текущего аккаунта.");
    }
    const client = await serverSupabase();
    if (!client) return apiError("Облачный сервис не подключён.", 503);
    const { data: { user }, error } = await withNetworkDeadline(client.auth.getUser());
    if (error || !user) return apiError("Необходимо войти в аккаунт.", 401);
    if (body.accountId !== user.id) return apiError("Аккаунт изменился. Подтвердите удаление заново.", 409);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) return apiError("Удаление аккаунта не настроено на сервере.", 503);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } });
    try {
      const photos = admin.storage.from("day-photos");
      // Removing a page shifts the remaining files, so always read from offset zero.
      for (let batch = 0; ; batch += 1) {
        const listed = await withNetworkDeadline(photos.list(user.id, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }));
        if (listed.error || !listed.data) return apiError("Не удалось удалить фотографии аккаунта. Попробуйте позже.", 503);
        if (listed.data.length === 0) break;
        if (batch >= 100 || listed.data.some(file => !file.id || !photoIdPattern.test(file.name))) {
          return apiError("Не удалось завершить удаление фотографий. Повторите попытку.", 503);
        }
        const removed = await withNetworkDeadline(photos.remove(listed.data.map(file => `${user.id}/${file.name}`)));
        if (removed.error) return apiError("Не удалось удалить фотографии аккаунта. Попробуйте позже.", 503);
      }
    } catch {
      return apiError("Не удалось удалить фотографии аккаунта. Попробуйте позже.", 503);
    }
    const deleted = await withNetworkDeadline(admin.auth.admin.deleteUser(user.id));
    if (deleted.error) return apiError("Не удалось удалить аккаунт. Попробуйте позже.", 503);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return apiError("Сервис не ответил вовремя. Проверьте аккаунт перед повторной попыткой.", 503);
    }
    return apiError("Не удалось выполнить запрос.", 400);
  }
}
