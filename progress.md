## Инфраструктура (docker-compose) — ГОТОВО
- docker-compose.yml: три сервиса — db (PostgreSQL 16), minio, api (FastAPI)
- Сервис api стартует только после healthcheck db и minio (depends_on)
- .env / .env.example — все настройки вынесены в переменные окружения, .env в .gitignore
- backend/Dockerfile — образ на Python 3.12-slim, hot-reload через --reload
- backend/requirements.txt — зафиксированы версии: fastapi, sqlalchemy, asyncpg, alembic, pydantic-settings, python-jose, passlib, bcrypt==4.0.1, boto3
- backend/main.py — точка входа, GET /health, lifespan с проверкой БД
- backend/db/init/ — папка для SQL-скриптов инициализации БД

## Схема БД — ГОТОВО
- Файл: backend/db/init/01_schema.sql
- Таблицы: work_types, defect_causes, construction_objects, locations, contractors, users, issues, issue_status_history, attachments
- Локации: самоссылающаяся таблица (parent_id), уровни: building | section | floor | room
- Статусы замечания: created | issued | in_progress | on_review | rework | rejected | closed
- Роли пользователей: inspector | foreman | pto_engineer | client_rep | project_manager | admin
- Триггер update_updated_at на таблице issues
- Тестовые данные: объект "ЖК Северный парк корп.3", 3 подрядчика, 6 пользователей, 7 замечаний по фасадной тематике со ссылками на СП 426 и СП 522
- Тестовый пароль для всех пользователей: password123
- Рабочий хэш: $2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu

## Проверка запуска — ГОТОВО
- docker-compose up --build выполнен успешно
- PostgreSQL: 9 таблиц, 7 тестовых замечаний (ФАС-0001..ФАС-0007)
- FastAPI: GET /health → {"status":"ok"}, /docs доступен
- MinIO: консоль доступна на localhost:9001

## Подключение к БД — ГОТОВО
- backend/core/config.py — настройки из .env через pydantic-settings
- backend/core/database.py — async SQLAlchemy engine, get_db() dependency
- backend/main.py — lifespan: проверка подключения к БД при старте
- При старте сервера в логах: "Database connection: OK"

## Модуль аутентификации — ГОТОВО
- backend/core/security.py — хэширование паролей (bcrypt), JWT (создание и декодирование)
- backend/models/user.py — SQLAlchemy ORM модель таблицы users
- backend/schemas/user.py — Pydantic схемы: LoginRequest, TokenResponse, UserResponse
- backend/routers/auth.py — POST /auth/login, GET /users/me, зависимость get_current_user
- POST /auth/login → 200, JWT токен — ПРОВЕРЕНО
- GET /users/me → 200, данные пользователя — ПРОВЕРЕНО

## Следующий шаг
- [ ] Модуль справочников: виды работ, причины дефектов, подрядчики, объекты

## Модуль справочников — ГОТОВО
- backend/models/: WorkType, DefectCause, Contractor, ConstructionObject
- backend/schemas/catalogs.py — Pydantic-схемы (Create/Update/Response для каждой сущности)
- backend/routers/catalogs.py — 16 эндпоинтов (GET/POST/PATCH/DELETE для 4 справочников)
- backend/core/dependencies.py — зависимость require_admin
- Права: чтение — все авторизованные, запись — только admin
- GET поддерживает ?active_only=false для показа деактивированных записей
- DELETE — мягкое удаление (is_active = False), данные не теряются
- auth.py переведён на OAuth2PasswordRequestForm — кнопка Authorize в Swagger работает корректно

## Модуль замечаний — ГОТОВО
- backend/models/issue.py — ORM-модели Issue, IssueStatusHistory
- backend/models/location.py — ORM-модель Location (нужна для FK)
- backend/schemas/issue.py — схемы Create/Update/Response/StatusTransition
- backend/routers/issues.py — 6 эндпоинтов: список, карточка, создание, редактирование, смена статуса, история
- Машина состояний: словарь TRANSITIONS, проверка на сервере
- Прораб видит только замечания своего подрядчика
- Редактирование заблокировано после выхода из статуса created (кроме admin)
- При rework комментарий обязателен
- Нумерация замечаний: ФАС-XXXX автоматически по объекту

## Модуль вложений — ГОТОВО
- backend/models/attachment.py — ORM-модель Attachment
- backend/schemas/attachment.py — схемы AttachmentResponse, AttachmentDownloadResponse
- backend/core/storage.py — клиент MinIO (boto3): upload, presigned URL, delete, ensure_bucket
- backend/routers/attachments.py — 4 эндпоинта: загрузка, список, скачивание (presigned URL), удаление
- Разрешённые типы: JPEG, PNG, WebP, HEIC, PDF, MP4, MOV
- Максимальный размер файла: 50 МБ
- Путь в MinIO: issues/{issue_id}/{uuid}.{ext}
- Удалить может только автор загрузки или admin

