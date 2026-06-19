#!/usr/bin/env python3
"""
Migra datos productivos desde SQLite (Aether-Tauri, Aether.db) a
PostgreSQL (Aether-Web).

Asume que el destino ya tiene aplicadas las migraciones:
  - 0001_init_schema (estructura)
  - 0002_seed_lookups (lookups + escuadrillas + papeletas histo)
  - 0003_auth_tables
  - 0004_triggers

NO aplicar todavía 0005_seed_productive_data — ese va DESPUÉS de este
script porque referencia a personas cargadas aquí.

Requisitos:
    pip install 'psycopg[binary]'

Uso típico (desde la raíz del proyecto aether-web):
    python database-utils/migrationSQLiteToPostgres.py \\
        --pg-dsn "postgresql://jon:1234@127.0.0.1:5432/aether?sslmode=disable"

Por defecto busca el SQLite en `database-utils/Aether.db` (relativo a
este script). Puedes sobreescribirlo con `--sqlite /otra/ruta/Aether.db`.
"""
from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
from datetime import datetime, time as dt_time, timezone
from pathlib import Path

import psycopg

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent / "Aether.db"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("migrate")


# ============================================================================
# Helpers de conversión
# ============================================================================

def unix_to_date(unix_time, default_date="1900-01-01"):
    if unix_time is None or unix_time == "" or unix_time == 0:
        return datetime.strptime(default_date, "%Y-%m-%d").date()
    try:
        if isinstance(unix_time, str):
            unix_time = int(unix_time)
        return datetime.fromtimestamp(unix_time, tz=timezone.utc).date()
    except (ValueError, TypeError):
        return datetime.strptime(default_date, "%Y-%m-%d").date()


def unix_to_time(unix_time, default=None):
    """Extrae la hora-del-día (UTC) embebida en el timestamp Unix.

    SQLite guarda fecha y hora juntas en `flight_datetime`; la fecha va a
    `flight_date` (DATE) y la hora a `flight_departure_time` (TIME). Se
    almacena en UTC, coherente con la fecha (`unix_to_date` también usa UTC)
    y con el front, que toma `hora`, le añade 'Z' y la convierte a Madrid.
    """
    if default is None:
        default = DEFAULT_TIME
    if unix_time is None or unix_time == "" or unix_time == 0:
        return default
    try:
        if isinstance(unix_time, str):
            unix_time = int(unix_time)
        return datetime.fromtimestamp(unix_time, tz=timezone.utc).time()
    except (ValueError, TypeError):
        return default


