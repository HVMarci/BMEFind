-- Migration: Add per-floor image scale (pixels per 100 metres)
-- Run on the `bmefind` database.

START TRANSACTION;

ALTER TABLE floors
    ADD COLUMN px_per_100m INT NOT NULL DEFAULT 1000
    COMMENT 'How many pixels correspond to 100 metres on this floor image'
    AFTER y;

COMMIT;

