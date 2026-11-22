export type CloudStatus="local"|"pending"|"saving"|"saved"|"offline"|"error"|"conflict";
export function isCloudConflict(error:unknown){
  const message=error instanceof Error?error.message:typeof error==="object"&&error!==null&&"message" in error?String(error.message):"";
  return /revision conflict/i.test(message);
}
export const cloudStatusMessages:Record<CloudStatus,string>={
  local:"Записи сохраняются на этом устройстве",
  pending:"Изменения ожидают синхронизации",
  saving:"Синхронизируем с аккаунтом…",
  saved:"Все изменения сохранены в аккаунте",
  offline:"Нет сети. Изменения отправятся после подключения",
  error:"Не удалось синхронизировать. Локальная копия сохранена",
  conflict:"Локальная и облачная копии различаются. Экспортируйте локальную копию перед восстановлением облачной",
};
