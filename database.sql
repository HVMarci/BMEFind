-- BMEFind Database Schema
-- Create database and tables for storing navigation data

CREATE DATABASE IF NOT EXISTS bmefind CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bmefind;

-- Table for storing nodes (csucsok)
CREATE TABLE IF NOT EXISTS nodes (
    id INT PRIMARY KEY,
    epulet VARCHAR(10) NOT NULL,
    emelet VARCHAR(10) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    teremnev VARCHAR(100) NOT NULL,
    tipus ENUM('0', '1', '2') NOT NULL COMMENT '0=folyosó, 1=terem, 2=ajtó',
    INDEX idx_epulet_emelet (epulet, emelet),
    INDEX idx_teremnev (teremnev),
    INDEX idx_tipus (tipus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing edges (connections between nodes)
CREATE TABLE IF NOT EXISTS edges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_from INT NOT NULL,
    node_to INT NOT NULL,
    FOREIGN KEY (node_from) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (node_to) REFERENCES nodes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_edge (node_from, node_to),
    INDEX idx_node_from (node_from),
    INDEX idx_node_to (node_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table for storing buildings (epuletek)
CREATE TABLE IF NOT EXISTS buildings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    epulet VARCHAR(10) NOT NULL,
    emelet VARCHAR(10) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL
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
    epulet VARCHAR(10) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_building (user_id, epulet),
    INDEX idx_user_id (user_id),
    INDEX idx_epulet (epulet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
