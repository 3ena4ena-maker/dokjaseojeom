import { OBSTACLE_BOXES, ROOM_BOUNDS } from '../data/bookstoreData';

const CHARACTER_RADIUS = 0.26;

export function isPointWalkable(
  x: number,
  z: number,
  padding = CHARACTER_RADIUS
): boolean {
  if (
    x < ROOM_BOUNDS.minX + padding * 0.4 ||
    x > ROOM_BOUNDS.maxX - padding * 0.4 ||
    z < ROOM_BOUNDS.minZ + padding * 0.4 ||
    z > ROOM_BOUNDS.maxZ - padding * 0.4
  ) {
    return false;
  }

  for (const box of OBSTACLE_BOXES) {
    if (
      x >= box.minX - padding &&
      x <= box.maxX + padding &&
      z >= box.minZ - padding &&
      z <= box.maxZ + padding
    ) {
      return false;
    }
  }

  return true;
}

export function resolveCharacterMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number
): [number, number, boolean] {
  const clampedX = Math.max(
    ROOM_BOUNDS.minX,
    Math.min(ROOM_BOUNDS.maxX, targetX)
  );
  const clampedZ = Math.max(
    ROOM_BOUNDS.minZ,
    Math.min(ROOM_BOUNDS.maxZ, targetZ)
  );

  if (isPointWalkable(clampedX, clampedZ)) {
    return [clampedX, clampedZ, false];
  }

  // Try sliding along X only
  if (isPointWalkable(clampedX, currentZ)) {
    return [clampedX, currentZ, true];
  }

  // Try sliding along Z only
  if (isPointWalkable(currentX, clampedZ)) {
    return [currentX, clampedZ, true];
  }

  return [currentX, currentZ, true];
}

export function findNearestWalkablePoint(
  x: number,
  z: number,
  maxSearchRadius = 1.5
): [number, number] | null {
  if (isPointWalkable(x, z)) return [x, z];

  const radialSteps = 14;
  const angleSteps = 24;
  for (let rIdx = 1; rIdx <= radialSteps; rIdx++) {
    const r = (rIdx / radialSteps) * maxSearchRadius;
    for (let aIdx = 0; aIdx < angleSteps; aIdx++) {
      const angle = (aIdx / angleSteps) * Math.PI * 2;
      const nx = x + Math.cos(angle) * r;
      const nz = z + Math.sin(angle) * r;
      if (isPointWalkable(nx, nz)) {
        return [nx, nz];
      }
    }
  }
  return null;
}

function hasLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  padding = CHARACTER_RADIUS
): boolean {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / 0.12));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    if (!isPointWalkable(x, z, padding)) {
      return false;
    }
  }
  return true;
}

// A* Grid Pathfinding around furniture, doorway & bookshelves
const GRID_STEP = 0.25;
const GRID_MIN_X = -3.75;
const GRID_MAX_X = 3.65;
const GRID_MIN_Z = -5.55;
const GRID_MAX_Z = 10.1;

const COLS = Math.floor((GRID_MAX_X - GRID_MIN_X) / GRID_STEP) + 1;
const ROWS = Math.floor((GRID_MAX_Z - GRID_MIN_Z) / GRID_STEP) + 1;

function toGrid(x: number, z: number): [number, number] {
  const c = Math.max(
    0,
    Math.min(COLS - 1, Math.round((x - GRID_MIN_X) / GRID_STEP))
  );
  const r = Math.max(
    0,
    Math.min(ROWS - 1, Math.round((z - GRID_MIN_Z) / GRID_STEP))
  );
  return [c, r];
}

function toWorld(c: number, r: number): [number, number] {
  return [GRID_MIN_X + c * GRID_STEP, GRID_MIN_Z + r * GRID_STEP];
}

