# Развертывание в Cloud.ru

Сервер рассчитан на Evolution Container Apps, Evolution Object Storage и
публичный GitHub Container Registry. Клиентские файлы хранятся в S3, а SQLite восстанавливается
и непрерывно реплицируется через Litestream `0.5.15`.

## Стоимость

- Object Storage: бесплатно первые 15 ГБ стандартного хранилища в месяц.
- Container Apps: бесплатно первые 50 ГБ-час RAM и 25 vCPU-час в месяц.
- Публичный образ в GitHub Container Registry хранится бесплатно. Cloud.ru
  Artifact Registry для этого развертывания не используется.

Чтобы уложиться в Free Tier Container Apps, используйте минимум `0` и максимум
`1` экземпляр. Адрес приложения при холодных запусках не меняется. Минимум `1`
даст быстрые ответы без холодного старта, но обычно превысит бесплатный лимит.

## 1. Ресурсы Cloud.ru

1. Войдите в Cloud.ru и выберите один Evolution-проект.
2. Создайте приватный бакет Object Storage стандартного класса. Версионирование
   не включайте: Litestream сам хранит снимки 7 дней и удаляет старые.
3. Создайте ключ доступа с правами чтения, записи, списка и удаления объектов
   в этом бакете. Сохраните `key_id` и `key_secret`.
4. Используйте публичный образ
   `ghcr.io/romangrigorev903-stack/w1ld-auth-server:latest`.

Для S3 используются:

```text
S3_ENDPOINT=https://s3.cloud.ru
S3_REGION=ru-central-1
S3_FORCE_PATH_STYLE=true
```

## 2. Перенос текущих данных

Остановите локальный сервер, задайте S3-переменные в текущем PowerShell и
запустите однократный перенос:

```powershell
$env:S3_ENDPOINT='https://s3.cloud.ru'
$env:S3_REGION='ru-central-1'
$env:S3_BUCKET='имя-бакета'
$env:S3_ACCESS_KEY_ID='<tenant_id>:<key_id>'
$env:S3_SECRET_ACCESS_KEY='key_secret'
$env:S3_CLIENTS_PREFIX='clients/'
$env:S3_DATABASE_PREFIX='database/'
$env:S3_FORCE_PATH_STYLE='true'

npm run migrate:clients:s3
powershell -ExecutionPolicy Bypass -File scripts\migrateDatabaseToS3.ps1
```

На Windows можно вместо ручной установки переменных запустить интерактивный
сценарий `scripts\migrateToCloudru.ps1`. Он не сохраняет секрет на диске.

Перенос базы выполняйте только перед первым production-запуском. После этого
источником истины становится база, которую реплицирует production-контейнер.

## 3. Сборка образа через GitHub

Workflow `.github/workflows/cloudru-image.yml` автоматически собирает
`linux/amd64` образ при отправке изменений в `main`. Его также можно запустить
вручную как `Build GHCR image`. Дополнительные GitHub Secrets не нужны.

После первой сборки откройте на GitHub пакет `w1ld-auth-server`, перейдите в
`Package settings` и измените видимость на `Public`. Это нужно сделать один раз,
чтобы Cloud.ru мог скачивать образ без логина. Локальный Docker не нужен.

## 4. Container App

Создайте Container Service из образа
`ghcr.io/romangrigorev903-stack/w1ld-auth-server:latest` с параметрами:

```text
Публичный адрес: включен
Порт: 8080
Минимум экземпляров: 0
Максимум экземпляров: 1
Health probe: HTTP GET /health, port 8080
CPU/RAM: минимальная доступная конфигурация
```

Добавьте все переменные из `cloudru.env.example`. Настоящие значения задаются
только в Cloud.ru, файл `.env` и ключи нельзя помещать в Git.

Сгенерируйте два разных секрета командами:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Первый используйте как `JWT_SECRET`, второй как `JWT_REFRESH_SECRET`. Задайте
новый сильный `ADMIN_PASSWORD`. При восстановлении старой базы сервер обновит
пароль существующего администратора значением из окружения.

После создания возьмите постоянный публичный URL, задайте его в `PUBLIC_URL` и
`CORS_ORIGIN`, затем создайте новую ревизию.

## 5. Проверка

Проверьте адреса:

```text
https://<container-url>/health
https://<container-url>/api/clients-config
https://<container-url>/admin
```

В логах должны появиться `Starting with S3 client storage and Litestream
replication`, `restore completed` (если база была перенесена) и `Хранилище
клиентских файлов: s3`. Затем URL сервера нужно записать в конфигурацию лаунчера
и пересобрать portable EXE.
