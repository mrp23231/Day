# Google-вход в Day

Инструкция для владельца проекта. Проверено по официальной документации Google и Supabase 19 ноября 2026 года. 20 ноября владелец сообщил о собственных доработках входа; перечисленная ниже конфигурация — последний проверенный снимок, а не повторная проверка его изменений.

## Проверенное состояние на 19 ноября 2026 года

В Supabase-проекте `czoybiitgacfpwfuxfak` с явного разрешения применена миграция `day_initial_schema`: созданы 11 таблиц с включённым RLS. Email-вход был включён, подтверждение email включено. На момент этой проверки Google-провайдер был выключен.

На тот момент в Supabase → Authentication → URL Configuration были заданы:

| Поле | Значение |
| --- | --- |
| Site URL | `http://localhost:3000` |
| Redirect URL для входа | `http://localhost:3000/auth/callback` |
| Redirect URL для восстановления пароля | `http://localhost:3000/auth/callback?recovery=1` |

Это локальная конфигурация. Реальную доставку писем и успешный вход нужно проверить отдельно.

## 1. Подготовьте экран согласия Google

1. Откройте [Google Cloud Console](https://console.cloud.google.com/), выберите принадлежащий вам проект или создайте проект для Day.
2. Перейдите в **Google Auth Platform → Branding**. Если настройка ещё не начата, нажмите **Get Started**.
3. Укажите название приложения **Day**, действующий email поддержки и контактный email владельца. Используйте реальные контакты. Завершите первоначальную настройку.
4. В **Audience** выберите **External** для пользователей вне вашей организации. Для закрытой проверки оставьте режим **Testing**. В **Test users → Add users** добавьте Google-аккаунты, с которыми будете проверять вход, и сохраните.
5. В **Data Access** оставьте только необходимые для входа разрешения: `openid`, `https://www.googleapis.com/auth/userinfo.email` и `https://www.googleapis.com/auth/userinfo.profile`. Доступ к Gmail, Drive или Calendar для входа в Day не требуется.

Разделы Branding, Audience, Data Access и добавление тестовых пользователей описаны в [инструкции Google](https://developers.google.com/workspace/guides/configure-oauth-consent). Необходимые для Supabase разрешения перечислены в [документации Google-входа Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## 2. Создайте OAuth-клиент

В **Google Auth Platform → Clients** нажмите создание клиента и выберите тип **Web application**. Назовите клиент, например, **Day Web — local**.

В поле разрешённых JavaScript origins добавьте origin приложения:

```text
http://localhost:3000
```

В поле разрешённых redirect URIs вставьте **точно этот адрес**:

```text
https://czoybiitgacfpwfuxfak.supabase.co/auth/v1/callback
```

Создайте клиент. Сохраните выданные **Client ID** и **Client Secret** для следующего шага. Google перенаправляет пользователя сначала в Supabase, поэтому здесь используется callback Supabase. Адрес `http://localhost:3000/auth/callback` относится к следующему переходу — из Supabase обратно в Day. Создание веб-клиента описано в [официальной инструкции Google](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).

## 3. Включите Google в Supabase

Откройте [проект Day в Supabase](https://supabase.com/dashboard/project/czoybiitgacfpwfuxfak), затем **Authentication → Sign In / Providers → Google**.

1. Вставьте **Client ID** созданного веб-клиента.
2. Вставьте его **Client Secret** в поле секрета провайдера.
3. Включите Google-провайдер и нажмите **Save**.
4. Проверьте, что включение сохранилось, а callback в панели совпадает с адресом из шага 2.

Google Client Secret вводится **только в настройках Google-провайдера Supabase**. Не добавляйте его в `.env`, исходники Day, документы, скриншоты или сообщения. Для этого OAuth-процесса браузеру приложения секрет не нужен. [Настройка провайдера Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## 4. Проверьте вход

Откройте Day на `http://localhost:3000`, перейдите в профиль, выберите создание аккаунта или вход через Google. Используйте тестовый Google-аккаунт из Audience. После согласия должен открыться Day с авторизованным профилем; для нового аккаунта — знакомство.

Проверьте выход и повторный вход, отмену на стороне Google, email-регистрацию с подтверждением и восстановление пароля. Для проверки изоляции данных используйте два собственных тестовых аккаунта. Успех конфигурации не заменяет эти проверки.

Если Google сообщает `redirect_uri_mismatch`, сравните redirect URI веб-клиента с callback Supabase из шага 2, включая протокол, домен и путь. Если Supabase сообщает, что провайдер выключен, проверьте включение и сохранение Google в нужном проекте. Разрешённые возвраты в приложение настраиваются отдельно в [URL Configuration Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

## Перед публичным релизом

Определите production-домен и включите HTTPS. Замените Site URL в Supabase на реальный адрес Day и добавьте два точных production redirect URL: `/auth/callback` и `/auth/callback?recovery=1` на этом домене. В Google добавьте production origin без пути; callback Supabase останется прежним, пока используется тот же Supabase-проект.

Заполните Branding действительными ссылками на приложение и его политику конфиденциальности. Подготовьте публикацию приложения Google из режима Testing через Audience; выполните требования проверки бренда/разрешений, которые покажет Google для выбранной конфигурации. Не считайте добавление тестовых пользователей публичным запуском. Удалите ненужные тестовые origins/redirects из production-конфигурации и повторите проверку входа уже на размещённом Day.

Полный порядок проверок: [подготовка релиза Day](release.md).
