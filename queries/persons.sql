-- ============================================================
-- Persons (Hito 4, lote 3)
--
-- Reimplementa sp_get_persons + add/update/dardebaja/dardealta_person
-- + get_crew_members_by_sk.
--
-- Fix RLS: add_person ahora setea person_escuadrilla_fk explícitamente
-- desde la sesión (en SQL Server usaba SESSION_CONTEXT).
-- update_person filtra por escuadrilla para impedir editar de otra.
-- Fix typo: 'Comun' → 'Común' (constraint CHK requiere acento).
-- ============================================================

-- name: ListPersons :many
-- Aliases Spanish para mantener el contrato del frontend
-- (src/features/personnel/utils/transformPersonnelFromDB.ts).
SELECT
    person_sk                         AS id,
    person_nk                         AS nk,
    person_user                       AS usuario,
    person_rank                       AS empleo,
    person_cuerpo                     AS cuerpo,
    person_especialidad               AS especialidad,
    person_name                       AS nombre,
    person_last_name_1                AS apellido1,
    person_last_name_2                AS apellido2,
    BTRIM(person_rank || ' ' || person_last_name_1 || ' ' || person_last_name_2)::text AS nombre_completo,
    person_phone                      AS telefono,
    person_dni                        AS dni,
    person_division                   AS division,
    person_rol                        AS rol,
    person_a_emp                      AS antiguedad_empleo,
    person_f_emb                      AS fecha_embarco,
    person_birthdate                  AS fecha_nacimiento,
    person_num_escalafon              AS numero_escalafon,
    person_current_flag               AS activo,
    order_position                    AS orden_posicion
FROM detall.v_person_ordered
WHERE person_escuadrilla_fk = $1
ORDER BY order_position;

-- name: CountPersons :one
SELECT COUNT(*)::int FROM detall.v_person_ordered WHERE person_escuadrilla_fk = $1;

-- name: InsertPerson :one
-- Defaults: current_flag=TRUE, permission_level='Común' (¡con acento!).
-- Bug fix vs Rust: el INSERT original omitía person_localidad (NOT NULL),
-- por lo que cualquier add_person fallaba si la BD seguía el esquema.
INSERT INTO detall.person (
    person_nk, person_user, person_rank, person_cuerpo, person_especialidad,
    person_name, person_last_name_1, person_last_name_2, person_phone, person_dni,
    person_localidad, person_division, person_rol, person_a_emp, person_f_emb,
    person_birthdate, person_num_escalafon, person_current_flag, person_permission_level,
    person_escuadrilla_fk
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15,
    $16, $17, TRUE, 'Común',
    $18
)
RETURNING person_sk;

-- name: UpdatePerson :execrows
UPDATE detall.person
SET person_nk = $1,
    person_user = $2,
    person_rank = $3,
    person_cuerpo = $4,
    person_especialidad = $5,
    person_name = $6,
    person_last_name_1 = $7,
    person_last_name_2 = $8,
    person_phone = $9,
    person_dni = $10,
    person_localidad = $11,
    person_division = $12,
    person_rol = $13,
    person_a_emp = $14,
    person_f_emb = $15,
    person_birthdate = $16,
    person_num_escalafon = $17
WHERE person_sk = $18 AND person_escuadrilla_fk = $19;

-- name: SetPersonCurrentFlag :execrows
-- Una sola query para alta/baja con verificación del estado deseado.
UPDATE detall.person
SET person_current_flag = $1
WHERE person_sk = $2
  AND person_escuadrilla_fk = $3
  AND person_current_flag = NOT $1;

-- name: GetCrewMembersBySk :many
SELECT person_sk, person_nk
FROM detall.person
WHERE person_sk = ANY($1::int[])
  AND person_escuadrilla_fk = $2
ORDER BY person_sk;

-- ============================================================
-- Superusuario (god-mode acotado a la escuadrilla). Gestiona credenciales y
-- niveles de permiso, pero SOLO de personas de su propia escuadrilla: igual
-- que el resto del dominio, todas estas queries filtran por person_escuadrilla_fk.
-- ============================================================

-- name: ListPersonsForSuperuser :many
-- Personas ACTIVAS de la escuadrilla, con nivel y estado de credenciales,
-- ordenadas por la lógica de v_person_ordered (order_position). El hash de
-- contraseña no está en la vista: se trae con un JOIN a detall.person.
SELECT
    vpo.person_sk                                                                              AS id,
    BTRIM(vpo.person_rank || ' ' || vpo.person_last_name_1 || ' ' || vpo.person_last_name_2)::text AS nombre_completo,
    vpo.person_user                                                                            AS usuario,
    vpo.person_permission_level                                                                AS nivel,
    (p.person_password_hash IS NOT NULL)::boolean                                              AS tiene_password
FROM detall.v_person_ordered vpo
JOIN detall.person p ON p.person_sk = vpo.person_sk
WHERE vpo.person_escuadrilla_fk = $1
  AND vpo.person_current_flag = TRUE
ORDER BY vpo.order_position;

-- name: GetPersonPermissionLevelInEscuadrilla :one
SELECT person_permission_level
FROM detall.person
WHERE person_sk = $1 AND person_escuadrilla_fk = $2;

-- name: CountSuperusersInEscuadrilla :one
SELECT COUNT(*)::int
FROM detall.person
WHERE person_permission_level = 'Superusuario' AND person_escuadrilla_fk = $1;

-- name: SetPersonPasswordBySk :execrows
UPDATE detall.person SET person_password_hash = $1
WHERE person_sk = $2 AND person_escuadrilla_fk = $3;

-- name: SetPersonPermissionLevel :execrows
UPDATE detall.person SET person_permission_level = $1
WHERE person_sk = $2 AND person_escuadrilla_fk = $3;
