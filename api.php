<?php
session_start();

// Load configuration from .env file
$dotenv = parse_ini_file('.env');

// CORS headers
$corsOrigin = isset($dotenv['CORS_ORIGIN']) ? $dotenv['CORS_ORIGIN'] : 'http://localhost';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

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

// Authentication helper functions
function isAuthenticated() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

function getCurrentUserId() {
    return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
}

function getUserBuildingPermissions($userId) {
    $conn = getDBConnection();

    // Check if user is admin
    $stmt = $conn->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && $user['is_admin']) {
        // Admin has access to all buildings
        $stmt = $conn->prepare("SELECT DISTINCT epulet FROM floors");
        $stmt->execute();
        $result = $stmt->get_result();
        $buildings = [];
        while ($row = $result->fetch_assoc()) {
            $buildings[] = $row['epulet'];
        }
        $stmt->close();
        $conn->close();
        return $buildings;
    }

    // Get user's specific permissions
    $stmt = $conn->prepare("SELECT epulet FROM user_building_permissions WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $buildings = [];
    while ($row = $result->fetch_assoc()) {
        $buildings[] = $row['epulet'];
    }

    $stmt->close();
    $conn->close();

    return $buildings;
}

function authenticateUser($username, $password) {
    $conn = getDBConnection();

    $stmt = $conn->prepare("SELECT id, password_hash, display_name, is_admin FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Update last login
        $stmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->bind_param("i", $user['id']);
        $stmt->execute();
        $stmt->close();
        $conn->close();

        return [
            'id' => $user['id'],
            'display_name' => $user['display_name'],
            'is_admin' => (bool)$user['is_admin']
        ];
    }

    $conn->close();
    return null;
}

// Auth endpoints
function handleLogin() {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = isset($input['username']) ? trim($input['username']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if (empty($username) || empty($password)) {
        return ['success' => false, 'error' => 'Felhasználónév és jelszó megadása kötelező'];
    }

    $user = authenticateUser($username, $password);

    if ($user) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['display_name'] = $user['display_name'];
        $_SESSION['is_admin'] = $user['is_admin'];

        $permissions = getUserBuildingPermissions($user['id']);

        return [
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'display_name' => $user['display_name'],
                'is_admin' => $user['is_admin'],
                'building_permissions' => $permissions
            ]
        ];
    }

    return ['success' => false, 'error' => 'Hibás felhasználónév vagy jelszó'];
}

function handleLogout() {
    // Clear user data from session but keep the session alive
    unset($_SESSION['user_id']);
    unset($_SESSION['display_name']);
    unset($_SESSION['is_admin']);
    return ['success' => true, 'message' => 'Sikeres kijelentkezés'];
}

function handleCheckAuth() {
    if (!isAuthenticated()) {
        return [
            'authenticated' => false,
            'user' => null,
            'building_permissions' => []
        ];
    }

    $permissions = getUserBuildingPermissions($_SESSION['user_id']);

    return [
        'authenticated' => true,
        'user' => [
            'id' => $_SESSION['user_id'],
            'display_name' => $_SESSION['display_name'],
            'is_admin' => $_SESSION['is_admin']
        ],
        'building_permissions' => $permissions
    ];
}

