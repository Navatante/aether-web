#!/usr/bin/env python3
"""
Migra datos productivos de Microsoft SQL Server (Aether-Tauri) a
PostgreSQL (Aether-Web).

Asume que el destino ya está migrado con golang-migrate:
  - 0001_init_schema (estructura)
  - 0002_seed_lookups (catálogo)
  - 0003_auth_tables (en Hito 2)
  - 0004_triggers

El script:
  1. Lee tablas en orden FK-aware desde SQL Server.
  2. Limpia tabla destino (TRUNCATE) y vuelca filas.
  3. Preserva SKs origen con OVERRIDING SYSTEM VALUE.
  4. Resetea las secuencias.
  5. Compara conteos origen/destino y reporta.

Requisitos:
    pip install pyodbc psycopg[binary]

Uso típico:
    python migrationSQLServerToPostgres.py \\
        --mssql-conn "DRIVER={ODBC Driver 18 for SQL Server};SERVER=...;DATABASE=aether;UID=...;PWD=...;TrustServerCertificate=yes" \\
        --pg-dsn "postgresql://aether:aether@localhost:5432/aether"
"""
from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass

import psycopg
import pyodbc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("migrate")


# ============================================================
# Tabla de migración: orden FK-aware (lookups → masters → facts).
# Cada entrada describe una tabla: nombre cualificado, columnas y
# si se preservan SKs explícitos (OVERRIDING SYSTEM VALUE).
# ============================================================

@dataclass(frozen=True)
class Table:
    name: str                   # schema.table
    columns: tuple[str, ...]    # columnas en orden de INSERT
    override_identity: bool = False
    # Si el nombre cambia entre origen y destino (camelCase → lowercase),
    # se especifica aquí: {pg_name: source_name}.
    column_aliases: dict[str, str] | None = None
    source_table: str | None = None  # si el nombre de tabla difiere

    def src_name(self) -> str:
        return self.source_table or self.name

    def src_column(self, pg_col: str) -> str:
        if self.column_aliases and pg_col in self.column_aliases:
            return self.column_aliases[pg_col]
        return pg_col


