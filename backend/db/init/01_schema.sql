-- =============================================================================
-- Схема БД: WEB-приложение для сбора и анализа замечаний по качеству
-- Файл выполняется автоматически при первом запуске контейнера PostgreSQL
-- =============================================================================

-- Расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- СПРАВОЧНИКИ
-- =============================================================================

-- Виды работ
CREATE TABLE work_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Причины дефектов
CREATE TABLE defect_causes (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);


-- =============================================================================
-- ОБЪЕКТЫ СТРОИТЕЛЬСТВА
-- =============================================================================

CREATE TABLE construction_objects (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    started_at  DATE,
    finished_at DATE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- ЛОКАЦИИ (иерархия: корпус → секция → этаж → помещение)
-- Самоссылающаяся таблица: parent_id указывает на родительский узел
-- =============================================================================

CREATE TABLE locations (
    id          SERIAL PRIMARY KEY,
    object_id   INTEGER NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    level       VARCHAR(50) NOT NULL, -- 'building' | 'section' | 'floor' | 'room'
    name        VARCHAR(255) NOT NULL
);


-- =============================================================================
-- ПОДРЯДЧИКИ
-- =============================================================================

CREATE TABLE contractors (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    inn         VARCHAR(12),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);


-- =============================================================================
-- ПОЛЬЗОВАТЕЛИ
-- =============================================================================

-- Роли: inspector | foreman | pto_engineer | client_rep | project_manager | admin
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    contractor_id   INTEGER REFERENCES contractors(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- ЗАМЕЧАНИЯ (центральная таблица)
-- =============================================================================

-- Статусы: created | issued | in_progress | on_review | rework | rejected | closed
CREATE TABLE issues (
    id                  SERIAL PRIMARY KEY,
    number              VARCHAR(50) NOT NULL UNIQUE, -- человекочитаемый номер, напр. "ФАС-0001"
    object_id           INTEGER NOT NULL REFERENCES construction_objects(id),
    location_id         INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    work_type_id        INTEGER REFERENCES work_types(id) ON DELETE SET NULL,
    contractor_id       INTEGER REFERENCES contractors(id) ON DELETE SET NULL,

    author_id           INTEGER NOT NULL REFERENCES users(id),
    assignee_id         INTEGER REFERENCES users(id) ON DELETE SET NULL, -- ответственный исполнитель

    status              VARCHAR(50) NOT NULL DEFAULT 'created',
    priority            VARCHAR(20) NOT NULL DEFAULT 'normal', -- low | normal | high | critical
    description         TEXT NOT NULL,                         -- описание несоответствия
    requirements        TEXT,                                  -- требования к устранению
    normative_reference VARCHAR(500),                          -- ссылка на СП/ГОСТ/проект
    defect_cause_id     INTEGER REFERENCES defect_causes(id) ON DELETE SET NULL,

    planned_finish_at   DATE,                                  -- плановая дата устранения
    is_overdue          BOOLEAN NOT NULL DEFAULT FALSE,        -- флаг просрочки

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Автоматически обновляем updated_at при любом изменении строки
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
-- Каждая смена статуса — отдельная строка. Удалять нельзя, только читать.
-- =============================================================================

CREATE TABLE issue_status_history (
    id          SERIAL PRIMARY KEY,
    issue_id    INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    old_status  VARCHAR(50),
    new_status  VARCHAR(50) NOT NULL,
    changed_by  INTEGER NOT NULL REFERENCES users(id),
    comment     TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- ВЛОЖЕНИЯ
-- Файлы хранятся в MinIO, здесь только метаданные и путь к файлу
-- =============================================================================

CREATE TABLE attachments (
    id              SERIAL PRIMARY KEY,
    issue_id        INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by     INTEGER NOT NULL REFERENCES users(id),
    -- На каком этапе прикреплён файл (например, 'on_review' = фото устранения)
    status_at_upload VARCHAR(50),
    file_name       VARCHAR(255) NOT NULL,  -- оригинальное имя файла
    file_size       INTEGER NOT NULL,        -- размер в байтах
    mime_type       VARCHAR(100) NOT NULL,
    storage_path    VARCHAR(500) NOT NULL,   -- путь к объекту в MinIO
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- ИНДЕКСЫ для часто используемых фильтров
-- =============================================================================

CREATE INDEX idx_issues_object    ON issues(object_id);
CREATE INDEX idx_issues_status    ON issues(status);
CREATE INDEX idx_issues_assignee  ON issues(assignee_id);
CREATE INDEX idx_issues_contractor ON issues(contractor_id);
CREATE INDEX idx_issues_work_type ON issues(work_type_id);
CREATE INDEX idx_issues_overdue   ON issues(is_overdue) WHERE is_overdue = TRUE;
CREATE INDEX idx_history_issue    ON issue_status_history(issue_id);
CREATE INDEX idx_attachments_issue ON attachments(issue_id);
CREATE INDEX idx_locations_parent  ON locations(parent_id);


-- =============================================================================
-- ТЕСТОВЫЕ ДАННЫЕ (фасадная тематика)
-- =============================================================================

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

-- Причины дефектов
INSERT INTO defect_causes (name) VALUES
    ('Нарушение технологии производства работ'),
    ('Несоответствие применяемых материалов проекту'),
    ('Ошибка в проектной документации'),
    ('Недостаточная квалификация исполнителей'),
    ('Нарушение условий хранения материалов'),
    ('Отсутствие операционного контроля'),
    ('Использование неактуальной версии проекта');

-- Объект строительства
INSERT INTO construction_objects (name, description, started_at, is_active) VALUES
    ('ЖК "Северный парк", корпус 3', 'Жилой комплекс, фасадные работы 3-го корпуса', '2025-04-01', TRUE);

-- Локации (иерархия для корпуса 3)
-- Уровень 1: корпус
INSERT INTO locations (object_id, parent_id, level, name) VALUES (1, NULL, 'building', 'Корпус 3');

-- Уровень 2: фасады (вместо секций — стороны света)
INSERT INTO locations (object_id, parent_id, level, name) VALUES
    (1, 1, 'section', 'Фасад северный'),
    (1, 1, 'section', 'Фасад южный'),
    (1, 1, 'section', 'Фасад восточный'),
    (1, 1, 'section', 'Фасад западный');

-- Уровень 3: этажи (на северном фасаде для примера)
INSERT INTO locations (object_id, parent_id, level, name) VALUES
    (1, 2, 'floor', 'Этаж 1'),
    (1, 2, 'floor', 'Этаж 2'),
    (1, 2, 'floor', 'Этаж 3'),
    (1, 2, 'floor', 'Этаж 4'),
    (1, 2, 'floor', 'Этаж 5');

-- Подрядчики
INSERT INTO contractors (name, inn) VALUES
    ('ООО "ФасадСтрой"', '7701234567'),
    ('ИП Миронов А.С.', '770198765432'),
    ('ООО "СтройФасад Плюс"', '7703456789');

-- Пользователи (пароль для всех тестовых: "password123")
-- Хэш сгенерирован через bcrypt
INSERT INTO users (full_name, email, password_hash, role, contractor_id) VALUES
    ('Петров Сергей Иванович',   'inspector@example.com',  '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'inspector',        NULL),
    ('Смирнов Алексей Павлович', 'foreman@example.com',    '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'foreman',          1),
    ('Иванова Марина Олеговна',  'pto@example.com',        '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'pto_engineer',     NULL),
    ('Козлов Дмитрий Александрович', 'client@example.com', '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'client_rep',       NULL),
    ('Новиков Андрей Викторович','manager@example.com',    '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'project_manager',  NULL),
    ('Администратор Системы',    'admin@example.com',      '$2b$12$HnfLNyYl51Q8dqM0qVpeE.nmtI7l9Djq7eFfBUBAoLeYmI2d7F6Hu', 'admin',            NULL);

-- Тестовые замечания по фасадным работам
INSERT INTO issues (number, object_id, location_id, work_type_id, contractor_id, author_id, assignee_id,
                    status, priority, description, requirements, normative_reference,
                    defect_cause_id, planned_finish_at) VALUES

    ('ФАС-0001', 1, 6, 1, 1, 1, 2,
     'closed', 'normal',
     'Зазор между кронштейном подсистемы и несущей стеной превышает допустимое значение на участке оси А/1-3, этаж 1.',
     'Выполнить замену кронштейнов на типоразмер согласно проекту. Предоставить фотофиксацию после устранения.',
     'СП 426.1325800.2020 п. 6.3.2',
     1, '2025-05-15'),

    ('ФАС-0002', 1, 7, 2, 1, 1, 2,
     'on_review', 'high',
     'Фасадные кассеты на этаже 2 (северный фасад) установлены с нарушением горизонтального шва — отклонение до 8 мм.',
     'Произвести перемонтаж кассет в соответствии с допусками. Выполнить нивелировку.',
     'СП 426.1325800.2020 п. 7.1.4',
     1, '2025-05-20'),

    ('ФАС-0003', 1, 6, 3, 1, 1, 2,
     'in_progress', 'critical',
     'Теплоизоляционные плиты на этаже 1 уложены без смещения швов. Стыки вертикальных и горизонтальных рядов совпадают на протяжении 4 м.',
     'Полностью переложить теплоизоляцию на указанном участке с соблюдением перевязки швов.',
     'СП 522.1325800.2023 п. 5.4.1',
     1, '2025-05-18'),

    ('ФАС-0004', 1, 8, 4, 2, 1, 2,
     'issued', 'normal',
     'Монтажная пена в узлах примыкания оконных блоков к проёму нанесена неравномерно. Выявлены незаполненные участки длиной до 15 см.',
     'Вскрыть и переработать узлы примыкания. Нанести пену равномерно по всему периметру. Закрыть пароизоляционной лентой.',
     'СП 522.1325800.2023 п. 6.2.3',
     4, '2025-05-25'),

    ('ФАС-0005', 1, 9, 5, 1, 1, 2,
     'created', 'high',
     'Герметик в вертикальных швах между кассетами на этаже 4 нанесён с пропусками. Длина незагерметизированных участков — суммарно около 3 м.',
     'Очистить швы, нанести грунтовку и выполнить герметизацию по всей длине согласно проекту.',
     'СП 426.1325800.2020 п. 8.2.1',
     1, '2025-05-30'),

    ('ФАС-0006', 1, 7, 6, 3, 1, 2,
     'rework', 'normal',
     'Водосточные воронки на этаже 2 установлены с уклоном от стены, что приведёт к скоплению воды у фасада.',
     'Переустановить воронки с обеспечением уклона в сторону водосточной трубы не менее 2%.',
     'СП 522.1325800.2023 п. 7.3.5',
     1, '2025-05-22'),

    ('ФАС-0007', 1, 10, 1, 1, 1, 2,
     'closed', 'low',
     'На этаже 5 северного фасада отсутствует защитная плёнка на профилях подсистемы. Следы раствора на видимых поверхностях.',
     'Выполнить очистку профилей. При невозможности очистки — замена элементов.',
     'СП 426.1325800.2020 п. 5.1.3',
     6, '2025-05-10');

-- История статусов для тестовых замечаний
INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, comment) VALUES
    -- ФАС-0001: полный цикл до закрытия
    (1, NULL,          'created',     1, 'Замечание зафиксировано в ходе обхода'),
    (1, 'created',     'issued',      1, 'Назначен исполнитель, установлен срок'),
    (1, 'issued',      'in_progress', 2, 'Принято в работу'),
    (1, 'in_progress', 'on_review',   2, 'Кронштейны заменены, фото приложены'),
    (1, 'on_review',   'closed',      1, 'Устранение подтверждено, замечание закрыто'),

    -- ФАС-0002: на проверке
    (2, NULL,          'created',     1, NULL),
    (2, 'created',     'issued',      1, 'Назначен исполнитель'),
    (2, 'issued',      'in_progress', 2, 'Принято в работу'),
    (2, 'in_progress', 'on_review',   2, 'Кассеты перемонтированы'),

    -- ФАС-0003: в работе
    (3, NULL,          'created',     1, NULL),
    (3, 'created',     'issued',      1, 'Критическое замечание, срочно'),
    (3, 'issued',      'in_progress', 2, 'Приступили к разборке'),

    -- ФАС-0004: выдано
    (4, NULL,          'created',     1, NULL),
    (4, 'created',     'issued',      1, 'Назначен ИП Миронов'),

    -- ФАС-0005: только создано
    (5, NULL,          'created',     1, 'Выявлено при плановом обходе'),

    -- ФАС-0006: возврат на доработку
    (6, NULL,          'created',     1, NULL),
    (6, 'created',     'issued',      1, NULL),
    (6, 'issued',      'in_progress', 2, NULL),
    (6, 'in_progress', 'on_review',   2, 'Воронки переставлены'),
    (6, 'on_review',   'rework',      1, 'Уклон недостаточен, требуется переделка'),

    -- ФАС-0007: полный цикл до закрытия
    (7, NULL,          'created',     1, NULL),
    (7, 'created',     'issued',      1, NULL),
    (7, 'issued',      'in_progress', 2, NULL),
    (7, 'in_progress', 'on_review',   2, 'Профили очищены'),
    (7, 'on_review',   'closed',      1, 'Принято');
