-- ============================================================
-- Aether-Web: esquema base (Hito 1)
-- Traducción de aether-sqlServer.sql → PostgreSQL.
-- Excluye: RLS (security policy), SPs, TVFs, triggers de
-- invariante (en 0004) y schema floan (fuera de alcance).
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
    escuadrilla_creation_date  DATE         NOT NULL
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
    fuel_place     VARCHAR(50) NOT NULL UNIQUE
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

CREATE TABLE operations.aircraft (
    aircraft_sk              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aircraft_type            VARCHAR(50) NOT NULL,
    aircraft_make            VARCHAR(50) NOT NULL,
    aircraft_model           VARCHAR(50) NOT NULL,
    aircraft_variant         VARCHAR(50) NOT NULL,
    aircraft_registration    VARCHAR(20) NOT NULL UNIQUE,
    aircraft_number          VARCHAR(20) NOT NULL,
    aircraft_current_flag    BOOLEAN     NOT NULL DEFAULT TRUE,
    aircraft_is_multi_engine BOOLEAN     NOT NULL,
    aircraft_is_multi_pilot  BOOLEAN     NOT NULL,
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

CREATE TABLE operations.extra_hour (
    extra_hours_sk          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    extra_hours_person_fk   INTEGER       NOT NULL REFERENCES detall.person(person_sk),
    extra_hours_cta         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_cta >= 0),
    extra_hours_day         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_day >= 0),
    extra_hours_conv_night  DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_conv_night >= 0),
    extra_hours_gvn         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_gvn >= 0),
    extra_hours_inst        DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_hours_inst >= 0),
    extra_hours_remarks     VARCHAR(200)
);

-- Horas del modelo de aeronave anterior, unificadas: extra_model_hours_is_real
-- discrimina real (TRUE) vs simulador (FALSE). Sin UNIQUE: una persona puede
-- tener varias filas de cada tipo (se suman en los cálculos de horas).
CREATE TABLE operations.extra_model_hour (
    extra_model_hours_sk          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    extra_model_hours_date        DATE          NOT NULL,
    extra_model_hours_person_fk   INTEGER       NOT NULL REFERENCES detall.person(person_sk),
    extra_model_hours_is_real     BOOLEAN       NOT NULL,
    extra_model_hours_cta         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_model_hours_cta >= 0),
    extra_model_hours_day         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_model_hours_day >= 0),
    extra_model_hours_conv_night  DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_model_hours_conv_night >= 0),
    extra_model_hours_gvn         DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_model_hours_gvn >= 0),
    extra_model_hours_inst        DECIMAL(8,1)  NOT NULL DEFAULT 0 CHECK (extra_model_hours_inst >= 0),
    extra_model_hours_remarks     VARCHAR(200)
);

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

CREATE TABLE flightsafety.medical_exam (
    medical_exam_sk          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medical_exam_date        DATE         NOT NULL,
    medical_exam_person_fk   INTEGER      NOT NULL REFERENCES detall.person(person_sk),
    medical_exam_place_fk    INTEGER      NOT NULL REFERENCES flightsafety.medical_exam_place(medical_exam_place_sk),
    medical_exam_result_fk   INTEGER      NOT NULL REFERENCES flightsafety.medical_exam_result(medical_exam_result_sk),
    medical_exam_remark      VARCHAR(200)
);

CREATE TABLE flightsafety.dunker (
    dunker_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dunker_date       DATE    NOT NULL,
    dunker_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    dunker_result     BOOLEAN
);

CREATE TABLE flightsafety.hyperbaric (
    hyperbaric_sk         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hyperbaric_date       DATE    NOT NULL,
    hyperbaric_person_fk  INTEGER NOT NULL REFERENCES detall.person(person_sk),
    hyperbaric_result     BOOLEAN
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