def string_to_date(date_string, default_date="1900-01-01"):
    if date_string is None or date_string == "":
        return datetime.strptime(default_date, "%Y-%m-%d").date()
    try:
        return datetime.strptime(date_string, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return datetime.strptime(default_date, "%Y-%m-%d").date()


def map_person_rank(rank):
    valid_ranks = ["CF", "TCOL", "CC", "CTE", "TN", "CAP", "TTE", "AN",
                   "SBMY", "STTE", "BG", "SGT1", "SGTO", "CBMY", "CB1",
                   "CBO", "SDO", "MRO"]
    if rank == "SG1":
        return "SGT1"
    if rank in valid_ranks:
        return rank
    return "MRO"


def map_person_role(role):
    valid_roles = ["Piloto", "Dotación/Nadador", "Dotación", "Nadador", "No Tripulante"]
    if role in valid_roles:
        return role
    return "No Tripulante"


VALID_EVENT_NAMES = [
    "Adaptación", "Adiestramiento", "Arranque", "Colaboración",
    "Maniobra internacional", "Maniobra nacional", "Misión", "Pruebas", "Simulador",
]


def map_event_name(event_name):
    if event_name is None:
        return "Adiestramiento"
    normalized = event_name.strip()
    name_mapping = {"Adaptacion": "Adaptación", "Colaboracion": "Colaboración", "Mision": "Misión"}
    if normalized in VALID_EVENT_NAMES:
        return normalized
    if normalized in name_mapping:
        return name_mapping[normalized]
    for valid_name in VALID_EVENT_NAMES:
        if normalized.lower() == valid_name.lower():
            return valid_name
    return "Adiestramiento"


ESPECIALIDAD_MAPPING = {
    "AVP": "AVP - Piloto Naval", "PIL": "AVP - Piloto Naval",
    "OSM": "OSM - Operaciones y sistemas", "OSS": "OSM - Operaciones y sistemas",
    "ADS": "ADS - Administración", "ADM": "ADS - Administración",
    "ARS": "ARS - Armas", "ASM": "ARS - Armas",
    "EPS": "EPS - Energía y Propulsión", "EPM": "EPM - Energía y Propulsión",
    "ELS": "ELES - Electricidad", "ELM": "ELES - Electricidad", "ERM": "ELES - Electricidad",
    "MQS": "MQES - Mecánica", "MQM": "MQES - Mecánica",
    "STS": "STES - Sistemas Tácticos",
    "IMT": "IM - Infantería de Marina", "IMS": "IM - Infantería de Marina",
    "MNM": "MNM - Maniobra y Navegación",
}


def map_person_especialidad(row):
    value = row.get("person_especialidad")
    if value and value.strip():
        mapped = ESPECIALIDAD_MAPPING.get(value.strip())
        if mapped:
            return mapped
    return "Sistemas"


DIVISION_MAPPING = {
    "Jefe Escuadrilla": "Jefe",
    "Segundo": "Segundo",
    "Jefatura/Detall": "Detall",
    "Jefe Operaciones": "Jefe de Operaciones",
    "Jefe De Mtto": "Jefe de Mantenimiento",
    "Of Seguridad De Vuelo": "Seguridad de Vuelo",
    "Jefe Seguridad De Vuelo": "Jefe de Seguridad de Vuelo",
    "Oficina De Ops": "Operaciones",
    "Oficina de Ops": "Operaciones",
    "Oficina De Mtto": "Control de Mantenimiento – Mantenimiento",
    "Oficina de Mtto": "Control de Mantenimiento – Mantenimiento",
    "Oficina Técnica": "Control de Calidad – Mantenimiento",
    "Línea De Vuelo": "Línea de Vuelo – Mantenimiento",
    "Línea de Vuelo": "Línea de Vuelo – Mantenimiento",
    "Línea De Vuelo/Armas": "Línea de Vuelo – Mantenimiento",
    "Línea de Vuelo/Armas": "Línea de Vuelo – Mantenimiento",
    "Linea de Vuelo": "Línea de Vuelo – Mantenimiento",
    "Aeronaves": "Aeronaves B1 – Mantenimiento",
    "Aeronaves/Electricidad": "Electroaviónica B2 – Mantenimiento",
    "Avionica": "Electroaviónica B2 – Mantenimiento",
    "Control De Material": "Control de Mantenimiento – Mantenimiento",
    "Producción": "Línea de Vuelo – Mantenimiento",
    "Secretario": "Detall",
    "Seguridad": "Seguridad de Vuelo",
    "Tbd": "Operaciones",
}


def map_person_division(row):
    value = row.get("person_division")
    if value and value.strip():
        mapped = DIVISION_MAPPING.get(value.strip())
        if mapped:
            return mapped
    return "Operaciones"


PAPELETA_BLOCK_MAPPING = {"Vuelo": "Vuelo", "Simulador": "Simulador", "Tierra Piloto": "Teórico Piloto"}


def map_papeleta_block(block):
    if block and block.strip():
        mapped = PAPELETA_BLOCK_MAPPING.get(block.strip())
        if mapped:
            return mapped
    return "Vuelo"


PAPELETA_PLAN_MAPPING = {
    "Básico": "Adiestramiento Básico",
    "Avanzado": "Adiestramiento Avanzado",
    "Instrucción": "Instrucción 1 Piloto",
}


def map_papeleta_plan(plan):
    if plan is None or (isinstance(plan, str) and not plan.strip()):
        return None
    return PAPELETA_PLAN_MAPPING.get(plan.strip())


# Papeletas cuyo prefijo G/N ya codifica el periodo pero sin el guion de la
# norma. Los falsos positivos (GND TPT = Ground Transport, NAV-204 = Navegación)
# quedan deliberadamente fuera del allowlist.
PAPELETA_GVN_PREFIXED = {
    "GFAM-202", "GBUQ-210", "GBUQ-211", "GTAC-203", "GNAV-204", "GSAR-207",
}
PAPELETA_NOCTURNO_PREFIXED = {"NFAM-105", "NBUQ-209"}


def map_papeleta_name(name):
    """Aplica la norma de prefijos de periodo: GVN→'G-', Nocturno conv.→'N-'."""
    if name is None:
        return name
    n = name.strip()
    # Marcador GVN como sufijo entre paréntesis → prefijo G-
    if n.endswith("(G)"):
        return f"G-{n[:-3].strip()}"
    # Prefijo G/N ya existente (sin guion) → normalizar a la norma
    if n in PAPELETA_GVN_PREFIXED:
        return f"G-{n[1:]}"
    if n in PAPELETA_NOCTURNO_PREFIXED:
        return f"N-{n[1:]}"
    return n


DEFAULT_USERS_FILE = Path(__file__).resolve().parent / "person_users.json"


def _load_person_user_mapping(path: Path = DEFAULT_USERS_FILE) -> dict[int, str]:
    """Carga el mapeo person_sk → user desde JSON externo.

    El archivo es sensible (asocia identidades a SKs reales), por eso
    NO está en el repo público. Si no existe, todos los usuarios reciben
    un nombre sintético `user_<sk>` y solo podrás hacer login con uno
    de ellos tras adivinar el SK.
    """
    if not path.is_file():
        log.warning(
            "No se encontró %s — los usuarios quedarán como 'user_<sk>'. "
            "Copia person_users.example.json o consigue el real del repo privado.",
            path,
        )
        return {}
    import json
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {int(sk): user for sk, user in raw.items()}


PERSON_USER_MAPPING = _load_person_user_mapping()


def get_person_user(row):
    person_sk = row.get("person_sk")
    return PERSON_USER_MAPPING.get(person_sk, f"user_{person_sk}")


def get_person_localidad(row):
    return "Rota"


# ============================================================================
# Configuración de tablas (SQLite → PostgreSQL)
# ============================================================================

DEFAULT_DEPARTURE_ARRIVAL_PLACE_SK = 1
DEFAULT_TIME = dt_time(0, 0, 0)


def _to_bool(value):
    return bool(value) if value is not None else False


def _to_float(value, default=0.0):
    return float(value) if value not in (None, "") else default


def _to_int(value, default=0):
    return int(value) if value not in (None, "") else default


TABLE_MAPPINGS = {
    "dim_person": {
        "target": "detall.person",
        "columns": {
            "person_sk": "person_sk",
            "person_nk": "person_nk",
            "person_rank": "person_rank",
            "person_cuerpo": "person_cuerpo",
            "person_name": "person_name",
            "person_last_name_1": "person_last_name_1",
            "person_last_name_2": "person_last_name_2",
            "person_phone": "person_phone",
            "person_dni": "person_dni",
            "person_rol": "person_rol",
            "person_a_emp": "person_a_emp",
            "person_f_emb": "person_f_emb",
            "person_birthdate": "person_birthdate",
            "person_num_escalafon": "person_num_escalafon",
            "person_current_flag": "person_current_flag",
        },
        "transforms": {
            "person_current_flag": _to_bool,
            "person_a_emp": string_to_date,
            "person_f_emb": string_to_date,
            "person_birthdate": string_to_date,
            "person_num_escalafon": lambda x: 0 if x in (None, "", " ") else int(x),
            "person_rank": map_person_rank,
            "person_rol": map_person_role,
        },
        "defaults": {
            "person_especialidad": map_person_especialidad,
            "person_user": get_person_user,
            "person_division": map_person_division,
            "person_localidad": get_person_localidad,
            "person_permission_level": "Común",
            "person_escuadrilla_fk": 14,
        },
        "identity_insert": True,
    },

    "dim_helo": {
        "target": "operations.aircraft",
        "columns": {
            "helo_sk": "aircraft_sk",
            "helo_plate_nk": "aircraft_registration",
            "helo_number": "aircraft_number",
            "helo_current_flag": "aircraft_current_flag",
        },
        "transforms": {"helo_current_flag": _to_bool},
        # aircraft_model_fk lo rellena main() vía ensure_aircraft_model(): todas
        # las aeronaves del SQLite son del único modelo NH90 TTH, que vive ahora
        # en el catálogo global operations.aircraft_model.
        "defaults": {
            "aircraft_model_fk": None,
            "aircraft_escuadrilla_fk": 14,
        },
        "identity_insert": True,
    },

    "dim_event": {
        "target": "operations.event",
        "columns": {"event_sk": "event_sk", "event_name": "event_name", "event_place": "event_place"},
        "transforms": {"event_name": map_event_name},
        "identity_insert": True,
    },

    "dim_period": {
        "target": "operations.period",
        "columns": {"period_sk": "period_sk", "period_name": "period_name"},
        "identity_insert": True,
        # 0002 ya inserta periods con los mismos SKs; mantenemos los suyos.
        "on_conflict": "(period_sk) DO NOTHING",
    },

    "dim_ifr_app_type": {
        "target": "operations.ifr_app_type",
        "columns": {
            "ifr_app_type_sk": "ifr_app_type_sk",
            "ifr_app_type_name": "ifr_app_type_name",
            "ifr_app_type_type": "ifr_app_type_type",
        },
        "identity_insert": True,
    },

    "dim_landing_place": {
        "target": "operations.landing_place",
        "columns": {"landing_place_sk": "landing_place_sk", "landing_place_name": "landing_place_name"},
        "identity_insert": True,
    },

    "dim_projectile_type": {
        "target": "operations.projectile_type",
        "columns": {
            "projectile_type_sk": "projectile_type_sk",
            "projectile_type_name": "projectile_type_name",
            "projectile_type_weapon": "projectile_type_weapon",
        },
        "identity_insert": True,
    },

    "dim_authority": {
        "target": "operations.authority",
        "columns": {
            "authority_sk": "authority_sk",
            "authority_name": "authority_name",
            "authority_abrv": "authority_abrv",
        },
        "identity_insert": True,
    },

    "dim_passenger_type": {
        "target": "operations.passenger_type",
        "columns": {"passenger_type_sk": "passenger_type_sk", "passenger_type_name": "passenger_type_name"},
        "identity_insert": True,
    },

    "dim_papeleta": {
        "target": "operations.papeleta",
        "columns": {
            "papeleta_sk": "papeleta_sk",
            "papeleta_name": "papeleta_name",
            "papeleta_description": "papeleta_description",
            "papeleta_block": "papeleta_block",
            "papeleta_plan": "papeleta_plan",
            "papeleta_tv": "papeleta_tv",
            "papeleta_crp_value": "papeleta_pilot_crp_value",
            "papeleta_expiration": "papeleta_expiration",
        },
        "transforms": {
            "papeleta_name": map_papeleta_name,
            "papeleta_block": map_papeleta_block,
            "papeleta_plan": map_papeleta_plan,
            "papeleta_tv": lambda x: float(x) if x else None,
            "papeleta_pilot_crp_value": lambda x: int(x) if x else None,
            "papeleta_expiration": lambda x: int(x) if x else None,
        },
        "defaults": {
            "papeleta_escuadrilla_fk": 14,
            # Orden de visualización dentro de cada plan (páginas de training).
            # Reutilizamos papeleta_sk: es el orden de aparición de la fuente y,
            # como el orden se aplica por plan, basta con que sea monótono ahí.
            # Las papeletas que también están en 0004 verán su orden sobrescrito
            # por el seed (ON CONFLICT DO UPDATE).
            "papeleta_order": lambda row: row["papeleta_sk"],
        },
        "identity_insert": True,
    },

    "fact_flight": {
        "target": "operations.flight",
        "columns": {
            "flight_sk": "flight_sk",
            "flight_datetime": "flight_date",
            "flight_helo_fk": "flight_aircraft_fk",
            "flight_event_fk": "flight_event_fk",
            "flight_person_cta_fk": "flight_person_cta_fk",
            "flight_total_hours": "flight_total_hours",
        },
        "transforms": {
            "flight_datetime": unix_to_date,
            "flight_total_hours": lambda x: max(float(x), 0.1) if x else 0.1,
        },
        "defaults": {
            "flight_departure_place": DEFAULT_DEPARTURE_ARRIVAL_PLACE_SK,
            # Recupera la hora real embebida en flight_datetime (UTC).
            "flight_departure_time": lambda row: unix_to_time(row.get("flight_datetime")),
            "flight_arrival_place": DEFAULT_DEPARTURE_ARRIVAL_PLACE_SK,
            "flight_arrival_time": DEFAULT_TIME,  # SQLite no guarda hora de llegada → 00:00
            "flight_escuadrilla_fk": 14,
        },
        "identity_insert": True,
    },

    "fact_previous_hour": {
        "target": "operations.extra_hour",
        "columns": {
            "previous_hours_sk": "extra_hours_sk",
            "previous_hours_person_fk": "extra_hours_person_fk",
            "previous_hours_cta": "extra_hours_cta",
            "previous_hours_day": "extra_hours_day",
            "previous_hours_conv_night": "extra_hours_conv_night",
            "previous_hours_gvn": "extra_hours_gvn",
            "previous_hours_inst": "extra_hours_inst",
        },
        "transforms": {
            "previous_hours_cta": _to_float,
            "previous_hours_day": _to_float,
            "previous_hours_conv_night": _to_float,
            "previous_hours_gvn": _to_float,
            "previous_hours_inst": _to_float,
        },
        "identity_insert": True,
    },

    "fact_previous_model_hour": {
        # Las horas de modelo del SQLite legado son siempre REALES → is_real=True.
        "target": "operations.extra_model_hour",
        "columns": {
            "previous_model_hours_sk": "extra_model_hours_sk",
            "previous_model_hours_person_fk": "extra_model_hours_person_fk",
            "previous_model_hours_cta": "extra_model_hours_cta",
            "previous_model_hours_day": "extra_model_hours_day",
            "previous_model_hours_conv_night": "extra_model_hours_conv_night",
            "previous_model_hours_gvn": "extra_model_hours_gvn",
            "previous_model_hours_inst": "extra_model_hours_inst",
        },
        "transforms": {
            "previous_model_hours_cta": _to_float,
            "previous_model_hours_day": _to_float,
            "previous_model_hours_conv_night": _to_float,
            "previous_model_hours_gvn": _to_float,
            "previous_model_hours_inst": _to_float,
        },
        "defaults": {
            "extra_model_hours_date": datetime.strptime("1900-01-01", "%Y-%m-%d").date(),
            "extra_model_hours_is_real": True,
        },
        "identity_insert": True,
    },

    "fact_ground_school": {
        "target": "operations.ground_school",
        "columns": {
            "ground_school_sk": "ground_school_sk",
            "ground_school_datetime": "ground_school_datetime",
            "ground_school_person_fk": "ground_school_person_fk",
            "ground_school_papeleta_fk": "ground_school_papeleta_fk",
        },
        "transforms": {"ground_school_datetime": unix_to_date},
        "defaults": {"ground_school_escuadrilla_fk": 14},
        "identity_insert": True,
    },

    "junction_person_hour": {
        "target": "operations.person_hour",
        "columns": {
            "person_hour_sk": "person_hour_sk",
            "person_hour_flight_fk": "person_hour_flight_fk",
            "person_hour_person_fk": "person_hour_person_fk",
            "person_hour_period_fk": "person_hour_period_fk",
            "person_hour_hour_qty": "person_hour_hour_qty",
        },
        "transforms": {"person_hour_hour_qty": _to_float},
        "identity_insert": True,
    },

    "junction_ift_hour": {
        "target": "operations.ift_hour",
        "columns": {
            "ift_hour_sk": "ift_hour_sk",
            "ift_hour_flight_fk": "ift_hour_flight_fk",
            "ift_hour_person_fk": "ift_hour_person_fk",
            "ift_hour_qty": "ift_hour_qty",
        },
        "transforms": {"ift_hour_qty": _to_float},
        "identity_insert": True,
    },

    "junction_instructor_hour": {
        "target": "operations.instructor_hour",
        "columns": {
            "instructor_hour_sk": "instructor_hour_sk",
            "instructor_hour_flight_fk": "instructor_hour_flight_fk",
            "instructor_hour_person_fk": "instructor_hour_person_fk",
            "instructor_hour_qty": "instructor_hour_qty",
        },
        "transforms": {"instructor_hour_qty": _to_float},
        "identity_insert": True,
    },

    "junction_hdms_hour": {
        "target": "operations.gvntype_hour",
        "columns": {
            "hdms_hour_sk": "gvntype_hour_sk",
            "hdms_hour_flight_fk": "gvntype_hour_flight_fk",
            "hdms_hour_person_fk": "gvntype_hour_person_fk",
            "hdms_hour_iit_qty": "gvntype_hour_iit_qty",
            "hdms_hour_anvis_qty": "gvntype_hour_anvis_qty",
        },
        "transforms": {"hdms_hour_iit_qty": _to_float, "hdms_hour_anvis_qty": _to_float},
        "identity_insert": True,
    },

    "junction_formation_hour": {
        "target": "operations.formation_hour",
        "columns": {
            "formation_hour_sk": "formation_hour_sk",
            "formation_hour_flight_fk": "formation_hour_flight_fk",
            "formation_hour_person_fk": "formation_hour_person_fk",
            "formation_hour_period_fk": "formation_hour_period_fk",
            "formation_hour_formation_qty": "formation_hour_formation_qty",
        },
        "transforms": {"formation_hour_formation_qty": _to_float},
        "identity_insert": True,
    },

    "junction_wt_hour": {
        "target": "operations.wt_hour",
        "columns": {
            "wt_hour_sk": "wt_hour_sk",
            "wt_hour_flight_fk": "wt_hour_flight_fk",
            "wt_hour_person_fk": "wt_hour_person_fk",
            "wt_hour_qty": "wt_hour_qty",
        },
        "transforms": {"wt_hour_qty": _to_float},
        "identity_insert": True,
    },

    "junction_app": {
        "target": "operations.approach",
        "columns": {
            "app_sk": "app_sk",
            "app_flight_fk": "app_flight_fk",
            "app_person_fk": "app_person_fk",
            "app_type_fk": "app_type_fk",
            "app_qty": "app_qty",
        },
        "transforms": {"app_qty": _to_int},
        "identity_insert": True,
    },

    "junction_landing": {
        "target": "operations.landing",
        "columns": {
            "landing_sk": "landing_sk",
            "landing_flight_fk": "landing_flight_fk",
            "landing_person_fk": "landing_person_fk",
            "landing_place_fk": "landing_place_fk",
            "landing_period_fk": "landing_period_fk",
            "landing_qty": "landing_qty",
        },
        "transforms": {"landing_qty": _to_int},
        "identity_insert": True,
    },

    "junction_projectile": {
        "target": "operations.projectile",
        "columns": {
            "projectile_sk": "projectile_sk",
            "projectile_flight_fk": "projectile_flight_fk",
            "projectile_person_fk": "projectile_person_fk",
            "projectile_type_fk": "projectile_type_fk",
            "projectile_qty": "projectile_qty",
        },
        "transforms": {"projectile_qty": _to_int},
        "identity_insert": True,
    },

    "junction_papeleta_crew_count": {
        "target": "operations.papeleta_crew_count",
        "columns": {
            "papeleta_crew_count_sk": "papeleta_crew_count_sk",
            "papeleta_crew_count_flight_fk": "papeleta_crew_count_flight_fk",
            "papeleta_crew_count_person_fk": "papeleta_crew_count_person_fk",
            "papeleta_crew_count_session_fk": "papeleta_crew_count_session_fk",
        },
        "defaults": {"papeleta_crew_count_period_fk": 1},
        "identity_insert": True,
    },

    "junction_cupo_hour": {
        "target": "operations.cupo_hour",
        "columns": {
            "cupo_hour_sk": "cupo_hour_sk",
            "cupo_flight_fk": "cupo_flight_fk",
            "cupo_authority_fk": "cupo_authority_fk",
            "cupo_hour_qty": "cupo_hour_qty",
        },
        "transforms": {"cupo_hour_qty": _to_float},
        "identity_insert": True,
    },

    "junction_passenger": {
        "target": "operations.passenger",
        "columns": {
            "passenger_sk": "passenger_sk",
            "passenger_flight_fk": "passenger_flight_fk",
            "passenger_type_fk": "passenger_type_fk",
            "passenger_qty": "passenger_qty",
            "passenger_route": "passenger_route",
        },
        "transforms": {"passenger_qty": _to_int},
        "identity_insert": True,
    },
}

# Orden FK-aware (lookups → masters → facts → junctions)
MIGRATION_ORDER = [
    "dim_person", "dim_helo", "dim_event", "dim_period",
    "dim_ifr_app_type", "dim_landing_place", "dim_projectile_type",
    "dim_authority", "dim_passenger_type", "dim_papeleta",
    "fact_flight", "fact_previous_hour", "fact_previous_model_hour", "fact_ground_school",
    "junction_person_hour", "junction_ift_hour", "junction_instructor_hour",
    "junction_hdms_hour", "junction_formation_hour", "junction_wt_hour",
    "junction_app", "junction_landing", "junction_projectile",
    "junction_papeleta_crew_count", "junction_cupo_hour", "junction_passenger",
]

# Secuencias a resetear tras carga (porque hicimos OVERRIDING SYSTEM VALUE)
SEQUENCES_TO_RESET = [
    ("detall.person", "person_sk"),
    ("operations.aircraft", "aircraft_sk"),
    ("operations.event", "event_sk"),
    ("operations.period", "period_sk"),
    ("operations.ifr_app_type", "ifr_app_type_sk"),
    ("operations.landing_place", "landing_place_sk"),
    ("operations.projectile_type", "projectile_type_sk"),
    ("operations.authority", "authority_sk"),
    ("operations.passenger_type", "passenger_type_sk"),
    ("operations.papeleta", "papeleta_sk"),
    ("operations.flight", "flight_sk"),
    ("operations.extra_hour", "extra_hours_sk"),
    ("operations.extra_model_hour", "extra_model_hours_sk"),
    ("operations.ground_school", "ground_school_sk"),
    ("operations.person_hour", "person_hour_sk"),
    ("operations.ift_hour", "ift_hour_sk"),
    ("operations.instructor_hour", "instructor_hour_sk"),
    ("operations.gvntype_hour", "gvntype_hour_sk"),
    ("operations.formation_hour", "formation_hour_sk"),
    ("operations.wt_hour", "wt_hour_sk"),
    ("operations.approach", "app_sk"),
    ("operations.landing", "landing_sk"),
    ("operations.projectile", "projectile_sk"),
    ("operations.papeleta_crew_count", "papeleta_crew_count_sk"),
    ("operations.cupo_hour", "cupo_hour_sk"),
    ("operations.passenger", "passenger_sk"),
]


# ============================================================================
# Migración por tabla
# ============================================================================

def migrate_table(sqlite_conn: sqlite3.Connection, pg_conn: psycopg.Connection,
                  source_table: str, mapping: dict) -> int:
    target = mapping["target"]

    with pg_conn.cursor() as cur:
        if mapping.get("skip_if_exists", False):
            cur.execute(f"SELECT COUNT(*) FROM {target}")
            existing = cur.fetchone()[0]
            if existing > 0:
                log.info("  %s ya tiene %d filas, saltando %s", target, existing, source_table)
                return 0

    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute(f"SELECT * FROM {source_table}")
    rows = sqlite_cur.fetchall()
    if not rows:
        log.info("  %s vacío en origen, skip", source_table)
        return 0

    column_names = [desc[0] for desc in sqlite_cur.description]

    target_columns: list[str] = []
    pg_rows: list[tuple] = []
    for row in rows:
        row_dict = dict(zip(column_names, row))
        pg_row: list = []

        for sqlite_col, pg_col in mapping["columns"].items():
            if sqlite_col in row_dict:
                value = row_dict[sqlite_col]
                if "transforms" in mapping and sqlite_col in mapping["transforms"]:
                    value = mapping["transforms"][sqlite_col](value)
                pg_row.append(value)
                if not pg_rows:
                    target_columns.append(pg_col)

        if "defaults" in mapping:
            for col, default in mapping["defaults"].items():
                pg_row.append(default(row_dict) if callable(default) else default)
                if not pg_rows:
                    target_columns.append(col)

        pg_rows.append(tuple(pg_row))

    placeholders = ", ".join(["%s"] * len(target_columns))
    cols_str = ", ".join(target_columns)
    override = "OVERRIDING SYSTEM VALUE " if mapping.get("identity_insert", False) else ""
    on_conflict = mapping.get("on_conflict")
    on_conflict_sql = f" ON CONFLICT {on_conflict}" if on_conflict else ""
    insert_sql = f"INSERT INTO {target} ({cols_str}) {override}VALUES ({placeholders}){on_conflict_sql}"

    with pg_conn.cursor() as cur:
        for i in range(0, len(pg_rows), 1000):
            cur.executemany(insert_sql, pg_rows[i:i + 1000])

    log.info("  %s → %s: %d filas", source_table, target, len(pg_rows))
    return len(pg_rows)


def ensure_aircraft_model(pg_conn: psycopg.Connection) -> int:
    """Inserta (idempotente) el modelo NH90 TTH en el catálogo global y devuelve
    su sk. Todas las aeronaves migradas del SQLite son de este único modelo, así
    que dim_helo las enlaza todas a él vía aircraft_model_fk."""
    model = ("Helicóptero", "Airbus Helicopters", "NH90", "TTH")
    with pg_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO operations.aircraft_model "
            "(aircraft_type, aircraft_make, aircraft_model, aircraft_variant, "
            " aircraft_is_multi_engine, aircraft_is_multi_pilot) "
            "VALUES (%s, %s, %s, %s, TRUE, TRUE) "
            "ON CONFLICT (aircraft_type, aircraft_make, aircraft_model, aircraft_variant) "
            "DO NOTHING",
            model,
        )
        cur.execute(
            "SELECT aircraft_model_sk FROM operations.aircraft_model "
            "WHERE aircraft_type = %s AND aircraft_make = %s "
            "  AND aircraft_model = %s AND aircraft_variant = %s",
            model,
        )
        return cur.fetchone()[0]


