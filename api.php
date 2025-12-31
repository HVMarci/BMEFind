<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database configuration in .env file
$dotenv = parse_ini_file('.env');
define('DB_HOST', $dotenv['DB_HOST']);
define('DB_USER', $dotenv['DB_USER']);
define('DB_PASS', $dotenv['DB_PASS']);
define('DB_NAME', $dotenv['DB_NAME']);
define('DB_PORT', $dotenv['DB_PORT']);

// Connect to database
function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
    if ($conn->connect_error) {
        die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
    }
    $conn->set_charset("utf8mb4");
    return $conn;
}

// Get distinct buildings
function getBuildings() {
    $conn = getDBConnection();
    
    $sql = "SELECT * FROM buildings";
    $stmt = $conn->prepare($sql);
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $buildings = [];
    while ($row = $result->fetch_assoc()) {
        $buildings[] = $row;
    }
    
    $stmt->close();
    $conn->close();
    
    return $buildings;
}

// Get nodes by building and floor
function getNodes($epulet = null, $emelet = null) {
    $conn = getDBConnection();
    
    $sql = "SELECT * FROM nodes";
    $conditions = [];
    $params = [];
    $types = "";
    
    if ($epulet !== null) {
        $conditions[] = "epulet = ?";
        $params[] = $epulet;
        $types .= "s";
    }
    
    if ($emelet !== null) {
        $conditions[] = "emelet = ?";
        $params[] = $emelet;
        $types .= "s";
    }
    
    if (count($conditions) > 0) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }
    
    $stmt = $conn->prepare($sql);
    
    if (count($params) > 0) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();

    $nodes = [];
    while ($row = $result->fetch_assoc()) {
        $nodes[] = $row;
    }

    $stmt->close();
    $conn->close();

    return $nodes;
}

// Get edges by building and floor
function getEdges($epulet = null, $emelet = null) {
    $conn = getDBConnection();
    
    if ($epulet === null && $emelet === null) {
        // Get all edges
        $sql = "SELECT * FROM edges";
        $stmt = $conn->prepare($sql);
    
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        // Get edges where both nodes are in the specified building/floor
        $sql = "SELECT DISTINCT e.* FROM edges e
                INNER JOIN nodes n1 ON e.node_from = n1.id
                INNER JOIN nodes n2 ON e.node_to = n2.id
                WHERE 1=1";
        
        $conditions = [];
        $params = [];
        $types = "";
        
        if ($epulet !== null) {
            $conditions[] = "n1.epulet = ? AND n2.epulet = ?";
            $params[] = $epulet;
            $params[] = $epulet;
            $types .= "ss";
        }
        
        if ($emelet !== null) {
            $conditions[] = "n1.emelet = ? AND n2.emelet = ?";
            $params[] = $emelet;
            $params[] = $emelet;
            $types .= "ss";
        }
        
        if (count($conditions) > 0) {
            $sql .= " AND " . implode(" AND ", $conditions);
        }
        
        $stmt = $conn->prepare($sql);
        
        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
    }
    
    $edges = [];
    while ($row = $result->fetch_assoc()) {
        $edges[] = $row;
    }
    
    if (isset($stmt)) {
        $stmt->close();
    }
    $conn->close();
    
    return $edges;
}

// Save nodes (for dev UI)
function saveNodes($nodes) {
    $conn = getDBConnection();
    
    $conn->begin_transaction();
    
    try {
        // Clear existing nodes
        $conn->query("DELETE FROM nodes");
        
        // Insert new nodes
        $stmt = $conn->prepare("INSERT INTO nodes (id, epulet, emelet, x, y, teremnev, tipus) VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        foreach ($nodes as $node) {
            $stmt->bind_param(
                "issiiss",
                $node['id'],
                $node['epulet'],
                $node['emelet'],
                $node['x'],
                $node['y'],
                $node['teremnev'],
                $node['tipus']
            );

            $stmt->execute();
        }
        
        $stmt->close();
        $conn->commit();
        $conn->close();
        
        return ['success' => true, 'message' => 'Nodes saved successfully'];
    } catch (Exception $e) {
        $conn->rollback();
        $conn->close();
        return ['error' => 'Failed to save nodes: ' . $e->getMessage()];
    }
}

// Save edges (for dev UI)
function saveEdges($edges) {
    $conn = getDBConnection();
    
    $conn->begin_transaction();
    
    try {
        // Clear existing edges
        $conn->query("DELETE FROM edges");
        
        // Insert new edges
        $stmt = $conn->prepare("INSERT INTO edges (node_from, node_to) VALUES (?, ?)");
        
        foreach ($edges as $edge) {
            $stmt->bind_param("ii", $edge['node_from'], $edge['node_to']);
            $stmt->execute();
        }
        
        $stmt->close();
        $conn->commit();
        $conn->close();
        
        return ['success' => true, 'message' => 'Edges saved successfully'];
    } catch (Exception $e) {
        $conn->rollback();
        $conn->close();
        return ['error' => 'Failed to save edges: ' . $e->getMessage()];
    }
}

// Router
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['path']) ? $_GET['path'] : '';

if ($method === 'GET') {
    if ($path === 'nodes') {
        $epulet = isset($_GET['epulet']) ? $_GET['epulet'] : null;
        $emelet = isset($_GET['emelet']) ? $_GET['emelet'] : null;
        echo json_encode(getNodes($epulet, $emelet));
    } elseif ($path === 'edges') {
        $epulet = isset($_GET['epulet']) ? $_GET['epulet'] : null;
        $emelet = isset($_GET['emelet']) ? $_GET['emelet'] : null;
        echo json_encode(getEdges($epulet, $emelet));
    } elseif ($path === 'buildings') {
        echo json_encode(getBuildings());
    } else {
        echo json_encode(['error' => 'Invalid endpoint']);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($path === 'saveNodes') {
        $nodes = isset($input['nodes']) ? $input['nodes'] : [];
        echo json_encode(saveNodes($nodes));
    } elseif ($path === 'saveEdges') {
        $edges = isset($input['edges']) ? $input['edges'] : [];
        echo json_encode(saveEdges($edges));
    } else {
        echo json_encode(['error' => 'Invalid endpoint']);
    }
} else {
    echo json_encode(['error' => 'Method not allowed']);
}
?>
