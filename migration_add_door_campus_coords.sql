-- Add campus-map coordinates for door nodes.
-- These columns are used only when node_type=2 (door); other nodes keep them NULL.

ALTER TABLE nodes
    ADD COLUMN campus_x INT NULL DEFAULT NULL COMMENT 'Door position on campus map (image pixels); used when node_type=2' AFTER y,
    ADD COLUMN campus_y INT NULL DEFAULT NULL COMMENT 'Door position on campus map (image pixels); used when node_type=2' AFTER campus_x;