## Модуль аналитики — ГОТОВО
- backend/schemas/analytics.py — схемы для всех 6 эндпоинтов
- backend/routers/analytics.py — GET /analytics/summary, by-status, by-work-type, by-contractor, overdue, timeline
- Доступ закрыт для роли foreman
- summary: подсчёт по статусам одним запросом (CASE WHEN), среднее время закрытия
- by-work-type и by-contractor: LEFT JOIN, агрегаты
- overdue: фильтр по planned_finish_at < today и статус не closed/rejected
- timeline: группировка по ISO-неделям (to_char + IYYY-IW), параметр weeks (1-52)

## Фронтенд — базовая структура (ГОТОВО)
- Создано React + Vite приложение в папке frontend/
- Установлены: react-router-dom, axios, recharts
- Настроен axios-клиент с JWT-интерцептором и авто-редиректом на /login при 401
- ВАЖНО: токен сохраняется в localStorage ДО вызова getMe() — иначе 401
- Реализован AuthContext: хранение токена, getMe при загрузке, signIn/signOut
- Созданы api-модули: client, auth, issues, attachments, analytics, catalogs
- Страница /login: форма входа, обработка ошибок, CSS-модуль — РАБОТАЕТ
- App.jsx: роутинг, PrivateRoute с проверкой ролей
- Константы: STATUS_LABELS/COLORS, PRIORITY_LABELS/COLORS, ROLE_LABELS
- Добавлен CORS middleware в backend/main.py (allow_origins: localhost:5173)
- Заглушки для IssuesPage, IssueDetailPage, AnalyticsPage, AdminPage
- Рабочий браузер для разработки: Chrome (Edge блокирует DevTools)

## Фронтенд — страницы Issues и IssueDetail (ГОТОВО)
- Layout.jsx + Layout.module.css — боковая навигация с учётом ролей, кнопка выхода
- IssuesPage.jsx + IssuesPage.module.css — таблица замечаний, фильтры по статусу/приоритету/подрядчику, цветные бейджи, клик по строке → карточка
- IssueDetailPage.jsx + IssueDetailPage.module.css — детали замечания, смена статуса с комментарием, загрузка/скачивание/удаление вложений, история статусов с таймлайном
- Исправлены пути API (не совпадали с бэкендом):
  - /catalogs/contractors → /contractors
  - /catalogs/work-types → /work-types
  - /catalogs/defect-causes → /defect-causes
  - /catalogs/construction-objects → /construction-objects
  - /attachments/{id} → /issues/{id}/attachments (список и загрузка)

  ## Фронтенд — страница Analytics (ГОТОВО)
- AnalyticsPage.jsx + AnalyticsPage.module.css
- KPI карточки: всего замечаний, открытых, закрытых, просроченных, среднее время закрытия, процент закрытия
- PieChart — распределение по статусам с цветами из STATUS_COLORS
- BarChart (горизонтальный) — по видам работ: всего vs закрыто
- BarChart (горизонтальный) — по подрядчикам: всего vs просрочено
- LineChart — динамика открытых/закрытых по ISO-неделям (8 недель)
- Все эндпоинты аналитики требуют обязательный параметр object_id
- object_id берётся динамически через getObjects()[0].id из /construction-objects
- Исправлен api/analytics.js — все функции принимают objectId первым аргументом

## Фронтенд — страница Admin (ГОТОВО)
- AdminPage.jsx + AdminPage.module.css
- Три вкладки: виды работ, подрядчики, причины дефектов
- Создание новых записей, деактивация/активация существующих
- Доступна только роли admin (защита через PrivateRoute)
- Все 4 страницы фронтенда реализованы и работают

## Фронтенд — страница CreateIssue (ГОТОВО)
- CreateIssuePage.jsx + CreateIssuePage.module.css
- Поля: объект, локация, вид работ, подрядчик, приоритет, срок, описание, требования, нормативное основание, причина дефекта
- Добавлен эндпоинт GET /locations на бэкенде (routers/catalogs.py + schemas/catalogs.py → LocationResponse)
- Создание замечания работает, редирект на карточку после создания
- Весь фронтенд готов к демонстрации

## Docker для фронтенда (ГОТОВО)
- frontend/Dockerfile — двухэтапная сборка: node:20-alpine (сборка) + nginx:alpine (раздача)
- frontend/nginx.conf — раздача статики + прокси /api/ → http://api:8000/
- frontend/.env.production — VITE_API_URL=/api (для Docker-сборки)
- frontend/.env — VITE_API_URL=http://localhost:8000 (для npm run dev)
- docker-compose.yml — добавлен сервис frontend, порт 80
- Приложение запускается одной командой: docker-compose up -d
- Продакшн-URL: http://localhost (порт 80)
- Dev-URL: http://localhost:5173 (npm run dev)