TABLES: list[Table] = [
    # ---- Lookups detall ----
    Table("detall.rank",                 ("rank_sk", "rank_name", "rank_order", "rank_category"), override_identity=True),
    Table("detall.localidad",            ("localidad_sk", "localidad_name"), override_identity=True),
    Table("detall.especialidad",         ("especialidad_sk", "especialidad_name"), override_identity=True),
    Table("detall.division",             ("division_sk", "division_name"), override_identity=True),
    Table("detall.person_rol",           ("person_rol_sk", "person_rol_name"), override_identity=True),
    Table("detall.escuadrilla",          ("escuadrilla_sk", "escuadrilla_code", "escuadrilla_name", "escuadrilla_creation_date"), override_identity=True),
    Table("detall.comision_type",        ("comision_type_sk", "name", "origin"), override_identity=True),
    Table("detall.comision_lugar",       ("comision_lugar_sk", "comision_name"), override_identity=True),
    Table("detall.notcrew_rating_type",  ("notcrew_rating_sk", "notcrew_rating_name", "notcrew_rating_abrv"),
          override_identity=True,
          source_table="detall.notCrew_rating_type",
          column_aliases={"notcrew_rating_sk": "notCrew_rating_sk", "notcrew_rating_name": "notCrew_rating_name", "notcrew_rating_abrv": "notCrew_rating_abrv"}),
    Table("detall.absence_reason",       ("absence_reason_sk", "absence_reason"), override_identity=True),

    # ---- Lookups operations ----
    Table("operations.event_name",               ("event_name_sk", "event_name_value"), override_identity=True),
    Table("operations.papeleta_block",           ("papeleta_block_sk", "papeleta_block_name"), override_identity=True),
    Table("operations.papeleta_plan",            ("papeleta_plan_sk", "papeleta_plan_name"), override_identity=True),
    Table("operations.departure_arrival_place",  ("departure_arrival_place_sk", "departure_arrival_place_code", "departure_arrival_place_name"), override_identity=True),
    Table("operations.period",                   ("period_sk", "period_name"), override_identity=True),
    Table("operations.ifr_app_type",             ("ifr_app_type_sk", "ifr_app_type_name", "ifr_app_type_type"), override_identity=True),
    Table("operations.landing_place",            ("landing_place_sk", "landing_place_name"), override_identity=True),
    Table("operations.projectile_type",          ("projectile_type_sk", "projectile_type_name", "projectile_type_weapon"), override_identity=True),
    Table("operations.authority",                ("authority_sk", "authority_name", "authority_abrv"), override_identity=True),
    Table("operations.passenger_type",           ("passenger_type_sk", "passenger_type_name"), override_identity=True),
    Table("operations.crew_rating_type",         ("crew_rating_sk", "name", "abbreviation", "type", "role"), override_identity=True),
    Table("operations.fuel_place",               ("fuel_place_sk", "fuel_place"), override_identity=True),
    Table("operations.fuel_payer",               ("fuel_payer_sk", "fuel_payer_assignment_type_abbrev", "fuel_payer_assignment_type", "fuel_payer_name"), override_identity=True),
    Table("operations.fuel_phase",               ("fuel_phase_sk", "fuel_phase"), override_identity=True),
    Table("operations.fuel_type",                ("fuel_type_sk", "fuel_type"), override_identity=True),
    Table("operations.capba_group",              ("capba_group_sk", "capba_group_code", "capba_group_name"), override_identity=True),
    Table("operations.capba",                    ("capba_id", "capba_group_code_fk", "capba_name")),

    # ---- Lookups flightsafety ----
    Table("flightsafety.medical_exam_result",   ("medical_exam_result_sk", "medical_exam_result"), override_identity=True),
    Table("flightsafety.medical_exam_place",    ("medical_exam_place_sk", "medical_exam_place"), override_identity=True),

    # ---- Masters ----
    Table("detall.person", (
        "person_sk", "person_nk", "person_user", "person_rank", "person_cuerpo", "person_especialidad",
        "person_name", "person_last_name_1", "person_last_name_2", "person_phone", "person_dni",
        "person_localidad", "person_division", "person_rol", "person_a_emp", "person_f_emb",
        "person_birthdate", "person_num_escalafon", "person_current_flag", "person_permission_level",
        "person_escuadrilla_fk",
    ), override_identity=True),
    Table("operations.aircraft", (
        "aircraft_sk", "aircraft_type", "aircraft_make", "aircraft_model", "aircraft_variant",
        "aircraft_registration", "aircraft_number", "aircraft_current_flag", "aircraft_is_multi_engine",
        "aircraft_is_multi_pilot", "aircraft_escuadrilla_fk",
    ), override_identity=True),
    Table("operations.event",     ("event_sk", "event_name", "event_place"), override_identity=True),
    Table("operations.papeleta", (
        "papeleta_sk", "papeleta_name", "papeleta_description", "papeleta_block", "papeleta_plan",
        "papeleta_tv", "papeleta_pilot_crp_value", "papeleta_dv_crp_value", "papeleta_expiration",
        "papeleta_escuadrilla_fk",
    ), override_identity=True),
    Table("detall.festivos",      ("festivo_sk", "festivo_dia", "festivo_motivo"), override_identity=True),

    # ---- Entidades operativas ----
    Table("operations.flight", (
        "flight_sk", "flight_date", "flight_departure_place", "flight_departure_time",
        "flight_arrival_place", "flight_arrival_time", "flight_aircraft_fk", "flight_event_fk",
        "flight_person_cta_fk", "flight_escuadrilla_fk", "flight_total_hours",
    ), override_identity=True),
    Table("operations.previous_hour", (
        "previous_hours_sk", "previous_hours_person_fk", "previous_hours_cta", "previous_hours_day",
        "previous_hours_conv_night", "previous_hours_gvn", "previous_hours_inst",
    ), override_identity=True),
    Table("operations.previous_model_real_hour", (
        "previous_model_real_hours_sk", "previous_model_real_hours_date", "previous_model_real_hours_person_fk",
        "previous_model_real_hours_cta", "previous_model_real_hours_day", "previous_model_real_hours_conv_night",
        "previous_model_real_hours_gvn", "previous_model_real_hours_inst",
    ), override_identity=True),
    Table("operations.previous_model_sim_hour", (
        "previous_model_sim_hours_sk", "previous_model_sim_hours_date", "previous_model_sim_hours_person_fk",
        "previous_model_sim_hours_cta", "previous_model_sim_hours_day", "previous_model_sim_hours_conv_night",
        "previous_model_sim_hours_gvn", "previous_model_sim_hours_inst",
    ), override_identity=True),
    Table("operations.ground_school", (
        "ground_school_sk", "ground_school_datetime", "ground_school_person_fk",
        "ground_school_papeleta_fk", "ground_school_escuadrilla_fk",
    ), override_identity=True),
    Table("operations.crew_qualification", (
        "crew_rating_sk", "person_fk", "crew_ratings_fk", "date_qualified", "crew_qualification_escuadrilla_fk",
    ), override_identity=True),
    Table("detall.comision", (
        "comision_sk", "comision_start_date", "comision_end_date",
        "comision_type_fk", "comision_lugar_fk", "comision_escuadrilla_fk", "comision_esfuerzo",
    ), override_identity=True),
    Table("detall.notcrew_qualification", (
        "notcrew_ratings_sk", "person_fk", "notcrew_rating_fk", "date_qualified",
        "notcrew_qualification_escuadrilla_fk",
    ), override_identity=True,
       source_table="detall.notCrew_qualification",
       column_aliases={
           "notcrew_ratings_sk": "notCrew_ratings_sk",
           "notcrew_rating_fk": "notCrew_rating_fk",
           "notcrew_qualification_escuadrilla_fk": "notCrew_qualification_escuadrilla_fk",
       }),
    Table("detall.absence", (
        "absence_sk", "absence_start_date", "absence_end_date", "absence_person_fk",
        "absence_reason_fk", "absence_remark", "absence_escuadrilla_fk",
    ), override_identity=True),
    Table("detall.user_activity", ("user_activity_sk", "user_activity_date", "user_activity_user"), override_identity=True),
    Table("flightsafety.medical_exam", (
        "medical_exam_sk", "medical_exam_date", "medical_exam_person_fk",
        "medical_exam_place_fk", "medical_exam_result_fk", "medical_exam_remark",
    ), override_identity=True),
    Table("flightsafety.dunker",     ("dunker_sk", "dunker_date", "dunker_person_fk", "dunker_result"), override_identity=True),
    Table("flightsafety.hyperbaric", ("hyperbaric_sk", "hyperbaric_date", "hyperbaric_person_fk", "hyperbaric_result"), override_identity=True),
    Table("operations.fuel", (
        "fuel_sk", "fuel_date", "fuel_helo_fk", "fuel_place_fk", "fuel_payer_fk",
        "fuel_event_fk", "fuel_phase_fk", "fuel_type_fk", "fuel_qty",
    ), override_identity=True),
    Table("operations.escuadrilla_capba", (
        "escuadrilla_capba_sk", "escuadrilla_capba_escuadrilla_fk",
        "escuadrilla_capba_capba_fk", "escuadrilla_capba_capacidad_operativa",
    ), override_identity=True),

    # ---- Junction (cuelgan de flight) ----
    Table("operations.person_hour", (
        "person_hour_sk", "person_hour_flight_fk", "person_hour_person_fk",
        "person_hour_period_fk", "person_hour_hour_qty",
    ), override_identity=True),
    Table("operations.ift_hour",       ("ift_hour_sk", "ift_hour_flight_fk", "ift_hour_person_fk", "ift_hour_qty"), override_identity=True),
    Table("operations.instructor_hour",("instructor_hour_sk", "instructor_hour_flight_fk", "instructor_hour_person_fk", "instructor_hour_qty"), override_identity=True),
    Table("operations.gvntype_hour", (
        "gvntype_hour_sk", "gvntype_hour_flight_fk", "gvntype_hour_person_fk",
        "gvntype_hour_iit_qty", "gvntype_hour_anvis_qty",
    ), override_identity=True),
    Table("operations.formation_hour", (
        "formation_hour_sk", "formation_hour_flight_fk", "formation_hour_person_fk",
        "formation_hour_period_fk", "formation_hour_formation_qty",
    ), override_identity=True),
    Table("operations.wt_hour",       ("wt_hour_sk", "wt_hour_flight_fk", "wt_hour_person_fk", "wt_hour_qty"), override_identity=True),
    Table("operations.approach",      ("app_sk", "app_flight_fk", "app_person_fk", "app_type_fk", "app_qty"), override_identity=True),
    Table("operations.landing", (
        "landing_sk", "landing_flight_fk", "landing_person_fk", "landing_place_fk",
        "landing_period_fk", "landing_qty",
    ), override_identity=True),
    Table("operations.projectile",    ("projectile_sk", "projectile_flight_fk", "projectile_person_fk", "projectile_type_fk", "projectile_qty"), override_identity=True),
    Table("operations.papeleta_crew_count", (
        "papeleta_crew_count_sk", "papeleta_crew_count_flight_fk", "papeleta_crew_count_person_fk",
        "papeleta_crew_count_session_fk", "papeleta_crew_count_period_fk",
    ), override_identity=True),
    Table("operations.cupo_hour",     ("cupo_hour_sk", "cupo_flight_fk", "cupo_authority_fk", "cupo_hour_qty"), override_identity=True),
    Table("operations.passenger",     ("passenger_sk", "passenger_flight_fk", "passenger_type_fk", "passenger_qty", "passenger_route"), override_identity=True),
    Table("detall.person_comision",   ("person_comision_sk", "comision_fk", "person_fk"), override_identity=True),
    Table("operations.capba_hour",    ("capba_hour_sk", "capba_flight_fk", "capba_capba_fk", "capba_hour_qty"), override_identity=True),
]

