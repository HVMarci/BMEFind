-- Migration: Rename Hungarian DB identifiers to English (building/floor)
-- Compatible approach for older MySQL (uses CHANGE COLUMN; avoids RENAME COLUMN).
--
-- IMPORTANT:
-- - This migration assumes the *old* schema columns exist:
--   - nodes: epulet, emelet, teremnev, tipus
--   - edges: node_from, node_to
--   - floors: epulet, emelet
--   - user_building_permissions: epulet
-- - Run on the `bmefind` database.

START TRANSACTION;

-- nodes
ALTER TABLE nodes
    CHANGE COLUMN epulet building VARCHAR(10) NOT NULL,
    CHANGE COLUMN emelet floor VARCHAR(10) NOT NULL,
    CHANGE COLUMN teremnev room_name VARCHAR(100) NOT NULL,
    -- Convert ENUM('0','1','2') safely by first converting to a string column.
    CHANGE COLUMN tipus node_type VARCHAR(1) NOT NULL;

-- At this point node_type contains the literal strings '0'/'1'/'2'.
UPDATE nodes
SET node_type = CAST(node_type AS UNSIGNED)
WHERE node_type IN ('0', '1', '2');

ALTER TABLE nodes
    MODIFY node_type TINYINT UNSIGNED NOT NULL COMMENT '0=corridor, 1=room, 2=door';

-- Recreate indexes (drop old Hungarian ones, add English ones)
ALTER TABLE nodes
    DROP INDEX idx_epulet_emelet,
    DROP INDEX idx_teremnev,
    DROP INDEX idx_tipus,
    ADD INDEX idx_building_floor (building, floor),
    ADD INDEX idx_room_name (room_name),
    ADD INDEX idx_node_type (node_type);

-- floors
ALTER TABLE floors
    CHANGE COLUMN epulet building VARCHAR(10) NOT NULL,
    CHANGE COLUMN emelet floor VARCHAR(10) NOT NULL;

-- Add uniqueness/indexes (safe even if you skip; but will error if they already exist)
ALTER TABLE floors
    ADD UNIQUE KEY unique_building_floor (building, floor),
    ADD INDEX idx_building (building),
    ADD INDEX idx_floor (floor);

-- user_building_permissions
ALTER TABLE user_building_permissions
    CHANGE COLUMN epulet building VARCHAR(10) NOT NULL;

ALTER TABLE user_building_permissions
    DROP INDEX unique_user_building,
    DROP INDEX idx_epulet,
    ADD UNIQUE KEY unique_user_building (user_id, building),
    ADD INDEX idx_building (building);

-- edges
-- We rebuild the table to avoid having to know FK constraint names on older MySQL.
CREATE TABLE edges_new (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_node_id INT NOT NULL,
    to_node_id INT NOT NULL,
    CONSTRAINT fk_edges_from_node FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    CONSTRAINT fk_edges_to_node FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_edge (from_node_id, to_node_id),
    INDEX idx_from_node_id (from_node_id),
    INDEX idx_to_node_id (to_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO edges_new (id, from_node_id, to_node_id)
SELECT id, node_from, node_to FROM edges;

DROP TABLE edges;
RENAME TABLE edges_new TO edges;

COMMIT;