def truncate_targets(pg_conn: psycopg.Connection) -> None:
    """Vacía todas las tablas destino antes de cargar.

    Usa CASCADE para arrastrar cualquier fila dependiente
    (por ejemplo, crew_qualification que referencia detall.person).
    """
    targets = [TABLE_MAPPINGS[name]["target"] for name in MIGRATION_ORDER
               if name in TABLE_MAPPINGS]
    targets_sql = ", ".join(targets)
    log.info("TRUNCATE de tablas destino (RESTART IDENTITY CASCADE)…")
    with pg_conn.cursor() as cur:
        cur.execute(f"TRUNCATE {targets_sql} RESTART IDENTITY CASCADE")


def reset_sequences(pg_conn: psycopg.Connection) -> None:
    log.info("Reseteando secuencias…")
    with pg_conn.cursor() as cur:
        for tbl, sk_col in SEQUENCES_TO_RESET:
            cur.execute(
                "SELECT setval("
                "  pg_get_serial_sequence(%s, %s),"
                f"  COALESCE((SELECT MAX({sk_col}) FROM {tbl}), 1),"
                f"  (SELECT MAX({sk_col}) FROM {tbl}) IS NOT NULL"
                ")",
                (tbl, sk_col),
            )


def print_summary(sqlite_conn: sqlite3.Connection) -> int:
    cur = sqlite_conn.cursor()
    total = 0
    print()
    print(f"{'SQLite table':<35} {'PostgreSQL table':<40} {'rows':>6}")
    print("-" * 85)
    for name in MIGRATION_ORDER:
        if name not in TABLE_MAPPINGS:
            continue
        target = TABLE_MAPPINGS[name]["target"]
        try:
            cur.execute(f"SELECT COUNT(*) FROM {name}")
            n = cur.fetchone()[0]
        except Exception:
            n = 0
        total += n
        print(f"  {name:<33} {target:<40} {n:>6}")
    print("-" * 85)
    print(f"  {'TOTAL':<33} {'':<40} {total:>6}")
    print()
    return total


