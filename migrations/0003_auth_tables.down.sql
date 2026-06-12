DROP TABLE IF EXISTS detall.session;

ALTER TABLE detall.person
    DROP COLUMN IF EXISTS person_password_hash;