export function findNavigationPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number
): Array<[number, number]> {
  const validGoal = findNearestWalkablePoint(goalX, goalZ, 1.4);
  if (!validGoal) return [];

  const [gx, gz] = validGoal;

  // Direct line-of-sight shortcut
  if (hasLineOfSight(startX, startZ, gx, gz, CHARACTER_RADIUS * 0.9)) {
    return [[gx, gz]];
  }

  const validStart = findNearestWalkablePoint(startX, startZ, 1.2) ?? [
    startX,
    startZ,
  ];
  const [sc, sr] = toGrid(validStart[0], validStart[1]);
  const [ec, er] = toGrid(gx, gz);

  const key = (c: number, r: number) => r * COLS + c;
  const startKey = key(sc, sr);
  const endKey = key(ec, er);

  const openSet = new Set<number>([startKey]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[startKey, 0]]);
  const fScore = new Map<number, number>([
    [startKey, Math.hypot(ec - sc, er - sr)],
  ]);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  let bestNode = startKey;
  let bestHeuristic = Math.hypot(ec - sc, er - sr);
  let iterations = 0;

  while (openSet.size > 0 && iterations < 2400) {
    iterations++;
    let current = -1;
    let lowestF = Infinity;
    for (const node of openSet) {
      const f = fScore.get(node) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = node;
      }
    }

    if (current === -1) break;
    if (current === endKey) {
      bestNode = endKey;
      break;
    }

    openSet.delete(current);
    const cc = current % COLS;
    const cr = Math.floor(current / COLS);

    const hDist = Math.hypot(ec - cc, er - cr);
    if (hDist < bestHeuristic) {
      bestHeuristic = hDist;
      bestNode = current;
    }

    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

      const [wx, wz] = toWorld(nc, nr);
      if (!isPointWalkable(wx, wz, CHARACTER_RADIUS * 0.85)) continue;

      const nKey = key(nc, nr);
      const tentativeG = (gScore.get(current) ?? Infinity) + cost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + Math.hypot(ec - nc, er - nr));
        openSet.add(nKey);
      }
    }
  }

  const rawPath: Array<[number, number]> = [];
  let curr: number | undefined = bestNode;
  while (curr !== undefined && curr !== startKey) {
    const cc = curr % COLS;
    const cr = Math.floor(curr / COLS);
    rawPath.push(toWorld(cc, cr));
    curr = cameFrom.get(curr);
  }
  rawPath.reverse();
  rawPath.push([gx, gz]);

  if (rawPath.length <= 1) {
    return [[gx, gz]];
  }

  // String-pulling path smoothing
  const smoothed: Array<[number, number]> = [];
  let anchorX = startX;
  let anchorZ = startZ;
  let idx = 0;

  while (idx < rawPath.length) {
    let furthest = idx;
    for (let probe = rawPath.length - 1; probe > idx; probe--) {
      if (
        hasLineOfSight(
          anchorX,
          anchorZ,
          rawPath[probe][0],
          rawPath[probe][1],
          CHARACTER_RADIUS * 0.82
        )
      ) {
        furthest = probe;
        break;
      }
    }
    smoothed.push(rawPath[furthest]);
    anchorX = rawPath[furthest][0];
    anchorZ = rawPath[furthest][1];
    idx = furthest + 1;
  }

  return smoothed;
}

// Camera position computation: once inside the bookstore (Z <= 6.35), strictly keep camera inside the interior walls
export function computeSafeCameraPosition(
  targetX: number,
  targetY: number,
  targetZ: number,
  desiredCamX: number,
  desiredCamY: number,
  desiredCamZ: number,
  _cameraDistance: number
): [number, number, number] {
  const isCharacterOutside = targetZ > 6.35;

  // Only allow outdoor camera coordinates before the character enters the bookstore entrance
  if (isCharacterOutside) {
    const clampedX = Math.max(-4.8, Math.min(4.8, desiredCamX));
    const clampedY = Math.max(0.55, Math.min(4.2, desiredCamY));
    const clampedZ = Math.max(6.45, Math.min(12.2, desiredCamZ));
    return [clampedX, clampedY, clampedZ];
  }

  // Once inside the entrance (targetZ <= 6.35), NEVER allow the camera to exit through any wall or the entrance door
  const roomMinX = -4.12;
  const roomMaxX = 3.82;
  const roomMinZ = -6.15;
  const roomMaxZ = 6.12; // Strictly inside the entrance door & storefront wall
  const roomMaxY = 3.15; // Strictly below the terracotta ceiling
  const roomMinY = 0.55;

  const finalX = Math.max(roomMinX, Math.min(roomMaxX, desiredCamX));
  const finalY = Math.max(roomMinY, Math.min(roomMaxY, desiredCamY));
  const finalZ = Math.max(roomMinZ, Math.min(roomMaxZ, desiredCamZ));

  return [finalX, finalY, finalZ];
}
