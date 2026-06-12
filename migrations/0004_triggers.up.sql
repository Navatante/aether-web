-- ============================================================
-- Triggers de invariante + auditoría (Hito 1).
--
-- Invariantes de integridad: una persona no puede tener comisiones
-- ni ausencias que se solapen entre sí, ni una de cada tipo a la vez.
-- Se mantienen en BD porque son reglas duras del dominio, no lógica
-- de negocio.
--
-- Auditoría: tr_audit_flight registra cambios en operations.flight
-- como JSONB. El user_id / ip se inyectan desde Go via GUCs locales:
--   SET LOCAL aether.user_id = '...';
--   SET LOCAL aether.ip_address = '...';
-- (los configurará el middleware de auth en Hito 2).
-- ============================================================

-- ============================================================
-- TRG_NoOverlap_Comision
-- Una persona no puede estar asignada a dos comisiones cuyas fechas
-- se solapen.
-- ============================================================
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

-- ============================================================
-- TRG_NoComisionDuringAbsence
-- No se puede crear una comisión-persona cuyas fechas solapen con
-- una ausencia existente de esa misma persona.
-- ============================================================
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

-- ============================================================
-- TRG_NoOverlap_Absence
-- Una persona no puede tener dos ausencias con fechas solapadas.
-- ============================================================
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

-- ============================================================
-- TRG_NoAbsenceDuringComision
-- No se puede crear una ausencia cuyas fechas solapen con una
-- comisión-persona existente para esa misma persona.
-- ============================================================
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

-- ============================================================
-- tr_audit_flight
-- Registra INSERT/UPDATE/DELETE en operations.flight como JSONB.
-- ============================================================
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