def validate(sqlite_conn: sqlite3.Connection, pg_conn: psycopg.Connection) -> bool:
    sqlite_cur = sqlite_conn.cursor()
    print()
    print(f"{'Table':<40} {'SQLite':>8} {'Postgres':>10}  {'Status':<10}")
    print("-" * 75)
    ok = True
    for name in MIGRATION_ORDER:
        if name not in TABLE_MAPPINGS:
            continue
        target = TABLE_MAPPINGS[name]["target"]
        try:
            sqlite_cur.execute(f"SELECT COUNT(*) FROM {name}")
            src = sqlite_cur.fetchone()[0]
        except Exception:
            src = 0
        with pg_conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {target}")
            dst = cur.fetchone()[0]
        if src == dst:
            status = "OK"
        elif TABLE_MAPPINGS[name].get("skip_if_exists") and dst > 0:
            status = "SKIPPED"
        elif TABLE_MAPPINGS[name].get("on_conflict") and dst >= src:
            # Upsert: destino tiene mínimo lo de origen (algunas pueden venir de seeds).
            status = "UPSERT"
        elif src == 0:
            status = "EMPTY"
        else:
            status = "MISMATCH"
            ok = False
        print(f"  {target:<38} {src:>8} {dst:>10}  {status:<10}")
    print()
    return ok


