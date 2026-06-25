-- ============================================================
-- Seguridad de vuelo (flightsafety.medical_exam / dunker / hypobaric)
--
-- Cada fila es un reconocimiento con ciclo de vida: PROGRAMADO (solo
-- *_scheduled_date; *_date NULL) → REALIZADO (*_date + resultado + caducidad).
-- El estado se deriva en el frontend a partir de las fechas.
--
-- RLS por código: estas tablas NO tienen escuadrilla_fk. El aislamiento es
-- person-centric: todas las sentencias filtran por detall.person.
-- person_escuadrilla_fk = $1 (vía JOIN o EXISTS), igual que extra_hour. Así el
-- queryguard encuentra el literal `escuadrilla_fk` y la consulta queda acotada
-- a personal de la escuadrilla de la sesión.
--
-- Las queries *Summary aceptan un filtro de persona opcional ($2): 0 = todas
-- las personas (página de seguimiento); un person_sk concreto = solo esa
-- persona (panel del tripulante, endpoint /me).
-- ============================================================

-- name: MedicalExamSummary :many
-- Estado actual del reconocimiento médico por persona: último REALIZADO (fecha,
-- resultado, lugar, caducidad), la cita PROGRAMADA abierta si existe, y la
-- próxima cita-CIMA (último examen en 'CIMA' + 4 años) para el aviso de los 4
-- años. Acotado a la escuadrilla ($1); ($2 = 0 → todas las personas).
SELECT
    p.person_sk,
    p.person_nk,
    p.person_rank,
    p.person_name,
    p.person_last_name_1,
    p.person_last_name_2,
    COALESCE(done.medical_exam_sk, 0)::int AS done_sk,
    done.medical_exam_date           AS done_date,
    done.medical_exam_expiry_date    AS expiry_date,
    dres.medical_exam_result         AS result,
    COALESCE(done.medical_exam_result_fk, 0)::int AS done_result_fk,
    dpl.medical_exam_place           AS place,
    COALESCE(done.medical_exam_place_fk, 0)::int  AS done_place_fk,
    done.medical_exam_remark         AS remark,
    COALESCE(prog.medical_exam_sk, 0)::int AS scheduled_sk,
    prog.medical_exam_scheduled_date AS scheduled_date,
    ppl.medical_exam_place           AS scheduled_place,
    COALESCE(prog.medical_exam_place_fk, 0)::int AS scheduled_place_fk,
    prog.medical_exam_remark         AS scheduled_remark,
    cima.next_cima_due               AS next_cima_due
FROM detall.v_person_ordered p
LEFT JOIN LATERAL (
    SELECT m.*
    FROM flightsafety.medical_exam m
    WHERE m.medical_exam_person_fk = p.person_sk
      AND m.medical_exam_date IS NOT NULL
    ORDER BY m.medical_exam_date DESC, m.medical_exam_sk DESC
    LIMIT 1
) done ON true
LEFT JOIN flightsafety.medical_exam_result dres ON dres.medical_exam_result_sk = done.medical_exam_result_fk
LEFT JOIN flightsafety.medical_exam_place  dpl  ON dpl.medical_exam_place_sk   = done.medical_exam_place_fk
LEFT JOIN LATERAL (
    SELECT m.*
    FROM flightsafety.medical_exam m
    WHERE m.medical_exam_person_fk = p.person_sk
      AND m.medical_exam_date IS NULL
      AND m.medical_exam_scheduled_date IS NOT NULL
    ORDER BY m.medical_exam_scheduled_date ASC, m.medical_exam_sk DESC
    LIMIT 1
) prog ON true
LEFT JOIN flightsafety.medical_exam_place ppl ON ppl.medical_exam_place_sk = prog.medical_exam_place_fk
LEFT JOIN LATERAL (
    -- Próximo CIMA = último examen REALIZADO en 'CIMA' + 4 años.
    SELECT (MAX(m.medical_exam_date) + INTERVAL '4 years')::date AS next_cima_due
    FROM flightsafety.medical_exam m
    JOIN flightsafety.medical_exam_place pl ON pl.medical_exam_place_sk = m.medical_exam_place_fk
    WHERE m.medical_exam_person_fk = p.person_sk
      AND m.medical_exam_date IS NOT NULL
      AND pl.medical_exam_place = 'CIMA'
) cima ON true
WHERE p.person_escuadrilla_fk = $1
  AND p.person_current_flag = true
  AND p.person_rol <> 'No Tripulante'
  AND ($2 = 0 OR p.person_sk = $2)