# Tablas que NO se migran (gestionadas por Hito 2 o ephemeral).
SKIP_TABLES = {"detall.session_info"}

# Tablas con SK explícito que requieren reset de secuencia tras la carga.
SEQUENCES_TO_RESET = [
    ("detall.rank",                "rank_sk"),
    ("detall.localidad",           "localidad_sk"),
    ("detall.especialidad",        "especialidad_sk"),
    ("detall.division",            "division_sk"),
    ("detall.person_rol",          "person_rol_sk"),
    ("detall.escuadrilla",         "escuadrilla_sk"),
    ("detall.comision_type",       "comision_type_sk"),
    ("detall.comision_lugar",      "comision_lugar_sk"),
    ("detall.notcrew_rating_type", "notcrew_rating_sk"),
    ("detall.absence_reason",      "absence_reason_sk"),
    ("detall.person",              "person_sk"),
    ("detall.comision",            "comision_sk"),
    ("detall.notcrew_qualification","notcrew_ratings_sk"),
    ("detall.absence",             "absence_sk"),
    ("detall.festivos",            "festivo_sk"),
    ("detall.user_activity",       "user_activity_sk"),
    ("detall.person_comision",     "person_comision_sk"),
    ("operations.event_name",      "event_name_sk"),
    ("operations.papeleta_block",  "papeleta_block_sk"),
    ("operations.papeleta_plan",   "papeleta_plan_sk"),
    ("operations.departure_arrival_place", "departure_arrival_place_sk"),
    ("operations.period",          "period_sk"),
    ("operations.ifr_app_type",    "ifr_app_type_sk"),
    ("operations.landing_place",   "landing_place_sk"),
    ("operations.projectile_type", "projectile_type_sk"),
    ("operations.authority",       "authority_sk"),
    ("operations.passenger_type",  "passenger_type_sk"),
    ("operations.crew_rating_type","crew_rating_sk"),
    ("operations.fuel_place",      "fuel_place_sk"),
    ("operations.fuel_payer",      "fuel_payer_sk"),
    ("operations.fuel_phase",      "fuel_phase_sk"),
    ("operations.fuel_type",       "fuel_type_sk"),
    ("operations.capba_group",     "capba_group_sk"),
    ("operations.aircraft",        "aircraft_sk"),
    ("operations.event",           "event_sk"),
    ("operations.papeleta",        "papeleta_sk"),
    ("operations.flight",          "flight_sk"),
    ("operations.previous_hour",   "previous_hours_sk"),
    ("operations.previous_model_real_hour", "previous_model_real_hours_sk"),
    ("operations.previous_model_sim_hour",  "previous_model_sim_hours_sk"),
    ("operations.ground_school",   "ground_school_sk"),
    ("operations.crew_qualification", "crew_rating_sk"),
    ("operations.fuel",            "fuel_sk"),
    ("operations.escuadrilla_capba","escuadrilla_capba_sk"),
    ("operations.person_hour",     "person_hour_sk"),
    ("operations.ift_hour",        "ift_hour_sk"),
    ("operations.instructor_hour", "instructor_hour_sk"),
    ("operations.gvntype_hour",    "gvntype_hour_sk"),
    ("operations.formation_hour",  "formation_hour_sk"),
    ("operations.wt_hour",         "wt_hour_sk"),
    ("operations.approach",        "app_sk"),
    ("operations.landing",         "landing_sk"),
    ("operations.projectile",      "projectile_sk"),
    ("operations.papeleta_crew_count", "papeleta_crew_count_sk"),
    ("operations.cupo_hour",       "cupo_hour_sk"),
    ("operations.passenger",       "passenger_sk"),
    ("operations.capba_hour",      "capba_hour_sk"),
    ("flightsafety.medical_exam_result", "medical_exam_result_sk"),
    ("flightsafety.medical_exam_place",  "medical_exam_place_sk"),
    ("flightsafety.medical_exam",  "medical_exam_sk"),
    ("flightsafety.dunker",        "dunker_sk"),
    ("flightsafety.hyperbaric",    "hyperbaric_sk"),
]