// Get floors (one row per building+floor image)
function getFloors() {
    $conn = getDBConnection();
    
    $sql = "SELECT * FROM floors";
    $stmt = $conn->prepare($sql);
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $floors = [];
    while ($row = $result->fetch_assoc()) {
        $floors[] = $row;
    }
    
    $stmt->close();
    $conn->close();
    
    return $floors;
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

// Save nodes (for dev UI) - with permission filtering
function saveNodes($nodes, $allowedBuildings) {
    if (empty($allowedBuildings)) {
        return [
            'success' => false,
            'error' => 'Nincs jogosultságod egyetlen épülethez sem',
            'saved_count' => 0,
            'skipped_count' => count($nodes),
            'skipped' => array_map(function($n) { return ['epulet' => $n['epulet']]; }, $nodes)
        ];
    }

    $conn = getDBConnection();
    $conn->begin_transaction();

    try {
        // Separate nodes by permission
        $nodesToSave = [];
        $nodesSkipped = [];
        $buildingsToUpdate = [];

        foreach ($nodes as $node) {
            if (in_array($node['epulet'], $allowedBuildings)) {
                $nodesToSave[] = $node;
                $buildingsToUpdate[$node['epulet']] = true;
            } else {
                $nodesSkipped[] = [
                    'id' => $node['id'],
                    'epulet' => $node['epulet'],
                    'teremnev' => $node['teremnev'] ?? ''
                ];
            }
        }

        // Delete only nodes in permitted buildings
        if (!empty($buildingsToUpdate)) {
            $placeholders = implode(',', array_fill(0, count($buildingsToUpdate), '?'));
            $types = str_repeat('s', count($buildingsToUpdate));
            $buildings = array_keys($buildingsToUpdate);

            $stmt = $conn->prepare("DELETE FROM nodes WHERE epulet IN ($placeholders)");
            $stmt->bind_param($types, ...$buildings);
            $stmt->execute();
            $stmt->close();
        }

        // Insert permitted nodes
        if (!empty($nodesToSave)) {
            $stmt = $conn->prepare("INSERT INTO nodes (id, epulet, emelet, x, y, teremnev, tipus) VALUES (?, ?, ?, ?, ?, ?, ?)");

            foreach ($nodesToSave as $node) {
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
        }

        $conn->commit();
        $conn->close();

        return [
            'success' => true,
            'message' => 'Csúcsok mentve',
            'saved_count' => count($nodesToSave),
            'skipped_count' => count($nodesSkipped),
            'saved_buildings' => array_keys($buildingsToUpdate),
            'skipped' => $nodesSkipped
        ];
    } catch (Exception $e) {
        $conn->rollback();
        $conn->close();
        return ['success' => false, 'error' => 'Mentési hiba: ' . $e->getMessage()];
    }
}

// Apply diff-based changes (for dev UI)
function applyChanges($changes, $allowedBuildings) {
    if (empty($allowedBuildings)) {
        return [
            'success' => false,
            'error' => 'Nincs jogosultságod egyetlen épülethez sem'
        ];
    }

    $conn = getDBConnection();
    $conn->begin_transaction();

    try {
        $stats = [
            'nodes_added' => 0,
            'nodes_updated' => 0,
            'nodes_deleted' => 0,
            'edges_added' => 0,
            'edges_deleted' => 0
        ];

        // Process node deletions
        if (isset($changes['nodes']['deleted']) && !empty($changes['nodes']['deleted'])) {
            $deleteIds = $changes['nodes']['deleted'];
            $placeholders = implode(',', array_fill(0, count($deleteIds), '?'));
            $types = str_repeat('i', count($deleteIds));

            $stmt = $conn->prepare("DELETE FROM nodes WHERE id IN ($placeholders)");
            $stmt->bind_param($types, ...$deleteIds);
            $stmt->execute();
            $stats['nodes_deleted'] = $stmt->affected_rows;
            $stmt->close();
        }

        // Process node additions
        if (isset($changes['nodes']['added']) && !empty($changes['nodes']['added'])) {
            $stmt = $conn->prepare("INSERT INTO nodes (id, epulet, emelet, x, y, teremnev, tipus) VALUES (?, ?, ?, ?, ?, ?, ?)");

            foreach ($changes['nodes']['added'] as $node) {
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
                $stats['nodes_added']++;
            }
            $stmt->close();
        }

        // Process node updates
        if (isset($changes['nodes']['updated']) && !empty($changes['nodes']['updated'])) {
            $stmt = $conn->prepare("UPDATE nodes SET epulet=?, emelet=?, x=?, y=?, teremnev=?, tipus=? WHERE id=?");

            foreach ($changes['nodes']['updated'] as $node) {
                $stmt->bind_param(
                    "ssiissi",
                    $node['epulet'],
                    $node['emelet'],
                    $node['x'],
                    $node['y'],
                    $node['teremnev'],
                    $node['tipus'],
                    $node['id']
                );
                $stmt->execute();
                $stats['nodes_updated']++;
            }
            $stmt->close();
        }

        // Process edge deletions
        if (isset($changes['edges']['deleted']) && !empty($changes['edges']['deleted'])) {
            $stmt = $conn->prepare("DELETE FROM edges WHERE (node_from=? AND node_to=?) OR (node_from=? AND node_to=?)");

            foreach ($changes['edges']['deleted'] as $edge) {
                $from = $edge['node_from'];
                $to = $edge['node_to'];
                $stmt->bind_param("iiii", $from, $to, $to, $from);
                $stmt->execute();
            }
            $stats['edges_deleted'] = count($changes['edges']['deleted']);
            $stmt->close();
        }

        // Process edge additions
        if (isset($changes['edges']['added']) && !empty($changes['edges']['added'])) {
            $stmt = $conn->prepare("INSERT IGNORE INTO edges (node_from, node_to) VALUES (?, ?)");

            foreach ($changes['edges']['added'] as $edge) {
                // Insert both directions
                $stmt->bind_param("ii", $edge['node_from'], $edge['node_to']);
                $stmt->execute();
                $stmt->bind_param("ii", $edge['node_to'], $edge['node_from']);
                $stmt->execute();
            }
            $stats['edges_added'] = count($changes['edges']['added']);
            $stmt->close();
        }

        $conn->commit();
        $conn->close();

        return [
            'success' => true,
            'message' => 'Módosítások alkalmazva',
            'stats' => $stats
        ];
    } catch (Exception $e) {
        $conn->rollback();
        $conn->close();
        return ['success' => false, 'error' => 'Hiba a módosítások alkalmazása közben: ' . $e->getMessage()];
    }
}

// Save edges (for dev UI) - with permission filtering
function saveEdges($edges, $allowedBuildings) {
    if (empty($allowedBuildings)) {
        return [
            'success' => false,
            'error' => 'Nincs jogosultságod egyetlen épülethez sem',
            'saved_count' => 0,
            'skipped_count' => count($edges)
        ];
    }

    $conn = getDBConnection();
    $conn->begin_transaction();

    try {
        // Get all node IDs and their buildings
        $stmt = $conn->prepare("SELECT id, epulet FROM nodes");
        $stmt->execute();
        $result = $stmt->get_result();
        $nodeBuildings = [];
        while ($row = $result->fetch_assoc()) {
            $nodeBuildings[$row['id']] = $row['epulet'];
        }
        $stmt->close();

        // Separate edges by permission
        // An edge can only be saved if BOTH nodes are in permitted buildings
        $edgesToSave = [];
        $edgesSkipped = [];
        $buildingsWithEdges = [];

        foreach ($edges as $edge) {
            $fromBuilding = isset($nodeBuildings[$edge['node_from']]) ? $nodeBuildings[$edge['node_from']] : null;
            $toBuilding = isset($nodeBuildings[$edge['node_to']]) ? $nodeBuildings[$edge['node_to']] : null;

            $fromAllowed = $fromBuilding && in_array($fromBuilding, $allowedBuildings);
            $toAllowed = $toBuilding && in_array($toBuilding, $allowedBuildings);

            if ($fromAllowed && $toAllowed) {
                $edgesToSave[] = $edge;
                if ($fromBuilding) $buildingsWithEdges[$fromBuilding] = true;
                if ($toBuilding) $buildingsWithEdges[$toBuilding] = true;
            } else {
                $edgesSkipped[] = [
                    'node_from' => $edge['node_from'],
                    'node_to' => $edge['node_to'],
                    'from_building' => $fromBuilding,
                    'to_building' => $toBuilding
                ];
            }
        }

        // Delete edges where both nodes are in permitted buildings
        if (!empty($buildingsWithEdges)) {
            $placeholders = implode(',', array_fill(0, count($buildingsWithEdges), '?'));
            $types = str_repeat('s', count($buildingsWithEdges) * 2);
            $buildings = array_keys($buildingsWithEdges);
            $params = array_merge($buildings, $buildings);

            $stmt = $conn->prepare("
                DELETE e FROM edges e
                INNER JOIN nodes n1 ON e.node_from = n1.id
                INNER JOIN nodes n2 ON e.node_to = n2.id
                WHERE n1.epulet IN ($placeholders) AND n2.epulet IN ($placeholders)
            ");
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $stmt->close();
        }

        // Insert permitted edges
        if (!empty($edgesToSave)) {
            $stmt = $conn->prepare("INSERT INTO edges (node_from, node_to) VALUES (?, ?)");

            foreach ($edgesToSave as $edge) {
                $stmt->bind_param("ii", $edge['node_from'], $edge['node_to']);
                $stmt->execute();
            }
            $stmt->close();
        }

        $conn->commit();
        $conn->close();

        return [
            'success' => true,
            'message' => 'Élek mentve',
            'saved_count' => count($edgesToSave),
            'skipped_count' => count($edgesSkipped),
            'skipped' => $edgesSkipped
        ];
    } catch (Exception $e) {
        $conn->rollback();
        $conn->close();
        return ['success' => false, 'error' => 'Mentési hiba: ' . $e->getMessage()];
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
    } elseif ($path === 'floors') {
        echo json_encode(getFloors());
    } elseif ($path === 'checkAuth') {
        echo json_encode(handleCheckAuth());
    } else {
        echo json_encode(['error' => 'Invalid endpoint']);
    }
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($path === 'login') {
        echo json_encode(handleLogin());
    } elseif ($path === 'logout') {
        echo json_encode(handleLogout());
    } elseif ($path === 'saveNodes') {
        // Require authentication for saving
        if (!isAuthenticated()) {
            echo json_encode(['success' => false, 'error' => 'Bejelentkezés szükséges']);
            exit;
        }
        $nodes = isset($input['nodes']) ? $input['nodes'] : [];
        $allowedBuildings = getUserBuildingPermissions($_SESSION['user_id']);
        echo json_encode(saveNodes($nodes, $allowedBuildings));
    } elseif ($path === 'saveEdges') {
        // Require authentication for saving
        if (!isAuthenticated()) {
            echo json_encode(['success' => false, 'error' => 'Bejelentkezés szükséges']);
            exit;
        }
        $edges = isset($input['edges']) ? $input['edges'] : [];
        $allowedBuildings = getUserBuildingPermissions($_SESSION['user_id']);
        echo json_encode(saveEdges($edges, $allowedBuildings));
    } elseif ($path === 'applyChanges') {
        // Require authentication for saving
        if (!isAuthenticated()) {
            echo json_encode(['success' => false, 'error' => 'Bejelentkezés szükséges']);
            exit;
        }
        $allowedBuildings = getUserBuildingPermissions($_SESSION['user_id']);
        echo json_encode(applyChanges($input, $allowedBuildings));
    } else {
        echo json_encode(['error' => 'Invalid endpoint']);
    }
} else {
    echo json_encode(['error' => 'Method not allowed']);
}
?>
