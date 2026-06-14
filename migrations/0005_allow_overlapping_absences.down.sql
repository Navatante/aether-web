-- Restaura el trigger que impedía ausencias solapadas para una misma
-- persona (copia de 0003_triggers.up.sql). OJO: si ya existen ausencias
-- solapadas en la BD, este down no las elimina; el trigger solo valida
-- futuros INSERT/UPDATE.

CREATE OR REPLACE FUNCTION detall.fn_trg_no_overlap_absence()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM detall.absence a
        WHERE a.absence_person_fk = NEW.absence_person_fk
          AND a.absence_sk <> NEW.absence_sk
          AND NEW.absence_start_date <= a.absence_end_date
          AND NEW.absence_end_date   >= a.absence_start_date
    ) THEN
        RAISE EXCEPTION 'UPDATE/INSERT inválido: la persona ya tiene otra ausencia en esas fechas.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_overlap_absence
    AFTER INSERT OR UPDATE ON detall.absence
    FOR EACH ROW EXECUTE FUNCTION detall.fn_trg_no_overlap_absence();
