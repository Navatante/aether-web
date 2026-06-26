-- ============================================================
-- Aether-Web: esquema base (Hito 1)
-- Traducción de aether-sqlServer.sql → PostgreSQL.
-- Excluye: RLS (security policy), SPs, TVFs, schema floan (fuera de alcance).
-- ============================================================

-- ===== EXTENSIONS =====
-- unaccent: búsquedas que ignoran acentos (p. ej. horas extra por persona).
-- Es "trusted" (PG13+), así que no requiere superusuario. Se referencia
-- schema-qualified como public.unaccent(...) en las queries.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- ===== SCHEMAS =====
CREATE SCHEMA IF NOT EXISTS detall;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS flightsafety;

-- ============================================================
-- LOOKUP / REFERENCE TABLES (detall)
-- ============================================================

CREATE TABLE detall.rank (
    rank_sk        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rank_name      VARCHAR(10)  NOT NULL UNIQUE,
    rank_order     SMALLINT     NOT NULL,
    rank_category  VARCHAR(30)  NOT NULL  -- 'Oficiales' | 'Suboficiales' | 'Tropa y marinería'
);

CREATE TABLE detall.localidad (
    localidad_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    localidad_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE detall.especialidad (
    especialidad_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especialidad_name  VARCHAR(70) NOT NULL UNIQUE
);

CREATE TABLE detall.division (
    division_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    division_name  VARCHAR(70) NOT NULL UNIQUE
);

CREATE TABLE detall.person_rol (
    person_rol_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_rol_name  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE detall.escuadrilla (
    escuadrilla_sk             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    escuadrilla_code           VARCHAR(20)  NOT NULL UNIQUE,
    escuadrilla_name           VARCHAR(100) NOT NULL UNIQUE,
    escuadrilla_creation_date  DATE         NOT NULL,
    -- Modelo de aeronave actual de la escuadrilla. Nullable solo por orden de
    -- siembra: la escuadrilla se siembra (0002) antes de que el importador SQLite
    -- cree el catálogo operations.aircraft_model; se rellena justo después
    -- (migrationSQLiteToPostgres.py). Distingue, en los cálculos de horas, las
    -- horas extra del modelo propio (cuentan siempre) de las de otros modelos
    -- (solo en modo "Totales"). El FK se añade vía ALTER TABLE tras crear
    -- operations.aircraft_model (definido más abajo en este script).
    escuadrilla_model_fk       INTEGER
);

CREATE TABLE detall.comision_type (
    comision_type_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              VARCHAR(200) NOT NULL UNIQUE,
    origin            VARCHAR(20)  NOT NULL,
    CONSTRAINT chk_comision_type_origin CHECK (origin IN ('Interna', 'Externa'))
);

CREATE TABLE detall.comision_lugar (
    comision_lugar_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comision_name      VARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE detall.notcrew_rating_type (
    notcrew_rating_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notcrew_rating_name  VARCHAR(100) NOT NULL UNIQUE,
    notcrew_rating_abrv  VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE detall.absence_reason (
    absence_reason_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    absence_reason     VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================================
-- LOOKUP / REFERENCE TABLES (operations)
-- ============================================================

CREATE TABLE operations.event_name (
    event_name_sk     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name_value  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.papeleta_block (
    papeleta_block_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    papeleta_block_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.papeleta_plan (
    papeleta_plan_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    papeleta_plan_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.departure_arrival_place (
    departure_arrival_place_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    departure_arrival_place_code  VARCHAR(20)  NOT NULL UNIQUE,
    departure_arrival_place_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.period (
    period_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period_name  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE operations.ifr_app_type (
    ifr_app_type_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ifr_app_type_name  VARCHAR(50) NOT NULL,
    ifr_app_type_type  VARCHAR(50) NOT NULL,
    CONSTRAINT uq_ifr_app_name_type UNIQUE (ifr_app_type_name, ifr_app_type_type)
);

CREATE TABLE operations.landing_place (
    landing_place_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    landing_place_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.projectile_type (
    projectile_type_sk      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projectile_type_name    VARCHAR(50) NOT NULL,
    projectile_type_weapon  VARCHAR(50) NOT NULL,
    CONSTRAINT uq_projectile_name_weapon UNIQUE (projectile_type_name, projectile_type_weapon)
);

CREATE TABLE operations.authority (
    authority_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    authority_name  VARCHAR(50) NOT NULL UNIQUE,
    authority_abrv  VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE operations.passenger_type (
    passenger_type_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    passenger_type_name  VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE operations.crew_rating_type (
    crew_rating_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    abbreviation    VARCHAR(20)  NOT NULL UNIQUE,
    type            VARCHAR(50)  NOT NULL,
    role            VARCHAR(50)  NOT NULL,
    CONSTRAINT chk_crew_rating_type CHECK (
        type IN ('Modelo', 'Operativa', 'General', 'Táctica', 'Mando y Liderazgo')
    )
);

CREATE TABLE operations.fuel_place (
    fuel_place_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fuel_place_name     VARCHAR(50) NOT NULL UNIQUE,
    fuel_place_type     VARCHAR(50) NOT NULL,
    CONSTRAINT chk_fuel_place_type CHECK (
        fuel_place_type in ('Aeropuerto nacional', 'Aeropuerto internacional', 'Buque nacional', 'Buque internacional', 'Base Naval de Rota')
        )
);

CREATE TABLE operations.fuel_payer (
    fuel_payer_sk                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fuel_payer_assignment_type_abbrev  VARCHAR(15) NOT NULL UNIQUE,
    fuel_payer_assignment_type         VARCHAR(50) NOT NULL UNIQUE,
    fuel_payer_name                    VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE operations.fuel_phase (
    fuel_phase_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fuel_phase     VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE operations.fuel_type (
    fuel_type_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fuel_type     VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE operations.capba_group (
    capba_group_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    capba_group_code  INTEGER      NOT NULL UNIQUE,
    capba_group_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE operations.capba (
    capba_id             INTEGER PRIMARY KEY,
    capba_group_code_fk  INTEGER NOT NULL REFERENCES operations.capba_group(capba_group_code),
    capba_name           VARCHAR(300) NOT NULL UNIQUE
);

-- ============================================================
-- LOOKUP / REFERENCE TABLES (flightsafety)
-- ============================================================

CREATE TABLE flightsafety.medical_exam_result (
    medical_exam_result_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_exam_result     VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE flightsafety.medical_exam_place (
    medical_exam_place_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_exam_place     VARCHAR(20) NOT NULL UNIQUE
);

-- ============================================================
-- MASTER ENTITIES
-- ============================================================

CREATE TABLE detall.person (
    person_sk                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_nk                 VARCHAR(10),
    person_user               VARCHAR(50)  NOT NULL UNIQUE,
    person_rank               VARCHAR(10)  NOT NULL,
    person_cuerpo             VARCHAR(10)  NOT NULL,
    person_especialidad       VARCHAR(70)  NOT NULL,
    person_name               VARCHAR(100) NOT NULL,
    person_last_name_1        VARCHAR(100) NOT NULL,
    person_last_name_2        VARCHAR(100) NOT NULL,
    person_phone              VARCHAR(20)  NOT NULL,
    person_dni                VARCHAR(20)  UNIQUE,
    person_localidad          VARCHAR(100) NOT NULL,
    person_division           VARCHAR(70)  NOT NULL,
    person_rol                VARCHAR(50)  NOT NULL,
    person_a_emp              DATE         NOT NULL,
    person_f_emb              DATE         NOT NULL,
    person_birthdate          DATE         NOT NULL,
    person_num_escalafon      INTEGER      NOT NULL,
    person_current_flag       BOOLEAN      NOT NULL DEFAULT TRUE,
    person_permission_level   VARCHAR(50)  NOT NULL DEFAULT 'Común',
    person_password_hash      VARCHAR(255),
    -- Marca "debe cambiar la contraseña": toda alta de persona y todo reseteo
    -- del Superusuario dejan la contraseña en el valor por defecto ('aether') y
    -- ponen este flag a TRUE; el siguiente login fuerza el cambio (enforzado en
    -- backend vía RequireAuth y espejado en el frontend). El usuario lo limpia
    -- al cambiar su contraseña. DEFAULT false: las filas del seed/bootstrap no
    -- quedan forzadas; solo las nuevas altas ponen TRUE explícito.
    person_password_must_change BOOLEAN    NOT NULL DEFAULT false,
    person_escuadrilla_fk     INTEGER      NOT NULL,
    CONSTRAINT chk_person_permission_level CHECK (
        person_permission_level IN ('Común', 'Operacional', 'Administrativo', 'Seguridad', 'Superusuario')
    ),
    CONSTRAINT fk_person_rank          FOREIGN KEY (person_rank)         REFERENCES detall.rank(rank_name),
    CONSTRAINT fk_person_localidad     FOREIGN KEY (person_localidad)    REFERENCES detall.localidad(localidad_name),
    CONSTRAINT fk_person_especialidad  FOREIGN KEY (person_especialidad) REFERENCES detall.especialidad(especialidad_name),
    CONSTRAINT fk_person_division      FOREIGN KEY (person_division)     REFERENCES detall.division(division_name),
    CONSTRAINT fk_person_rol           FOREIGN KEY (person_rol)          REFERENCES detall.person_rol(person_rol_name),
    CONSTRAINT fk_person_escuadrilla   FOREIGN KEY (person_escuadrilla_fk) REFERENCES detall.escuadrilla(escuadrilla_sk)
);

-- Unique person_nk only when not null (partial unique index, mismo patrón que SQL Server)
CREATE UNIQUE INDEX ix_person_person_nk
    ON detall.person (person_nk)
    WHERE person_nk IS NOT NULL;

-- Catálogo global de modelos de aeronave (datos doctrinales compartidos por
-- todas las escuadrillas, mismo patrón que operations.capba): tipo, fabricante,
-- modelo, variante y sus características. Las aeronaves físicas (matrículas)
-- viven en operations.aircraft y referencian un modelo. SIN escuadrilla_fk.
CREATE TABLE operations.aircraft_model (
    aircraft_model_sk        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aircraft_type            VARCHAR(50) NOT NULL,
    aircraft_make            VARCHAR(50) NOT NULL,
    aircraft_model           VARCHAR(50) NOT NULL,
    aircraft_variant         VARCHAR(50) NOT NULL,
    aircraft_is_multi_engine BOOLEAN     NOT NULL,
    aircraft_is_multi_pilot  BOOLEAN     NOT NULL,
    CONSTRAINT uq_aircraft_model UNIQUE (aircraft_type, aircraft_make, aircraft_model, aircraft_variant)
);

-- FK diferido de detall.escuadrilla.escuadrilla_model_fk (la columna se declara
-- arriba; el catálogo de modelos se crea aquí).
ALTER TABLE detall.escuadrilla
    ADD CONSTRAINT fk_escuadrilla_model
    FOREIGN KEY (escuadrilla_model_fk) REFERENCES operations.aircraft_model(aircraft_model_sk);

CREATE TABLE operations.aircraft (
    aircraft_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aircraft_model_fk        INTEGER     NOT NULL REFERENCES operations.aircraft_model(aircraft_model_sk),
    aircraft_registration    VARCHAR(20) NOT NULL UNIQUE,
    aircraft_number          VARCHAR(20) NOT NULL,
    aircraft_current_flag    BOOLEAN     NOT NULL DEFAULT TRUE,
    aircraft_escuadrilla_fk  INTEGER     NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk)
);

CREATE TABLE operations.event (
    event_sk     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_name   VARCHAR(100) NOT NULL,
    event_place  VARCHAR(100) NOT NULL,
    CONSTRAINT uq_event_name_place UNIQUE (event_name, event_place),
    CONSTRAINT fk_event_name FOREIGN KEY (event_name) REFERENCES operations.event_name(event_name_value)
);

CREATE TABLE operations.papeleta (
    papeleta_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    papeleta_name            VARCHAR(50)   NOT NULL UNIQUE,
    papeleta_description     TEXT          NOT NULL,
    papeleta_block           VARCHAR(100)  NOT NULL,
    papeleta_plan            VARCHAR(100),
    papeleta_tv              DECIMAL(4,1),
    papeleta_pilot_crp_value INTEGER,
    papeleta_dv_crp_value    INTEGER,
    papeleta_expiration      INTEGER,
    papeleta_order           INTEGER,
    papeleta_escuadrilla_fk  INTEGER       NOT NULL,
    CONSTRAINT fk_papeleta_block       FOREIGN KEY (papeleta_block) REFERENCES operations.papeleta_block(papeleta_block_name),
    CONSTRAINT fk_papeleta_plan        FOREIGN KEY (papeleta_plan)  REFERENCES operations.papeleta_plan(papeleta_plan_name),
    CONSTRAINT fk_papeleta_escuadrilla FOREIGN KEY (papeleta_escuadrilla_fk) REFERENCES detall.escuadrilla(escuadrilla_sk)
);

-- ============================================================
-- OPERATIONAL ENTITIES
-- ============================================================

CREATE TABLE operations.flight (
    flight_sk               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    flight_date             DATE         NOT NULL,
    flight_departure_place  INTEGER      NOT NULL REFERENCES operations.departure_arrival_place(departure_arrival_place_sk),
    flight_departure_time   TIME         NOT NULL,
    flight_arrival_place    INTEGER      NOT NULL REFERENCES operations.departure_arrival_place(departure_arrival_place_sk),
    flight_arrival_time     TIME         NOT NULL,
    flight_aircraft_fk      INTEGER      NOT NULL REFERENCES operations.aircraft(aircraft_sk),
    flight_event_fk         INTEGER      NOT NULL REFERENCES operations.event(event_sk),
    flight_person_cta_fk    INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    flight_escuadrilla_fk   INTEGER      NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    flight_total_hours      DECIMAL(4,1) NOT NULL CHECK (flight_total_hours > 0)
);

-- Horas extra por persona, unificadas (antes operations.extra_hour +
-- operations.extra_model_hour). Cada fila lleva fecha, discriminador real/sim
-- (extra_hours_is_real) y el modelo de aeronave (extra_hours_model_fk). Sin
-- UNIQUE: una persona puede tener varias filas (se suman en los cálculos de
-- horas y en la vista agrupada). person-centric (sin escuadrilla_fk): el
-- aislamiento se hace vía la escuadrilla de la persona.
--
-- En los cálculos de horas (queries/hours.sql) la distinción "horas del modelo
-- propio vs otros modelos" se hace comparando extra_hours_model_fk con
-- detall.escuadrilla.escuadrilla_model_fk: las del modelo propio cuentan en la
-- vista por periodo (filtradas por fecha); el resto solo en modo "Totales".
CREATE TABLE operations.extra_hour (
    extra_hours_sk          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    extra_hours_date        DATE          NOT NULL,
    extra_hours_person_fk   INTEGER       NOT NULL REFERENCES detall.person(person_sk),
    extra_hours_model_fk    INTEGER       NOT NULL REFERENCES operations.aircraft_model(aircraft_model_sk),
    extra_hours_is_real     BOOLEAN       NOT NULL,
    extra_hours_cta         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_cta >= 0),
    extra_hours_day         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_day >= 0),
    extra_hours_conv_night  DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_conv_night >= 0),
    extra_hours_gvn         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_gvn >= 0),
    extra_hours_inst        DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_inst >= 0),
    extra_hours_remarks     VARCHAR(200)
);
CREATE INDEX ix_extra_hours_model ON operations.extra_hour (extra_hours_model_fk);

CREATE TABLE operations.ground_school (
    ground_school_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ground_school_datetime        TIMESTAMPTZ NOT NULL,
    ground_school_person_fk       INTEGER   NOT NULL REFERENCES detall.person(person_sk),
    ground_school_papeleta_fk     INTEGER   NOT NULL REFERENCES operations.papeleta(papeleta_sk),
    ground_school_escuadrilla_fk  INTEGER   NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk)
);

CREATE TABLE operations.crew_qualification (
    crew_rating_sk                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_fk                        INTEGER NOT NULL REFERENCES detall.person(person_sk),
    crew_ratings_fk                  INTEGER NOT NULL REFERENCES operations.crew_rating_type(crew_rating_sk),
    date_qualified                   DATE,
    crew_qualification_escuadrilla_fk INTEGER NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    CONSTRAINT uq_person_helo_model UNIQUE (person_fk, crew_ratings_fk)
);

CREATE TABLE detall.comision (
    comision_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comision_start_date      DATE    NOT NULL,
    comision_end_date        DATE    NOT NULL,
    -- comision_dias se calcula en Go (end - start + 1); columna PERSISTED eliminada.
    comision_type_fk         INTEGER NOT NULL REFERENCES detall.comision_type(comision_type_sk),
    comision_lugar_fk        INTEGER NOT NULL REFERENCES detall.comision_lugar(comision_lugar_sk),
    comision_escuadrilla_fk  INTEGER NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    comision_esfuerzo        BOOLEAN NOT NULL,
    -- Horas locales (wall-clock) de salida (1er día) y llegada (último día).
    -- La llegada ajusta el esfuerzo del último día (ver queries/esfuerzo.sql);
    -- la salida es informativa. DEFAULT mantiene vivos los inserts del seed y
    -- los valores conservan el cómputo previo (llegada >= 14:00 => el día cuenta).
    comision_departure_time  TIME NOT NULL DEFAULT '08:00',
    comision_arrival_time    TIME NOT NULL DEFAULT '14:00',
    -- Código/referencia libre de la comisión (p. ej. orden externa). Opcional,
    -- no único: fuera de uq_comision a propósito.
    comision_code            VARCHAR(50),
    CONSTRAINT chk_fechas_validas CHECK (comision_end_date >= comision_start_date),
    CONSTRAINT uq_comision UNIQUE (
        comision_start_date, comision_end_date, comision_type_fk, comision_lugar_fk, comision_esfuerzo
    )
);

CREATE TABLE detall.notcrew_qualification (
    notcrew_ratings_sk                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_fk                             INTEGER NOT NULL REFERENCES detall.person(person_sk),
    notcrew_rating_fk                     INTEGER NOT NULL REFERENCES detall.notcrew_rating_type(notcrew_rating_sk),
    date_qualified                        TIMESTAMPTZ,
    notcrew_qualification_escuadrilla_fk  INTEGER NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    CONSTRAINT uq_person_notcrew UNIQUE (person_fk, notcrew_rating_fk)
);

CREATE TABLE detall.absence (
    absence_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    absence_start_date      DATE    NOT NULL,
    absence_end_date        DATE    NOT NULL,
    -- absence_dias se calcula en Go; columna PERSISTED eliminada.
    absence_person_fk       INTEGER NOT NULL REFERENCES detall.person(person_sk),
    absence_reason_fk       INTEGER NOT NULL REFERENCES detall.absence_reason(absence_reason_sk),
    absence_remark          VARCHAR(200),
    absence_escuadrilla_fk  INTEGER NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    CONSTRAINT chk_fechas_validas_absence CHECK (absence_start_date <= absence_end_date)
);

CREATE TABLE detall.festivos (
    festivo_sk      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    festivo_dia     DATE         NOT NULL,
    festivo_motivo  VARCHAR(200) NOT NULL,
    CONSTRAINT uq_festivo UNIQUE (festivo_dia, festivo_motivo)
);

-- Reconocimientos de Seguridad de vuelo (médico, dunker, hipobárica). Cada fila
-- tiene ciclo de vida: nace PROGRAMADO (solo *_scheduled_date, la cita futura;
-- *_date NULL) y pasa a REALIZADO cuando se rellenan *_date, resultado y
-- *_expiry_date (caducidad). Por eso *_date y los campos de resultado son
-- nullable. El estado (vigente/por caducar/caducado/programado) se DERIVA de las
-- fechas en el frontend, no se persiste. SIN escuadrilla_fk: aislamiento
-- person-centric vía detall.person.person_escuadrilla_fk (igual que extra_hour).
CREATE TABLE flightsafety.medical_exam (
    medical_exam_sk             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_exam_date           DATE,         -- NULL mientras PROGRAMADO (no realizado aún)
    medical_exam_person_fk      INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    medical_exam_place_fk       INTEGER      REFERENCES flightsafety.medical_exam_place(medical_exam_place_sk),
    medical_exam_result_fk      INTEGER      REFERENCES flightsafety.medical_exam_result(medical_exam_result_sk),
    medical_exam_remark         VARCHAR(200),
    medical_exam_scheduled_date DATE,         -- día asignado para renovar (cita)
    medical_exam_expiry_date    DATE          -- caducidad (= fecha + 1 año por defecto)
);

CREATE TABLE flightsafety.dunker (
    dunker_sk             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dunker_date           DATE,            -- NULL mientras PROGRAMADO
    dunker_person_fk      INTEGER NOT NULL REFERENCES detall.person(person_sk),
    dunker_result         BOOLEAN,
    dunker_scheduled_date DATE,            -- día asignado para renovar (cita)
    dunker_expiry_date    DATE             -- caducidad (= fecha + 1 año por defecto)
);

CREATE TABLE flightsafety.hypobaric (
    hypobaric_sk             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hypobaric_date           DATE,        -- NULL mientras PROGRAMADO
    hypobaric_person_fk      INTEGER NOT NULL REFERENCES detall.person(person_sk),
    hypobaric_result         BOOLEAN,
    hypobaric_scheduled_date DATE,        -- día asignado para renovar (cita)
    hypobaric_expiry_date    DATE         -- caducidad (= fecha + 5 años por defecto)
);

CREATE TABLE operations.fuel (
    fuel_sk        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fuel_date      DATE          NOT NULL,
    fuel_helo_fk   INTEGER       NOT NULL REFERENCES operations.aircraft(aircraft_sk),
    fuel_place_fk  INTEGER       NOT NULL REFERENCES operations.fuel_place(fuel_place_sk),
    fuel_payer_fk  INTEGER       NOT NULL REFERENCES operations.fuel_payer(fuel_payer_sk),
    fuel_event_fk  INTEGER       NOT NULL REFERENCES operations.event(event_sk),
    fuel_phase_fk  INTEGER       NOT NULL REFERENCES operations.fuel_phase(fuel_phase_sk),
    fuel_type_fk   INTEGER       NOT NULL REFERENCES operations.fuel_type(fuel_type_sk),
    fuel_qty       DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- JUNCTION / FACT TABLES (cuelgan de operations.flight)
-- ============================================================

CREATE TABLE operations.person_hour (
    person_hour_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    person_hour_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    person_hour_person_fk  INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    person_hour_period_fk  INTEGER      NOT NULL REFERENCES operations.period(period_sk),
    person_hour_hour_qty   DECIMAL(6,1) NOT NULL CHECK (person_hour_hour_qty >= 0),
    CONSTRAINT uq_person_hour_flight_person_period UNIQUE (
        person_hour_flight_fk, person_hour_person_fk, person_hour_period_fk
    )
);

CREATE TABLE operations.ift_hour (
    ift_hour_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ift_hour_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    ift_hour_person_fk  INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    ift_hour_qty        DECIMAL(6,1) NOT NULL CHECK (ift_hour_qty >= 0),
    CONSTRAINT uq_ift_hour_flight_person UNIQUE (ift_hour_flight_fk, ift_hour_person_fk)
);

CREATE TABLE operations.instructor_hour (
    instructor_hour_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_hour_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    instructor_hour_person_fk  INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    instructor_hour_qty        DECIMAL(6,1) NOT NULL CHECK (instructor_hour_qty >= 0),
    CONSTRAINT uq_instructor_hour_flight_person UNIQUE (instructor_hour_flight_fk, instructor_hour_person_fk)
);

CREATE TABLE operations.gvntype_hour (
    gvntype_hour_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gvntype_hour_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    gvntype_hour_person_fk  INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    gvntype_hour_iit_qty    DECIMAL(6,1) CHECK (gvntype_hour_iit_qty >= 0),
    gvntype_hour_anvis_qty  DECIMAL(6,1) CHECK (gvntype_hour_anvis_qty >= 0),
    CONSTRAINT uq_gvntype_hour_flight_person UNIQUE (gvntype_hour_flight_fk, gvntype_hour_person_fk)
);

CREATE TABLE operations.formation_hour (
    formation_hour_sk            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    formation_hour_flight_fk     INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    formation_hour_person_fk     INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    formation_hour_period_fk     INTEGER      NOT NULL REFERENCES operations.period(period_sk),
    formation_hour_formation_qty DECIMAL(6,1) CHECK (formation_hour_formation_qty >= 0),
    CONSTRAINT uq_formation_hour_flight_person_period UNIQUE (
        formation_hour_flight_fk, formation_hour_person_fk, formation_hour_period_fk
    )
);

CREATE TABLE operations.wt_hour (
    wt_hour_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wt_hour_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    wt_hour_person_fk  INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    wt_hour_qty        DECIMAL(6,1) NOT NULL CHECK (wt_hour_qty >= 0),
    CONSTRAINT uq_wt_hour_flight_person UNIQUE (wt_hour_flight_fk, wt_hour_person_fk)
);

CREATE TABLE operations.approach (
    app_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_flight_fk  INTEGER NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    app_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    app_type_fk    INTEGER NOT NULL REFERENCES operations.ifr_app_type(ifr_app_type_sk),
    app_qty        INTEGER NOT NULL CHECK (app_qty > 0),
    CONSTRAINT uq_app_flight_person_type UNIQUE (app_flight_fk, app_person_fk, app_type_fk)
);

CREATE TABLE operations.landing (
    landing_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    landing_flight_fk  INTEGER NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    landing_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    landing_place_fk   INTEGER NOT NULL REFERENCES operations.landing_place(landing_place_sk),
    landing_period_fk  INTEGER NOT NULL REFERENCES operations.period(period_sk),
    landing_qty        INTEGER NOT NULL CHECK (landing_qty > 0),
    CONSTRAINT uq_landing_flight_person_place_period UNIQUE (
        landing_flight_fk, landing_person_fk, landing_place_fk, landing_period_fk
    )
);

CREATE TABLE operations.projectile (
    projectile_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projectile_flight_fk  INTEGER NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    projectile_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    projectile_type_fk    INTEGER NOT NULL REFERENCES operations.projectile_type(projectile_type_sk),
    projectile_qty        INTEGER NOT NULL CHECK (projectile_qty > 0),
    CONSTRAINT uq_projectile_flight_person_type UNIQUE (projectile_flight_fk, projectile_person_fk, projectile_type_fk)
);

CREATE TABLE operations.papeleta_crew_count (
    papeleta_crew_count_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    papeleta_crew_count_flight_fk  INTEGER NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    papeleta_crew_count_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    papeleta_crew_count_session_fk INTEGER NOT NULL REFERENCES operations.papeleta(papeleta_sk),
    papeleta_crew_count_period_fk  INTEGER NOT NULL REFERENCES operations.period(period_sk),
    CONSTRAINT uq_papeleta_crew_flight_person_session UNIQUE (
        papeleta_crew_count_flight_fk, papeleta_crew_count_person_fk, papeleta_crew_count_session_fk
    )
);

CREATE TABLE operations.cupo_hour (
    cupo_hour_sk        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cupo_flight_fk      INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    cupo_authority_fk   INTEGER      NOT NULL REFERENCES operations.authority(authority_sk),
    cupo_hour_qty       DECIMAL(6,1) NOT NULL CHECK (cupo_hour_qty > 0),
    CONSTRAINT uq_cupo_flight_authority UNIQUE (cupo_flight_fk, cupo_authority_fk)
);

CREATE TABLE operations.passenger (
    passenger_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    passenger_flight_fk  INTEGER NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    passenger_type_fk    INTEGER NOT NULL REFERENCES operations.passenger_type(passenger_type_sk),
    passenger_qty        INTEGER NOT NULL CHECK (passenger_qty > 0),
    passenger_route      TEXT    NOT NULL
);

CREATE TABLE detall.person_comision (
    person_comision_sk  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    comision_fk         INTEGER NOT NULL REFERENCES detall.comision(comision_sk) ON DELETE CASCADE,
    person_fk           INTEGER NOT NULL REFERENCES detall.person(person_sk),
    CONSTRAINT uq_comision_person UNIQUE (comision_fk, person_fk)
);

-- Ranchería: función que SOLO algunos participantes realizan durante una
-- comisión (no es un tipo de comisión). Tabla dispersa: existe fila únicamente
-- para quien hizo ranchería, con sus días (puede ser un subconjunto de la
-- duración: en una comisión de 30 días, A hace 15 y B los otros 15). El tope
-- días ≤ duración de la comisión se valida en el servicio (cruza tablas).
CREATE TABLE detall.person_comision_rancheria (
    person_comision_fk  INTEGER PRIMARY KEY
        REFERENCES detall.person_comision(person_comision_sk) ON DELETE CASCADE,
    dias                INTEGER NOT NULL CHECK (dias > 0)
);

CREATE TABLE operations.capba_hour (
    capba_hour_sk    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    capba_flight_fk  INTEGER      NOT NULL REFERENCES operations.flight(flight_sk) ON DELETE CASCADE,
    capba_capba_fk   INTEGER      NOT NULL REFERENCES operations.capba(capba_id),
    capba_hour_qty   DECIMAL(6,1) NOT NULL CHECK (capba_hour_qty > 0),
    CONSTRAINT uq_capba_flight_capba UNIQUE (capba_flight_fk, capba_capba_fk)
);

CREATE TABLE operations.escuadrilla_capba (
    escuadrilla_capba_sk                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    escuadrilla_capba_escuadrilla_fk    INTEGER NOT NULL REFERENCES detall.escuadrilla(escuadrilla_sk),
    escuadrilla_capba_capba_fk          INTEGER NOT NULL REFERENCES operations.capba(capba_id),
    escuadrilla_capba_capacidad_operativa INTEGER NOT NULL,
    CONSTRAINT uq_capba_escuadrilla_capba UNIQUE (escuadrilla_capba_escuadrilla_fk, escuadrilla_capba_capba_fk)
);

-- ============================================================
-- AUDIT TABLE
-- old_data / new_data en JSONB (en SQL Server eran NVARCHAR(MAX) con FOR JSON PATH).
-- ============================================================

CREATE TABLE detall.audit_log (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name   VARCHAR(100) NOT NULL,
    operation    VARCHAR(20)  NOT NULL,
    record_id    VARCHAR(100) NOT NULL,
    old_data     JSONB,
    new_data     JSONB,
    user_id      VARCHAR(100),
    ip_address   VARCHAR(45),
    changed_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Auth: sesiones web (consolidado de los antiguos 0003/0006).
--   - detall.person.person_password_hash (arriba): argon2id PHC string.
--   - detall.session: sesiones server-side, una fila por sesión activa. El
--     cliente recibe un token aleatorio en cookie HttpOnly; en BD guardamos
--     SHA-256(token) — robar la BD no permite reusar tokens.
--   - Timestamps con zona (timestamptz): la expiración se compara bien aunque
--     la app y la BD estén en zonas distintas (TIMESTAMP pelado daba un bug real).
-- (detall.session_info del modelo antiguo no se traduce.)
-- ============================================================
CREATE TABLE detall.session (
    session_sk     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash     BYTEA        NOT NULL,
    person_fk      INTEGER      NOT NULL REFERENCES detall.person(person_sk) ON DELETE CASCADE,
    ip_address     VARCHAR(45),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TIMESTAMPTZ  NOT NULL,
    last_seen_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_session_token_hash ON detall.session (token_hash);
CREATE INDEX ix_session_expires_at        ON detall.session (expires_at);
CREATE INDEX ix_session_person_fk         ON detall.session (person_fk);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW detall.v_person_ordered AS
WITH cga_min AS (
    SELECT person_a_emp, MIN(person_num_escalafon) AS min_escalafon
    FROM detall.person
    WHERE person_cuerpo = 'CGA'
    GROUP BY person_a_emp
)
SELECT
    p.person_sk,
    p.person_nk,
    p.person_user,
    p.person_rank,
    p.person_cuerpo,
    p.person_especialidad,
    p.person_name,
    p.person_last_name_1,
    p.person_last_name_2,
    p.person_phone,
    p.person_dni,
    p.person_localidad,
    p.person_division,
    p.person_rol,
    p.person_a_emp,
    p.person_f_emb,
    p.person_birthdate,
    p.person_num_escalafon,
    p.person_current_flag,
    p.person_permission_level,
    p.person_escuadrilla_fk,
    r.rank_category,
    ROW_NUMBER() OVER (
        ORDER BY
            r.rank_order,                                                      -- 1. Rango
            p.person_a_emp,                                                    -- 2. Antigüedad en el empleo
            CASE WHEN p.person_cuerpo = 'CGA'
                  AND p.person_num_escalafon = cm.min_escalafon
                 THEN 0 ELSE 1 END,                                            -- 3. CGA nº1 primero
            p.person_cuerpo,                                                   -- 4. Cuerpo
            p.person_num_escalafon,                                            -- 5. Escalafón
            p.person_birthdate DESC                                            -- 6. Fecha de nacimiento
    ) AS order_position
FROM detall.person p
JOIN detall.rank r ON p.person_rank = r.rank_name
LEFT JOIN cga_min cm ON p.person_a_emp = cm.person_a_emp;

CREATE OR REPLACE VIEW operations.view_last_flights AS
SELECT
    f.flight_sk                                        AS id,
    TO_CHAR(f.flight_date, 'DD-MM-YYYY')               AS fecha_hora,  -- SQL Server usaba 'dd-MM-yyyy HH:mm' pero flight_date es DATE
    h.aircraft_number                                  AS helicoptero,
    (e.event_name || ' ' || e.event_place)             AS evento,
    p.person_nk                                        AS hac,
    f.flight_total_hours                               AS horas
FROM operations.flight f
JOIN operations.aircraft h ON f.flight_aircraft_fk = h.aircraft_sk
JOIN operations.event    e ON f.flight_event_fk    = e.event_sk
JOIN detall.person       p ON f.flight_person_cta_fk = p.person_sk;

CREATE OR REPLACE VIEW operations.view_ground_school AS
SELECT
    gs.ground_school_sk                          AS id,
    TO_CHAR(gs.ground_school_datetime, 'DD-MM-YYYY') AS fecha_hora,
    p.person_nk                                  AS crew,
    pap.papeleta_name                            AS nombre,
    pap.papeleta_description                     AS descripcion,
    pap.papeleta_block                           AS bloque
FROM operations.ground_school gs
JOIN detall.person     p   ON gs.ground_school_person_fk   = p.person_sk
JOIN operations.papeleta pap ON gs.ground_school_papeleta_fk = pap.papeleta_sk;

-- ============================================================
-- INDEXES (rendimiento — los UNIQUE/PK ya están definidos arriba)
-- ============================================================

CREATE INDEX ix_audit_log_table     ON detall.audit_log(table_name);
CREATE INDEX ix_audit_log_operation ON detall.audit_log(operation);

-- Covering index para queries por fecha (PG 11+: INCLUDE soportado)
CREATE INDEX ix_flight_date_covering
    ON operations.flight (flight_date)
    INCLUDE (flight_sk, flight_total_hours, flight_event_fk, flight_aircraft_fk);

CREATE INDEX ix_person_rol ON detall.person(person_rol);

CREATE INDEX ix_cupo_hour_flight
    ON operations.cupo_hour (cupo_flight_fk)
    INCLUDE (cupo_authority_fk, cupo_hour_qty);

CREATE INDEX ix_person_hour_person_flight
    ON operations.person_hour (person_hour_person_fk, person_hour_flight_fk);

CREATE INDEX ix_flight_sk_datetime
    ON operations.flight (flight_sk)
    INCLUDE (flight_date);

CREATE INDEX ix_flight_event       ON operations.flight (flight_event_fk);
CREATE INDEX ix_flight_helo        ON operations.flight (flight_aircraft_fk);
CREATE INDEX ix_flight_person_cta  ON operations.flight (flight_person_cta_fk);

CREATE INDEX ix_absence_person_dates
    ON detall.absence (absence_person_fk, absence_start_date, absence_end_date);

CREATE INDEX ix_absence_escuadrilla ON detall.absence (absence_escuadrilla_fk);

CREATE INDEX ix_person_comision_person ON detall.person_comision (person_fk);

CREATE INDEX ix_comision_dates
    ON detall.comision (comision_start_date, comision_end_date)
    INCLUDE (comision_type_fk, comision_lugar_fk, comision_esfuerzo);

CREATE INDEX ix_papeleta_crew_count_person_session
    ON operations.papeleta_crew_count (papeleta_crew_count_person_fk, papeleta_crew_count_session_fk)
    INCLUDE (papeleta_crew_count_flight_fk);

CREATE INDEX ix_ground_school_escuadrilla
    ON operations.ground_school (ground_school_escuadrilla_fk);

CREATE INDEX ix_crew_qualification_escuadrilla
    ON operations.crew_qualification (crew_qualification_escuadrilla_fk);

CREATE INDEX ix_notcrew_qualification_escuadrilla
    ON detall.notcrew_qualification (notcrew_qualification_escuadrilla_fk);

-- FKs por escuadrilla sin índice (filtrado RLS-por-código en cada query)
CREATE INDEX ix_flight_escuadrilla   ON operations.flight   (flight_escuadrilla_fk);
CREATE INDEX ix_papeleta_escuadrilla ON operations.papeleta (papeleta_escuadrilla_fk);
CREATE INDEX ix_comision_escuadrilla ON detall.comision     (comision_escuadrilla_fk);
CREATE INDEX ix_aircraft_escuadrilla ON operations.aircraft (aircraft_escuadrilla_fk);
CREATE INDEX ix_aircraft_model        ON operations.aircraft (aircraft_model_fk);

-- *_person_fk de fact tables cuyo UNIQUE empieza por flight_fk (PG no indexa FKs):
-- sin esto, una consulta "todo lo de una persona" hace seq scan.
CREATE INDEX ix_ift_hour_person         ON operations.ift_hour         (ift_hour_person_fk);
CREATE INDEX ix_instructor_hour_person  ON operations.instructor_hour  (instructor_hour_person_fk);
CREATE INDEX ix_gvntype_hour_person     ON operations.gvntype_hour     (gvntype_hour_person_fk);
CREATE INDEX ix_formation_hour_person   ON operations.formation_hour   (formation_hour_person_fk);
CREATE INDEX ix_wt_hour_person          ON operations.wt_hour          (wt_hour_person_fk);
CREATE INDEX ix_approach_person         ON operations.approach         (app_person_fk);
CREATE INDEX ix_landing_person          ON operations.landing          (landing_person_fk);
CREATE INDEX ix_projectile_person       ON operations.projectile       (projectile_person_fk);

-- FKs secundarias de fact tables cuyo UNIQUE empieza por flight_fk (sin person_fk).
CREATE INDEX ix_cupo_hour_authority     ON operations.cupo_hour        (cupo_authority_fk);
CREATE INDEX ix_capba_hour_capba        ON operations.capba_hour       (capba_capba_fk);

-- ============================================================
-- TRIGGERS DE INVARIANTE + AUDITORÍA
--
-- Invariantes de integridad: una persona no puede tener comisiones
-- ni ausencias que se solapen entre sí, ni una de cada tipo a la vez.
-- Se mantienen en BD porque son reglas duras del dominio, no lógica
-- de negocio.
--
-- Auditoría: tr_audit_flight / tr_audit_person registran cambios como
-- JSONB. El user_id / ip se inyectan desde Go vía GUCs locales:
--   SET LOCAL aether.user_id = '...';
--   SET LOCAL aether.ip_address = '...';
-- ============================================================

-- Una persona no puede estar asignada a dos comisiones cuyas fechas
-- se solapen.
CREATE OR REPLACE FUNCTION detall.fn_trg_no_overlap_comision()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM detall.comision c1
        JOIN detall.person_comision jpc
              ON jpc.person_fk = NEW.person_fk
             AND jpc.person_comision_sk <> NEW.person_comision_sk
        JOIN detall.comision c2
              ON c2.comision_sk = jpc.comision_fk
        WHERE c1.comision_sk = NEW.comision_fk
          AND c1.comision_start_date <= c2.comision_end_date
          AND c1.comision_end_date   >= c2.comision_start_date
    ) THEN
        RAISE EXCEPTION 'UPDATE/INSERT inválido: la persona ya tiene otra comisión en esas fechas.'
            USING ERRCODE = '23514';  -- check_violation
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_overlap_comision
    AFTER INSERT OR UPDATE ON detall.person_comision
    FOR EACH ROW EXECUTE FUNCTION detall.fn_trg_no_overlap_comision();

-- No se puede crear una comisión-persona cuyas fechas solapen con
-- una ausencia existente de esa misma persona.
CREATE OR REPLACE FUNCTION detall.fn_trg_no_comision_during_absence()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM detall.comision c
        JOIN detall.absence a
              ON a.absence_person_fk = NEW.person_fk
        WHERE c.comision_sk = NEW.comision_fk
          AND c.comision_start_date <= a.absence_end_date
          AND c.comision_end_date   >= a.absence_start_date
    ) THEN
        RAISE EXCEPTION 'UPDATE/INSERT inválido: la persona tiene una ausencia en esas fechas.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_comision_during_absence
    AFTER INSERT OR UPDATE ON detall.person_comision
    FOR EACH ROW EXECUTE FUNCTION detall.fn_trg_no_comision_during_absence();

-- No se puede crear una ausencia cuyas fechas solapen con una
-- comisión-persona existente para esa misma persona.
CREATE OR REPLACE FUNCTION detall.fn_trg_no_absence_during_comision()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM detall.person_comision jpc
        JOIN detall.comision c
              ON c.comision_sk = jpc.comision_fk
        WHERE jpc.person_fk = NEW.absence_person_fk
          AND NEW.absence_start_date <= c.comision_end_date
          AND NEW.absence_end_date   >= c.comision_start_date
    ) THEN
        RAISE EXCEPTION 'UPDATE/INSERT inválido: la persona tiene una comisión en esas fechas.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_absence_during_comision
    AFTER INSERT OR UPDATE ON detall.absence
    FOR EACH ROW EXECUTE FUNCTION detall.fn_trg_no_absence_during_comision();

-- Registra INSERT/UPDATE/DELETE en operations.flight como JSONB.
CREATE OR REPLACE FUNCTION operations.fn_tr_audit_flight()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id     TEXT := current_setting('aether.user_id',    true);
    v_ip_address  TEXT := current_setting('aether.ip_address', true);
BEGIN
    IF v_user_id IS NULL OR v_user_id = '' THEN
        v_user_id := SESSION_USER;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, new_data, user_id, ip_address)
        VALUES ('flight', 'INSERT', NEW.flight_sk::TEXT, row_to_json(NEW)::JSONB, v_user_id, v_ip_address);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, old_data, new_data, user_id, ip_address)
        VALUES ('flight', 'UPDATE', NEW.flight_sk::TEXT,
                row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB,
                v_user_id, v_ip_address);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, old_data, user_id, ip_address)
        VALUES ('flight', 'DELETE', OLD.flight_sk::TEXT, row_to_json(OLD)::JSONB, v_user_id, v_ip_address);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_flight
    AFTER INSERT OR UPDATE OR DELETE ON operations.flight
    FOR EACH ROW EXECUTE FUNCTION operations.fn_tr_audit_flight();

-- Registra INSERT/UPDATE/DELETE en detall.person como JSONB.
-- El hash de contraseña NUNCA se guarda en el log: se sustituye por un
-- booleano person_password_hash_present (solo consta si había hash).
CREATE OR REPLACE FUNCTION detall.fn_tr_audit_person()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id     TEXT := current_setting('aether.user_id',    true);
    v_ip_address  TEXT := current_setting('aether.ip_address', true);
    v_old         JSONB;
    v_new         JSONB;
BEGIN
    IF v_user_id IS NULL OR v_user_id = '' THEN
        v_user_id := SESSION_USER;
    END IF;

    -- Redacta el hash: lo elimina y deja solo si estaba presente.
    IF (TG_OP IN ('UPDATE', 'DELETE')) THEN
        v_old := (row_to_json(OLD)::JSONB - 'person_password_hash')
                 || jsonb_build_object('person_password_hash_present', OLD.person_password_hash IS NOT NULL);
    END IF;
    IF (TG_OP IN ('INSERT', 'UPDATE')) THEN
        v_new := (row_to_json(NEW)::JSONB - 'person_password_hash')
                 || jsonb_build_object('person_password_hash_present', NEW.person_password_hash IS NOT NULL);
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, new_data, user_id, ip_address)
        VALUES ('person', 'INSERT', NEW.person_sk::TEXT, v_new, v_user_id, v_ip_address);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, old_data, new_data, user_id, ip_address)
        VALUES ('person', 'UPDATE', NEW.person_sk::TEXT, v_old, v_new, v_user_id, v_ip_address);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO detall.audit_log (table_name, operation, record_id, old_data, user_id, ip_address)
        VALUES ('person', 'DELETE', OLD.person_sk::TEXT, v_old, v_user_id, v_ip_address);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_person
    AFTER INSERT OR UPDATE OR DELETE ON detall.person
    FOR EACH ROW EXECUTE FUNCTION detall.fn_tr_audit_person();
