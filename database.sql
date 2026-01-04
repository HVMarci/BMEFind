-- BMEFind Database Schema
-- Create database and tables for storing navigation data

CREATE DATABASE IF NOT EXISTS bmefind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bmefind;

-- Table for storing nodes
CREATE TABLE IF NOT EXISTS nodes (
    id INT PRIMARY KEY,
    building VARCHAR(10) NOT NULL,
    floor VARCHAR(10) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    node_type TINYINT UNSIGNED NOT NULL COMMENT '0=corridor, 1=room, 2=door',
    INDEX idx_building_floor (building, floor),
    INDEX idx_room_name (room_name),
    INDEX idx_node_type (node_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing edges (connections between nodes)
CREATE TABLE IF NOT EXISTS edges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_node_id INT NOT NULL,
    to_node_id INT NOT NULL,
    FOREIGN KEY (from_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_edge (from_node_id, to_node_id),
    INDEX idx_from_node_id (from_node_id),
    INDEX idx_to_node_id (to_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing floors (building floorplan images; one row per building+floor)
CREATE TABLE IF NOT EXISTS floors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    building VARCHAR(10) NOT NULL,
    floor VARCHAR(10) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    UNIQUE KEY unique_building_floor (building, floor),
    INDEX idx_building (building),
    INDEX idx_floor (floor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: The edges table stores bidirectional connections
-- Each connection should be stored in both directions for efficient querying

-- Table for storing user accounts
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing user building permissions
CREATE TABLE IF NOT EXISTS user_building_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    building VARCHAR(10) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_building (user_id, building),
    INDEX idx_user_id (user_id),
    INDEX idx_building (building)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
