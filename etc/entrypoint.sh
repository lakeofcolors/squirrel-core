#!/bin/sh
set -e

# применяем миграции
sqlx migrate run

# запускаем приложение
exec ./squirrel-core
