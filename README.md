# Squirrel Game Monorepo

Добро пожаловать в монорепозиторий игры **Squirrel**! Здесь находятся все компоненты приложения: игровой движок (бэкенд), пользовательский интерфейс (фронтенд) и панель администратора.

## 📂 Структура репозитория

* [squirrel-engine/](file:///Users/vladimirkochetkov/projects/squirrel-core/squirrel-engine) — Игровой движок (бэкенд) на **Rust (Axum + Tokio + SQLx + Redis)**. Отвечает за логику игры, Websockets, API и авторизацию.
* [squirrel-front/](file:///Users/vladimirkochetkov/projects/squirrel-core/squirrel-front) — Пользовательский интерфейс (фронтенд) на **React (Tailwind CSS + Zustand)**.
* [squirrel-admin/](file:///Users/vladimirkochetkov/projects/squirrel-core/squirrel-admin) — Панель администратора на **Django (Python)** для управления пользователями и игровым процессом.
* [k8s/](file:///Users/vladimirkochetkov/projects/squirrel-core/k8s) — Манифесты Kubernetes (развертывание в k3s) и конфигурация `infra-repo` (Helmfile).

---

## 🛠️ Системные требования и установка зависимостей

Для локального запуска проекта тебе понадобятся:
* **Rust** (1.80+)
* **Node.js** (18+) & **npm**
* **Python** (3.11+)
* **PostgreSQL** (15+)
* **Redis** (7+)

### 🍎 Установка на macOS (через Homebrew)
```bash
# Установка БД и инструментов
brew install postgresql@15 redis node python

# Запуск служб
brew services start postgresql@15
brew services start redis
```

### 🐧 Установка на Ubuntu
```bash
# Обновление пакетов
sudo apt update && sudo apt install -y curl build-essential pkg-config libssl-dev postgresql postgresql-contrib redis-server python3 python3-pip python3-venv

# Установка Node.js (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Запуск служб
sudo systemctl start postgresql
sudo systemctl start redis-server
```

---

## 🚀 Локальный запуск компонентов

### 1. Подготовка баз данных
Создай базу данных `squirrel` в PostgreSQL:
```bash
# В терминале Postgres:
psql -U postgres -c "CREATE DATABASE squirrel;"
```

### 2. Запуск Игрового Движка (Бэкенд)
1. Установи Rust (если еще не установлен):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```
2. Перейди в каталог бэкенда:
   ```bash
   cd squirrel-engine
   ```
3. Создай файл конфигурации `.env` (возьми за основу шаблон):
   ```bash
   # Пример .env:
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/squirrel
   REDIS_URL=redis://127.0.0.1:6379
   SECRET_KEY=some-super-random-secret-key-64-chars-long
   BOT_TOKEN=your_telegram_bot_token
   ```
4. Установи `sqlx-cli` и примени миграции БД:
   ```bash
   cargo install sqlx-cli --no-default-features --features postgres
   sqlx migrate run
   ```
5. Запусти бэкенд:
   ```bash
   cargo run --release
   ```
   *Движок запустится на порту `9221`.*

### 3. Запуск Панели Администратора (Django)
1. Перейди в каталог админки:
   ```bash
   cd ../squirrel-admin
   ```
2. Создай виртуальное окружение и активируй его:
   ```bash
   python3 -m venv venv
   # macOS/Ubuntu:
   source venv/bin/activate
   ```
3. Установи зависимости:
   ```bash
   pip install -r requirements.txt
   ```
4. Запусти сервер разработки:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```
   *Админка доступна по адресу [http://localhost:8000](http://localhost:8000).*

### 4. Запуск Пользовательского Интерфейса (Фронтенд)
1. Перейди в каталог фронтенда:
   ```bash
   cd ../squirrel-front
   ```
2. Установи npm-зависимости:
   ```bash
   npm install
   ```
3. Запусти локальный сервер разработки React:
   ```bash
   npm start
   ```
   *Фронтенд откроется в браузере на [http://localhost:3000](http://localhost:3000).*
