# 🚀 Настройка W1ld Auth Server на Render

## 1. Зайди в панель Render

1. Открой https://dashboard.render.com
2. Найди свой сервис `w1ldloaderserver`
3. Нажми на него
4. Зайди в **Environment** → **Environment Variables**

## 2. Добавь эти переменные окружения

Скопируй **все** строки ниже и добавь их в Render (по одной):

### 🔑 JWT (главные секреты)
```
JWT_SECRET=56d507af9194184916b0426bea3ff4a4651748c499cd0443b10943cb0e3c964d
JWT_REFRESH_SECRET=d1ee1e18c6d2e255b0b21c7eb83db41f43965a4a62b5a174fa13e0c8159cf929
```

### ⏱ JWT Сроки (можно не менять)
```
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 🔒 Администратор
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=8d5adb63
```
> **ВАЖНО:** Сразу после входа в админку смени пароль через интерфейс!

### 🌍 Режим production
```
NODE_ENV=production
```

### 📡 CORS (можно оставить *)
```
CORS_ORIGIN=*
```

### 🚦 Rate Limits (можно не менять)
```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 📁 Пути на сервере (можно не менять)
```
PUBLIC_URL=https://w1ldloaderserver.onrender.com
LAUNCHER_DIST_DIR=./storage/launcher
LAUNCHER_VERSION_FILE=./launcher-version.json
TUNNEL_URL_FILE=./tunnel-url.txt
```

## 3. Сохрани и перезапусти

1. Нажми **"Save"** или **"Add Environment Variable"**
2. Дождись, пока Render автоматически перезапустит сервер (или нажми **"Deploy"** → **"Deploy latest commit"**)
3. Проверь в **Logs**, что сервер запустился без ошибок

## 4. Проверь, что работает

Открой в браузере:
```
https://w1ldloaderserver.onrender.com/health
```

Должен вернуть: `{"status":"ok","timestamp":"..."}`

## 5. Вход в админку

- URL: https://w1ldloaderserver.onrender.com/admin
- Логин: `admin`
- Пароль: `8d5adb63`

**Сразу смени пароль!** В админке → Пользователи → Изменить → Новый пароль.

---

⚠️ **Никому не показывай эти ключи!** Если кто-то узнает `JWT_SECRET`, он сможет подделать токен администратора.