# ============================================================
# Migración
# ============================================================

def migrate_table(t: Table, src: pyodbc.Connection, dst: psycopg.Connection, batch_size: int = 1000) -> tuple[int, int]:
    src_cols = ", ".join(t.src_column(c) for c in t.columns)
    select_sql = f"SELECT {src_cols} FROM {t.src_name()}"

    with src.cursor() as src_cur:
        src_cur.execute(select_sql)
        rows = src_cur.fetchall()

    src_count = len(rows)
    if src_count == 0:
        log.info("  %s — 0 filas en origen, skip", t.name)
        return 0, 0

    placeholders = ", ".join(["%s"] * len(t.columns))
    insert_sql = (
        f"INSERT INTO {t.name} ({', '.join(t.columns)}) "
        f"{'OVERRIDING SYSTEM VALUE ' if t.override_identity else ''}"
        f"VALUES ({placeholders})"
    )

    with dst.cursor() as dst_cur:
        # Cada tabla en un savepoint por si hay fila inválida puntual.
        for i in range(0, src_count, batch_size):
            batch = [tuple(row) for row in rows[i:i + batch_size]]
            dst_cur.executemany(insert_sql, batch)

    return src_count, src_count


def reset_sequences(dst: psycopg.Connection) -> None:
    log.info("Reseteando secuencias…")
    with dst.cursor() as cur:
        for tbl, sk_col in SEQUENCES_TO_RESET:
            cur.execute(
                "SELECT setval("
                "  pg_get_serial_sequence(%s, %s),"
                f"  COALESCE((SELECT MAX({sk_col}) FROM {tbl}), 1),"
                f"  (SELECT MAX({sk_col}) FROM {tbl}) IS NOT NULL"
                ")",
                (tbl, sk_col),
            )


