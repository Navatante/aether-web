DROP TRIGGER IF EXISTS tr_audit_person                 ON detall.person;
DROP TRIGGER IF EXISTS tr_audit_flight                 ON operations.flight;
DROP TRIGGER IF EXISTS trg_no_absence_during_comision  ON detall.absence;
DROP TRIGGER IF EXISTS trg_no_overlap_absence          ON detall.absence;
DROP TRIGGER IF EXISTS trg_no_comision_during_absence  ON detall.person_comision;
DROP TRIGGER IF EXISTS trg_no_overlap_comision         ON detall.person_comision;

DROP FUNCTION IF EXISTS detall.fn_tr_audit_person();
DROP FUNCTION IF EXISTS operations.fn_tr_audit_flight();
DROP FUNCTION IF EXISTS detall.fn_trg_no_absence_during_comision();
DROP FUNCTION IF EXISTS detall.fn_trg_no_overlap_absence();
DROP FUNCTION IF EXISTS detall.fn_trg_no_comision_during_absence();
DROP FUNCTION IF EXISTS detall.fn_trg_no_overlap_comision();