ORDER BY p.order_position;

-- name: DunkerSummary :many
-- Estado actual del dunker por persona (anual). Acotado a la escuadrilla ($1);
-- ($2 = 0 → todas las personas).
SELECT
    p.person_sk,
    p.person_nk,
    p.person_rank,
    p.person_name,
    p.person_last_name_1,
    p.person_last_name_2,
    COALESCE(done.dunker_sk, 0)::int AS done_sk,
    done.dunker_date           AS done_date,
    done.dunker_expiry_date    AS expiry_date,
    done.dunker_result         AS result,
    COALESCE(prog.dunker_sk, 0)::int AS scheduled_sk,
    prog.dunker_scheduled_date AS scheduled_date
FROM detall.v_person_ordered p
LEFT JOIN LATERAL (
    SELECT d.*
    FROM flightsafety.dunker d
    WHERE d.dunker_person_fk = p.person_sk
      AND d.dunker_date IS NOT NULL
    ORDER BY d.dunker_date DESC, d.dunker_sk DESC
    LIMIT 1
) done ON true
LEFT JOIN LATERAL (
    SELECT d.*
    FROM flightsafety.dunker d
    WHERE d.dunker_person_fk = p.person_sk
      AND d.dunker_date IS NULL
      AND d.dunker_scheduled_date IS NOT NULL
    ORDER BY d.dunker_scheduled_date ASC, d.dunker_sk DESC
    LIMIT 1
) prog ON true
WHERE p.person_escuadrilla_fk = $1
  AND p.person_current_flag = true
  AND p.person_rol <> 'No Tripulante'
  AND ($2 = 0 OR p.person_sk = $2)
ORDER BY p.order_position;

-- name: HypobaricSummary :many
-- Estado actual de la hiperbárica por persona (cada 5 años). Acotado a la
-- escuadrilla ($1); ($2 = 0 → todas las personas).
SELECT
    p.person_sk,
    p.person_nk,
    p.person_rank,
    p.person_name,
    p.person_last_name_1,
    p.person_last_name_2,
    COALESCE(done.hypobaric_sk, 0)::int AS done_sk,
    done.hypobaric_date           AS done_date,
    done.hypobaric_expiry_date    AS expiry_date,
    done.hypobaric_result         AS result,
    COALESCE(prog.hypobaric_sk, 0)::int AS scheduled_sk,
    prog.hypobaric_scheduled_date AS scheduled_date
FROM detall.v_person_ordered p
LEFT JOIN LATERAL (
    SELECT h.*
    FROM flightsafety.hypobaric h
    WHERE h.hypobaric_person_fk = p.person_sk
      AND h.hypobaric_date IS NOT NULL
    ORDER BY h.hypobaric_date DESC, h.hypobaric_sk DESC
    LIMIT 1
) done ON true
LEFT JOIN LATERAL (
    SELECT h.*
    FROM flightsafety.hypobaric h
    WHERE h.hypobaric_person_fk = p.person_sk
      AND h.hypobaric_date IS NULL
      AND h.hypobaric_scheduled_date IS NOT NULL
    ORDER BY h.hypobaric_scheduled_date ASC, h.hypobaric_sk DESC
    LIMIT 1
) prog ON true
WHERE p.person_escuadrilla_fk = $1
  AND p.person_current_flag = true
  AND p.person_rol <> 'No Tripulante'
  AND ($2 = 0 OR p.person_sk = $2)
ORDER BY p.order_position;