def truncate_targets(dst: psycopg.Connection) -> None:
    log.info("TRUNCATE destino (CASCADE + RESTART IDENTITY)…")
    targets = ", ".join(t.name for t in TABLES)
    with dst.cursor() as cur:
        cur.execute(f"TRUNCATE {targets} RESTART IDENTITY CASCADE")


def verify_counts(src: pyodbc.Connection, dst: psycopg.Connection) -> list[tuple[str, int, int]]:
    log.info("Comprobando conteos origen/destino…")
    report = []
    for t in TABLES:
        with src.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {t.src_name()}")
            sc = cur.fetchone()[0]
        with dst.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {t.name}")
            dc = cur.fetchone()[0]
        report.append((t.name, sc, dc))
    return report


# ============================================================
# Main
# ============================================================

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mssql-conn", required=True, help="Cadena de conexión pyodbc al SQL Server origen")
    ap.add_argument("--pg-dsn", required=True, help="DSN psycopg al PostgreSQL destino")
    ap.add_argument("--dry-run", action="store_true", help="Sólo comparar conteos, sin migrar")
    ap.add_argument("--no-truncate", action="store_true", help="No vaciar destino antes de migrar")
    args = ap.parse_args()

    log.info("Conectando a origen (SQL Server)…")
    src = pyodbc.connect(args.mssql_conn, autocommit=False)
    log.info("Conectando a destino (PostgreSQL)…")
    dst = psycopg.connect(args.pg_dsn)
    dst.autocommit = False

    try:
        if args.dry_run:
            report = verify_counts(src, dst)
            print_report(report)
            return 0

        if not args.no_truncate:
            truncate_targets(dst)

        total = 0
        for t in TABLES:
            if t.name in SKIP_TABLES:
                continue
            log.info("Migrando %s…", t.name)
            n, _ = migrate_table(t, src, dst)
            total += n
        log.info("Filas insertadas: %d", total)

        reset_sequences(dst)
        dst.commit()

        report = verify_counts(src, dst)
        print_report(report)
        mismatches = [r for r in report if r[1] != r[2]]
        if mismatches:
            log.error("DISCREPANCIAS detectadas: %d", len(mismatches))
            return 2
        log.info("Migración correcta: todos los conteos coinciden.")
        return 0
    except Exception:
        dst.rollback()
        log.exception("Error durante la migración, ROLLBACK aplicado")
        return 1
    finally:
        src.close()
        dst.close()


def print_report(report: list[tuple[str, int, int]]) -> None:
    width = max(len(name) for name, _, _ in report)
    print()
    print(f"{'tabla':{width}}  {'origen':>8}  {'destino':>8}  estado")
    print("-" * (width + 30))
    for name, sc, dc in report:
        flag = "OK" if sc == dc else "MISMATCH"
        print(f"{name:{width}}  {sc:>8}  {dc:>8}  {flag}")


if __name__ == "__main__":
    sys.exit(main())
