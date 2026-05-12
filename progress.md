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