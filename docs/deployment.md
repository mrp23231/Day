# Подробная инструкция: деплой Daymind на www.day.publicvm.com

Эта инструкция рассчитана на VPS/сервер с Docker. Результат — HTTPS-сайт с синхронизацией данных между устройствами через Supabase.

---

## 0. Что понадобится
- Сервер (VPS) с Ubuntu/Debian, минимум 1 vCPU / 1 GB RAM.
- Домен `www.day.publicvm.com`, управление DNS (A-запись).
- Аккаунт Supabase (бесплатный тариф подходит).
- (Опционально) OpenAI API key для Day AI.

---

## 1. Подготовка сервера

Подключитесь по SSH и установите Docker:

```sh
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Выйдите и зайдите снова по SSH, чтобы группа docker применилась. Проверьте:

```sh
docker --version
docker compose version
```

Откройте порты в файрволе:

```sh
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. DNS

В панели управления доменом создайте A-запись:

- Имя: `www` (или `www.day.publicvm.com` целиком, зависит от панели)
- Тип: `A`
- Значение: IP вашего сервера
- TTL: 300 (или минимальный)

Проверьте распространение:

```sh
dig +short www.day.publicvm.com
```

Должен вернуть IP сервера. Подождите 5–30 минут.

---

## 3. Клонирование проекта

```sh
cd /opt
sudo git clone https://github.com/<ваш-репозиторий>/Daymind.git daymind
sudo chown -R $USER:$USER /opt/daymind
cd /opt/daymind
```

Если репозиторий приватный — используйте SSH-ключ или personal access token.

---

## 4. Настройка Supabase

### 4.1 Создание проекта
1. Зайдите на https://supabase.com → New project.
2. Запомните: Project URL и anon public key (Settings → API).
3. Service role key (там же) — только для сервера, не светите в клиенте.

### 4.2 Применение миграций
Установите Supabase CLI (если нет):

```sh
npm install -g supabase
```

Войдите и свяжите проект:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` — это часть URL проекта (например, `abcd1234` из `https://abcd1234.supabase.co`).

### 4.3 Auth URL Configuration
В Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://www.day.publicvm.com`
- Redirect URLs (добавьте обе):
  - `https://www.day.publicvm.com/auth/callback`
  - `https://www.day.publicvm.com/auth/callback?recovery=1`

Включите Email/Password auth. При желании включите Google-провайдер (см. README).

---

## 5. Переменные окружения

Скопируйте шаблон и заполните:

```sh
cp .env.example .env.local
nano .env.local
```

Содержимое:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon public key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service role key)
OPENAI_API_KEY=sk-... (опционально)
OPENAI_MODEL=gpt-4.1-mini
```

Важно: `NEXT_PUBLIC_*` встраиваются в клиент при сборке. Если измените их — нужна пересборка.

---

## 6. Запуск

```sh
cd /opt/daymind
docker compose up -d --build
```

Первая сборка займёт 3–5 минут. Проверьте статус:

```sh
docker compose ps
docker compose logs -f app
```

Caddy автоматически получит HTTPS-сертификат для `www.day.publicvm.com` (нужен открытый 80/443 и корректный DNS).

Откройте в браузере: https://www.day.publicvm.com

---

## 7. Синхронизация между устройствами

1. На каждом устройстве откройте сайт.
2. Создайте аккаунт (email/password или Google) — один и тот же на всех устройствах.
3. В профиле используйте кнопку облачного сохранения/восстановления.
4. Данные (задачи, питание, вода, привычки, настройки) синхронизируются через Supabase.

Примечания:
- Локальные данные гостя не переносятся в аккаунт автоматически.
- Фотографии оформления хранятся только локально в IndexedDB каждого браузера — на другом устройстве их нужно выбрать заново.
- Облачные копии сохраняются явно кнопкой, а не автоматически.

---

## 8. Обновление приложения

```sh
cd /opt/daymind
git pull
docker compose up -d --build
```

Старый контейнер будет заменён новым без простоя (Caddy продолжит отдавать старый, пока новый не поднимется).

---

## 9. Резервное копирование

- База данных: Supabase Dashboard → Database → Backups (автоматические на платных тарифах; на бесплатном — ручной дамп через `pg_dump`).
- Локальные данные пользователей: экспорт JSON из профиля приложения.

---

## 10. Устранение проблем

**Сайт не открывается / сертификат не выдаётся:**
- Проверьте DNS: `dig +short www.day.publicvm.com`.
- Проверьте порты: `sudo ufw status`.
- Логи Caddy: `docker compose logs caddy`.

**Ошибка входа / redirect:**
- Убедитесь, что redirect URL в Supabase точно совпадает (с `https://` и без лишнего слэша).
- Проверьте, что `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` корректны и пересобраны.

**Day AI не работает:**
- Проверьте `OPENAI_API_KEY` в `.env.local` и перезапустите контейнер.
- Убедитесь, что пользователь авторизован (AI требует auth).

**Контейнер падает:**
```sh
docker compose logs app --tail 100
```

---

## 11. Альтернатива: Vercel (без Docker)

Если не хотите управлять сервером:
1. Импортируйте репозиторий в Vercel.
2. Добавьте env-переменные в настройках проекта.
3. Привяжите домен `www.day.publicvm.com` в Vercel → Domains.
4. В Supabase укажите redirect URL с доменом Vercel.

Vercel сам обеспечит HTTPS и масштабирование. Синхронизация через Supabase работает так же.