# ============================================================================
# Main
# ============================================================================

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sqlite", default=str(DEFAULT_SQLITE_PATH),
                    help=f"Ruta al archivo SQLite (default: {DEFAULT_SQLITE_PATH})")
    ap.add_argument("--pg-dsn", required=True, help="DSN psycopg al PostgreSQL destino")
    ap.add_argument("--dry-run", action="store_true", help="Solo mostrar resumen, sin escribir")
    ap.add_argument("--truncate", action="store_true",
                    help="TRUNCATE las tablas destino antes de cargar (re-importación limpia).")
    args = ap.parse_args()

    if not Path(args.sqlite).is_file():
        log.error("No existe el archivo SQLite: %s", args.sqlite)
        return 1

    log.info("Conectando a SQLite: %s", args.sqlite)
    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = sqlite3.Row

    if args.dry_run:
        print_summary(sqlite_conn)
        sqlite_conn.close()
        log.info("Dry-run: no se ha tocado nada.")
        return 0

    log.info("Conectando a PostgreSQL…")
    pg_conn = psycopg.connect(args.pg_dsn)
    pg_conn.autocommit = False

    try:
        print_summary(sqlite_conn)

        if args.truncate:
            truncate_targets(pg_conn)

        # El catálogo global de modelos no está en MIGRATION_ORDER (no viene del
        # SQLite): lo sembramos aquí y enlazamos dim_helo a su sk.
        TABLE_MAPPINGS["dim_helo"]["defaults"]["aircraft_model_fk"] = ensure_aircraft_model(pg_conn)

        for name in MIGRATION_ORDER:
            if name not in TABLE_MAPPINGS:
                continue
            log.info("Migrando %s…", name)
            migrate_table(sqlite_conn, pg_conn, name, TABLE_MAPPINGS[name])

        reset_sequences(pg_conn)
        pg_conn.commit()

        ok = validate(sqlite_conn, pg_conn)
        if not ok:
            log.error("Validación: hay tablas con conteos distintos. Revísalo.")
            return 2
        log.info("Migración completada correctamente.")
        return 0
    except Exception:
        pg_conn.rollback()
        log.exception("Error durante la migración. ROLLBACK aplicado.")
        return 1
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    sys.exit(main())