-- ============================================================
-- Historial por persona (drill-down). Acotado a la escuadrilla ($1) y persona ($2).
-- ============================================================

-- name: MedicalExamHistory :many
SELECT
    m.medical_exam_sk,
    m.medical_exam_date,
    m.medical_exam_scheduled_date,
    m.medical_exam_expiry_date,
    res.medical_exam_result AS result,
    pl.medical_exam_place   AS place,
    m.medical_exam_remark   AS remark
FROM flightsafety.medical_exam m
JOIN detall.person p ON p.person_sk = m.medical_exam_person_fk
LEFT JOIN flightsafety.medical_exam_result res ON res.medical_exam_result_sk = m.medical_exam_result_fk
LEFT JOIN flightsafety.medical_exam_place  pl  ON pl.medical_exam_place_sk   = m.medical_exam_place_fk
WHERE p.person_escuadrilla_fk = $1
  AND m.medical_exam_person_fk = $2
ORDER BY COALESCE(m.medical_exam_date, m.medical_exam_scheduled_date) DESC, m.medical_exam_sk DESC;

-- name: DunkerHistory :many
SELECT
    d.dunker_sk,
    d.dunker_date,
    d.dunker_scheduled_date,
    d.dunker_expiry_date,
    d.dunker_result
FROM flightsafety.dunker d
JOIN detall.person p ON p.person_sk = d.dunker_person_fk
WHERE p.person_escuadrilla_fk = $1
  AND d.dunker_person_fk = $2
ORDER BY COALESCE(d.dunker_date, d.dunker_scheduled_date) DESC, d.dunker_sk DESC;

-- name: HypobaricHistory :many
SELECT
    h.hypobaric_sk,
    h.hypobaric_date,
    h.hypobaric_scheduled_date,
    h.hypobaric_expiry_date,
    h.hypobaric_result
FROM flightsafety.hypobaric h
JOIN detall.person p ON p.person_sk = h.hypobaric_person_fk
WHERE p.person_escuadrilla_fk = $1
  AND h.hypobaric_person_fk = $2
ORDER BY COALESCE(h.hypobaric_date, h.hypobaric_scheduled_date) DESC, h.hypobaric_sk DESC;

-- ============================================================
-- Comprobación de cita PROGRAMADA abierta (date NULL, scheduled_date NOT NULL).
-- El service la usa para impedir programar una segunda cita a quien ya tiene una.
-- Acotado a la escuadrilla ($1) y persona ($2).
-- ============================================================

-- name: CountOpenMedicalSchedule :one
SELECT COUNT(*)::int AS total
FROM flightsafety.medical_exam m
JOIN detall.person p ON p.person_sk = m.medical_exam_person_fk
WHERE p.person_escuadrilla_fk = $1
  AND m.medical_exam_person_fk = $2
  AND m.medical_exam_date IS NULL
  AND m.medical_exam_scheduled_date IS NOT NULL;

-- name: CountOpenDunkerSchedule :one
SELECT COUNT(*)::int AS total
FROM flightsafety.dunker d
JOIN detall.person p ON p.person_sk = d.dunker_person_fk
WHERE p.person_escuadrilla_fk = $1
  AND d.dunker_person_fk = $2
  AND d.dunker_date IS NULL
  AND d.dunker_scheduled_date IS NOT NULL;

-- name: CountOpenHypobaricSchedule :one
SELECT COUNT(*)::int AS total
FROM flightsafety.hypobaric h
JOIN detall.person p ON p.person_sk = h.hypobaric_person_fk
WHERE p.person_escuadrilla_fk = $1
  AND h.hypobaric_person_fk = $2
  AND h.hypobaric_date IS NULL
  AND h.hypobaric_scheduled_date IS NOT NULL;

-- ============================================================
-- Altas. Solo insertan si la persona ($N) pertenece a la escuadrilla ($M) de la
-- sesión (RETURNING vacío → ErrNoRows en el service).
-- ============================================================

