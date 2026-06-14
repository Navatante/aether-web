-- ============================================================
-- Permitir ausencias solapadas para una misma persona.
--
-- Regla de dominio nueva: una persona SÍ puede tener varias
-- ausencias que se solapen el mismo día (p. ej. un vuelo y un
-- permiso). El calendario de Disponibilidad las pinta como
-- franjas horizontales.
--
-- Se elimina ÚNICAMENTE el trigger ausencia-ausencia. Siguen
-- vigentes (no se tocan):
--   - trg_no_overlap_comision        (comisión + comisión)
--   - trg_no_comision_during_absence (comisión sobre ausencia)
--   - trg_no_absence_during_comision (ausencia sobre comisión)
-- ============================================================

DROP TRIGGER  IF EXISTS trg_no_overlap_absence ON detall.absence;
DROP FUNCTION IF EXISTS detall.fn_trg_no_overlap_absence();
