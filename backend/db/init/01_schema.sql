-- =============================================================================
-- Схема БД v2: WEB-приложение для сбора и анализа замечаний по качеству
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ОРГАНИЗАЦИИ
-- =============================================================================

CREATE TABLE organizations (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50)  NOT NULL, -- customer | general_contractor | subcontractor
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ПОЛЬЗОВАТЕЛИ
-- Роли: admin | client_rep | supervisor | foreman
-- =============================================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL,
    position        VARCHAR(255),
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ОБЪЕКТЫ СТРОИТЕЛЬСТВА
-- =============================================================================

CREATE TABLE construction_objects (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    photo_key       VARCHAR(500),           -- путь к фото в MinIO
    date_start      VARCHAR(20),            -- свободный формат: 2022, 02.2022, 02.04.2022
    date_end        VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ПРИВЯЗКА ОРГАНИЗАЦИЙ К ОБЪЕКТУ
-- Одна запись = одна организация участвует в объекте в определённой роли
-- =============================================================================

CREATE TABLE object_organizations (
    id              SERIAL PRIMARY KEY,
    object_id       INTEGER NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL,   -- customer | general_contractor | subcontractor
    UNIQUE (object_id, organization_id)
);

-- =============================================================================
-- УЧАСТНИКИ ОБЪЕКТА (конкретные пользователи)
-- =============================================================================

CREATE TABLE object_members (
    id          SERIAL PRIMARY KEY,
    object_id   INTEGER NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (object_id, user_id)
);

-- =============================================================================
-- СПРАВОЧНИКИ
-- =============================================================================

CREATE TABLE work_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE defect_causes (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- НОРМАТИВНЫЕ И ПРОЕКТНЫЕ ДОКУМЕНТЫ
-- =============================================================================

CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    short_name  VARCHAR(100),               -- напр. "СП 426"
    doc_type    VARCHAR(20) NOT NULL,       -- normative | project
    object_id   INTEGER REFERENCES construction_objects(id) ON DELETE CASCADE,
    file_key    VARCHAR(500),               -- путь к PDF в MinIO (если загружен)
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ЛОКАЦИИ (иерархия внутри объекта)
-- =============================================================================

CREATE TABLE locations (
    id          SERIAL PRIMARY KEY,
    object_id   INTEGER NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    level       VARCHAR(50) NOT NULL,       -- building | section | floor | room
    name        VARCHAR(255) NOT NULL
);

-- =============================================================================
-- ЗАМЕЧАНИЯ
-- issue_type: type1 (supervisor→foreman) | type2 (client_rep→supervisor→foreman)
--
-- Статусы:
--   issued               — выдано (начальный)
--   in_progress          — в работе (у прораба)
--   on_review_supervisor — на проверке у технадзора
--   on_review_client     — на проверке у заказчика (только тип 2)
--   rework               — на доработку
--   closed               — закрыто
-- =============================================================================

CREATE TABLE issues (
    id                      SERIAL PRIMARY KEY,
    number                  VARCHAR(50) NOT NULL UNIQUE,
    object_id               INTEGER NOT NULL REFERENCES construction_objects(id),
    location_id             INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    work_type_id            INTEGER REFERENCES work_types(id) ON DELETE SET NULL,
    work_type_custom        VARCHAR(255),       -- свободный ввод если нет в справочнике

    issue_type              VARCHAR(10) NOT NULL DEFAULT 'type1', -- type1 | type2

    -- Участники
    author_id               INTEGER NOT NULL REFERENCES users(id),
    supervisor_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- технадзор (для тип2)
    assignee_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- прораб
    subcontractor_org_id    INTEGER REFERENCES organizations(id) ON DELETE SET NULL,

    -- Описание
    axes                    VARCHAR(255),       -- оси и отметка
    location_x  NUMERIC(5,2),   -- координата X на схеме фасада (% от ширины)
    location_y  NUMERIC(5,2),   -- координата Y на схеме фасада (% от высоты)
    description             TEXT NOT NULL,
    requirements            TEXT,
    document_id             INTEGER REFERENCES documents(id) ON DELETE SET NULL,

    -- Статус и сроки
    status                  VARCHAR(50) NOT NULL DEFAULT 'issued',
    planned_finish_at       DATE,
    is_overdue              BOOLEAN NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ИСТОРИЯ СТАТУСОВ
-- visible_to_client = FALSE скрывает запись от client_rep (внутренний контур)
-- =============================================================================

CREATE TABLE issue_status_history (
    id                  SERIAL PRIMARY KEY,
    issue_id            INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    old_status          VARCHAR(50),
    new_status          VARCHAR(50) NOT NULL,
    changed_by          INTEGER NOT NULL REFERENCES users(id),
    comment             TEXT,
    visible_to_client   BOOLEAN NOT NULL DEFAULT TRUE,
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ВЛОЖЕНИЯ
-- =============================================================================

CREATE TABLE attachments (
    id                  SERIAL PRIMARY KEY,
    issue_id            INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by         INTEGER NOT NULL REFERENCES users(id),
    status_at_upload    VARCHAR(50),
    file_name           VARCHAR(255) NOT NULL,
    file_size           INTEGER NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    storage_path        VARCHAR(500) NOT NULL,
    visible_to_client   BOOLEAN NOT NULL DEFAULT TRUE,  -- фото всегда видны заказчику
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ИНДЕКСЫ
-- =============================================================================

CREATE INDEX idx_issues_object       ON issues(object_id);
CREATE INDEX idx_issues_status       ON issues(status);
CREATE INDEX idx_issues_assignee     ON issues(assignee_id);
CREATE INDEX idx_issues_supervisor   ON issues(supervisor_id);
CREATE INDEX idx_issues_type         ON issues(issue_type);
CREATE INDEX idx_issues_overdue      ON issues(is_overdue) WHERE is_overdue = TRUE;
CREATE INDEX idx_history_issue       ON issue_status_history(issue_id);
CREATE INDEX idx_attachments_issue   ON attachments(issue_id);
CREATE INDEX idx_locations_parent    ON locations(parent_id);
CREATE INDEX idx_obj_members_user    ON object_members(user_id);
CREATE INDEX idx_obj_members_object  ON object_members(object_id);
CREATE INDEX idx_obj_orgs_object     ON object_organizations(object_id);

-- =============================================================================
-- ТЕСТОВЫЕ ДАННЫЕ
-- =============================================================================

-- Организации
INSERT INTO organizations (name, type) VALUES
    ('ООО "ИнвестСтрой"',         'customer'),
    ('АО "СтройГрупп"',           'general_contractor'),
    ('ООО "ФасадМонтаж"',         'subcontractor'),
    ('ООО "СтройФасад Плюс"',     'subcontractor');

-- Пользователи (пароль для всех: password123)
INSERT INTO users (full_name, email, password_hash, role, position, organization_id) VALUES
    ('Администратор Системы',       'admin@example.com',
     '$2b$12$gZOncxlvJCkD8d.Avas4zeB/gykHLlj8zVEU4kdVWdfxToaejJio2',
     'admin', 'Администратор', NULL),

    ('Козлов Дмитрий Александрович','client@example.com',
     '$2b$12$gZOncxlvJCkD8d.Avas4zeB/gykHLlj8zVEU4kdVWdfxToaejJio2',
     'client_rep', 'Представитель заказчика', 1),

    ('Петров Сергей Иванович',      'supervisor@example.com',
     '$2b$12$gZOncxlvJCkD8d.Avas4zeB/gykHLlj8zVEU4kdVWdfxToaejJio2',
     'supervisor', 'Технадзор', 2),

    ('Смирнов Алексей Павлович',    'foreman1@example.com',
     '$2b$12$gZOncxlvJCkD8d.Avas4zeB/gykHLlj8zVEU4kdVWdfxToaejJio2',
     'foreman', 'Прораб', 3),

    ('Иванов Михаил Сергеевич',     'foreman2@example.com',
     '$2b$12$gZOncxlvJCkD8d.Avas4zeB/gykHLlj8zVEU4kdVWdfxToaejJio2',
     'foreman', 'Прораб', 4);

-- Объект строительства
INSERT INTO construction_objects (name, description, date_start, date_end, is_active) VALUES
    ('ЖК "Северный парк", корпус 3',
     'Жилой комплекс, фасадные работы 3-го корпуса',
     '04.2025', '12.2026', TRUE);

-- Привязка организаций к объекту
INSERT INTO object_organizations (object_id, organization_id, role) VALUES
    (1, 1, 'customer'),
    (1, 2, 'general_contractor'),
    (1, 3, 'subcontractor'),
    (1, 4, 'subcontractor');

-- Участники объекта
INSERT INTO object_members (object_id, user_id, added_by) VALUES
    (1, 1, 1),  -- admin
    (1, 2, 1),  -- client_rep
    (1, 3, 1),  -- supervisor
    (1, 4, 1),  -- foreman1
    (1, 5, 1);  -- foreman2

-- Виды работ
INSERT INTO work_types (name) VALUES
    ('Устройство вентилируемого фасада'),
    ('Монтаж фасадных кассет'),
    ('Устройство теплоизоляции фасада'),
    ('Монтаж оконных блоков'),
    ('Герметизация швов и примыканий'),
    ('Устройство отливов и водосточной системы'),
    ('Штукатурные фасадные работы'),
    ('Окраска фасада');

-- Нормативные документы
INSERT INTO documents (name, short_name, doc_type, object_id) VALUES
    ('СП 426.1325800.2020 Фасады навесные вентилируемые', 'СП 426', 'normative', NULL),
    ('СП 522.1325800.2023 Фасады навесные вентилируемые. Правила эксплуатации', 'СП 522', 'normative', NULL),
    ('ГОСТ Р 58154-2018 Фасады навесные вентилируемые', 'ГОСТ Р 58154', 'normative', NULL),
    ('Рабочая документация. Раздел АР. Фасады', 'РД АР', 'project', 1),
    ('Технологическая карта монтажа НВФ', 'ТК НВФ', 'project', 1);

-- Локации
INSERT INTO locations (object_id, parent_id, level, name) VALUES (1, NULL, 'building', 'Корпус 3');
INSERT INTO locations (object_id, parent_id, level, name) VALUES
    (1, 1, 'section', 'Фасад северный'),
    (1, 1, 'section', 'Фасад южный'),
    (1, 1, 'section', 'Фасад восточный'),
    (1, 1, 'section', 'Фасад западный');
INSERT INTO locations (object_id, parent_id, level, name) VALUES
    (1, 2, 'floor', 'Этаж 1'),
    (1, 2, 'floor', 'Этаж 2'),
    (1, 2, 'floor', 'Этаж 3'),
    (1, 2, 'floor', 'Этаж 4'),
    (1, 2, 'floor', 'Этаж 5');

-- Тестовые замечания
INSERT INTO issues (number, object_id, location_id, work_type_id,
                    issue_type, author_id, supervisor_id, assignee_id, subcontractor_org_id,
                    axes, description, requirements, document_id,
                    status, planned_finish_at) VALUES

    ('ФАС-0001', 1, 6, 1,
     'type1', 3, NULL, 4, 3,
     'Ось А/1-3, отм. +3.000',
     'Зазор между кронштейном подсистемы и несущей стеной превышает допустимое значение.',
     'Выполнить замену кронштейнов на типоразмер согласно проекту.',
     1, 'closed', '2025-05-15'),

    ('ФАС-0002', 1, 7, 2,
     'type1', 3, NULL, 4, 3,
     'Ось Б/2-5, отм. +6.000',
     'Фасадные кассеты на этаже 2 установлены с нарушением горизонтального шва — отклонение до 8 мм.',
     'Произвести перемонтаж кассет в соответствии с допусками.',
     1, 'on_review_supervisor', '2025-05-20'),

    ('ФАС-0003', 1, 6, 3,
     'type1', 3, NULL, 4, 3,
     'Ось В/1-4, отм. +0.000',
     'Теплоизоляционные плиты уложены без смещения швов.',
     'Переложить теплоизоляцию с соблюдением перевязки швов.',
     2, 'in_progress', '2025-05-18'),

    ('ФАС-0004', 1, 8, 4,
     'type1', 3, NULL, 5, 4,
     'Ось Г/3-6, отм. +9.000',
     'Монтажная пена в узлах примыкания оконных блоков нанесена неравномерно.',
     'Вскрыть и переработать узлы примыкания.',
     2, 'issued', '2025-06-01'),

    ('ФАС-0005', 1, 7, 2,
     'type2', 2, 3, 4, 3,
     'Ось А/1-6, отм. +6.000',
     'Фасадные кассеты на северном фасаде имеют видимые повреждения — вмятины и царапины.',
     'Заменить повреждённые кассеты.',
     1, 'on_review_client', '2025-06-10'),

    ('ФАС-0006', 1, 9, 5,
     'type2', 2, 3, 5, 4,
     'Ось Б/2-4, отм. +12.000',
     'Герметик в вертикальных швах нанесён с пропусками.',
     'Выполнить герметизацию по всей длине.',
     1, 'in_progress', '2025-06-15');

-- История статусов
INSERT INTO issue_status_history
    (issue_id, old_status, new_status, changed_by, comment, visible_to_client) VALUES

    (1, NULL,                  'issued',               3, 'Замечание выдано прорабу', TRUE),
    (1, 'issued',              'in_progress',          4, 'Принято в работу', TRUE),
    (1, 'in_progress',         'on_review_supervisor', 4, 'Кронштейны заменены', FALSE),
    (1, 'on_review_supervisor','closed',               3, 'Устранение подтверждено', TRUE),

    (2, NULL,                  'issued',               3, 'Замечание выдано', TRUE),
    (2, 'issued',              'in_progress',          4, 'Принято в работу', TRUE),
    (2, 'in_progress',         'on_review_supervisor', 4, 'Кассеты перемонтированы', FALSE),

    (3, NULL,                  'issued',               3, NULL, TRUE),
    (3, 'issued',              'in_progress',          4, 'Приступили к разборке', TRUE),

    (4, NULL,                  'issued',               3, NULL, TRUE),

    (5, NULL,                  'issued',               2, 'Замечание от заказчика', TRUE),
    (5, 'issued',              'in_progress',          4, NULL, FALSE),
    (5, 'in_progress',         'on_review_supervisor', 4, 'Кассеты заменены', FALSE),
    (5, 'on_review_supervisor','on_review_client',     3, 'Передаю заказчику на закрытие', TRUE),

    (6, NULL,                  'issued',               2, 'Замечание от заказчика', TRUE),
    (6, 'issued',              'in_progress',          5, NULL, FALSE),

    (6, 'in_progress',         'rework',               3, 'Герметик нанесён некачественно', FALSE);