-- name: InsertMedicalExam :one
-- Alta de un reconocimiento médico. Sirve tanto para PROGRAMADO (date/result
-- NULL, scheduled_date set) como REALIZADO (date/expiry/result set). El service
-- valida la coherencia. $8 = escuadrilla de la sesión.
INSERT INTO flightsafety.medical_exam (
    medical_exam_date, medical_exam_person_fk, medical_exam_place_fk,
    medical_exam_result_fk, medical_exam_remark, medical_exam_scheduled_date,
    medical_exam_expiry_date
)
SELECT $1, $2, $3, $4, $5, $6, $7
WHERE EXISTS (
    SELECT 1 FROM detall.person
    WHERE person_sk = $2 AND person_escuadrilla_fk = $8
)
RETURNING medical_exam_sk;

-- name: InsertDunker :one
INSERT INTO flightsafety.dunker (
    dunker_date, dunker_person_fk, dunker_result, dunker_scheduled_date, dunker_expiry_date
)
SELECT $1, $2, $3, $4, $5
WHERE EXISTS (
    SELECT 1 FROM detall.person
    WHERE person_sk = $2 AND person_escuadrilla_fk = $6
)
RETURNING dunker_sk;

-- name: InsertHypobaric :one
INSERT INTO flightsafety.hypobaric (
    hypobaric_date, hypobaric_person_fk, hypobaric_result, hypobaric_scheduled_date, hypobaric_expiry_date
)
SELECT $1, $2, $3, $4, $5
WHERE EXISTS (
    SELECT 1 FROM detall.person
    WHERE person_sk = $2 AND person_escuadrilla_fk = $6
)
RETURNING hypobaric_sk;

-- ============================================================
-- Completar (rellenar el resultado de una cita PROGRAMADA) / actualizar.
-- Acotado a personal de la escuadrilla ($N) vía detall.person.
-- ============================================================

-- name: UpdateMedicalExam :execrows
UPDATE flightsafety.medical_exam m
SET medical_exam_date           = $2,
    medical_exam_place_fk       = $3,
    medical_exam_result_fk      = $4,
    medical_exam_remark         = $5,
    medical_exam_scheduled_date = $6,
    medical_exam_expiry_date    = $7
FROM detall.person p
WHERE m.medical_exam_sk = $1
  AND p.person_sk = m.medical_exam_person_fk
  AND p.person_escuadrilla_fk = $8;

-- name: UpdateDunker :execrows
UPDATE flightsafety.dunker d
SET dunker_date           = $2,
    dunker_result         = $3,
    dunker_scheduled_date = $4,
    dunker_expiry_date    = $5
FROM detall.person p
WHERE d.dunker_sk = $1
  AND p.person_sk = d.dunker_person_fk
  AND p.person_escuadrilla_fk = $6;

-- name: UpdateHypobaric :execrows
UPDATE flightsafety.hypobaric h
SET hypobaric_date           = $2,
    hypobaric_result         = $3,
    hypobaric_scheduled_date = $4,
    hypobaric_expiry_date    = $5
FROM detall.person p
WHERE h.hypobaric_sk = $1
  AND p.person_sk = h.hypobaric_person_fk
  AND p.person_escuadrilla_fk = $6;

-- ============================================================
-- Borrado. Acotado a personal de la escuadrilla ($2).
-- ============================================================

-- name: DeleteMedicalExam :execrows
DELETE FROM flightsafety.medical_exam m
USING detall.person p
WHERE m.medical_exam_sk = $1
  AND p.person_sk = m.medical_exam_person_fk
  AND p.person_escuadrilla_fk = $2;

-- name: DeleteDunker :execrows
DELETE FROM flightsafety.dunker d
USING detall.person p
WHERE d.dunker_sk = $1
  AND p.person_sk = d.dunker_person_fk
  AND p.person_escuadrilla_fk = $2;

-- name: DeleteHypobaric :execrows
DELETE FROM flightsafety.hypobaric h
USING detall.person p
WHERE h.hypobaric_sk = $1
  AND p.person_sk = h.hypobaric_person_fk
  AND p.person_escuadrilla_fk = $2;
