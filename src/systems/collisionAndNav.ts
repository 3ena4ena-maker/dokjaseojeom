import { OBSTACLE_BOXES, ROOM_BOUNDS } from '../data/bookstoreData';

const CHARACTER_RADIUS = 0.34;

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

// Automatically deflects around furniture & obstacles when moving straight into them (`가구, 물건을 비켜서 직진`)
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

  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const stepLen = Math.hypot(dx, dz);
  if (stepLen < 1e-5) {
    return [currentX, currentZ, true];
  }

  // 1. Identify which obstacle box is blocking the desired step and find its open aisle side
  const pad = CHARACTER_RADIUS;
  let preferredLateralX = 0; // -1 = go West (-X), +1 = go East (+X)
  let preferredLateralZ = 0; // -1 = go North (-Z), +1 = go South (+Z)

  for (const box of OBSTACLE_BOXES) {
    if (
      clampedX >= box.minX - pad &&
      clampedX <= box.maxX + pad &&
      clampedZ >= box.minZ - pad &&
      clampedZ <= box.maxZ + pad
    ) {
      const westEdge = box.minX - pad - 0.08;
      const eastEdge = box.maxX + pad + 0.08;
      const westOpen = westEdge >= ROOM_BOUNDS.minX + pad * 0.4;
      const eastOpen = eastEdge <= ROOM_BOUNDS.maxX - pad * 0.4;

      if (eastOpen && !westOpen) {
        preferredLateralX = 1;
      } else if (westOpen && !eastOpen) {
        preferredLateralX = -1;
      } else if (westOpen && eastOpen) {
        // Storefront doorway gap is around X = 0.16; otherwise pick the closer edge
        const distWest = Math.abs(currentX - westEdge);
        const distEast = Math.abs(eastEdge - currentX);
        preferredLateralX = distWest <= distEast ? -1 : 1;
      }

      const northEdge = box.minZ - pad - 0.08;
      const southEdge = box.maxZ + pad + 0.08;
      const northOpen = northEdge >= ROOM_BOUNDS.minZ + pad * 0.4;
      const southOpen = southEdge <= ROOM_BOUNDS.maxZ - pad * 0.4;

      if (southOpen && !northOpen) {
        preferredLateralZ = 1;
      } else if (northOpen && !southOpen) {
        preferredLateralZ = -1;
      } else if (northOpen && southOpen) {
        const distNorth = Math.abs(currentZ - northEdge);
        const distSouth = Math.abs(southEdge - currentZ);
        preferredLateralZ = distNorth <= distSouth ? -1 : 1;
      }
      break;
    }
  }

  // 2. Multi-angle deflection fan (`±18° .. ±90°`) biased toward the open aisle side of the furniture
  const baseAngle = Math.atan2(dx, dz);
  // Determine which angular turn (+angle vs -angle) moves toward the open aisle
  let preferredTurnSign = 1;
  if (Math.abs(dz) >= Math.abs(dx) && preferredLateralX !== 0) {
    const testXPos = Math.sin(baseAngle + Math.PI / 3);
    preferredTurnSign =
      Math.sign(testXPos) === preferredLateralX ? 1 : -1;
  } else if (Math.abs(dx) > Math.abs(dz) && preferredLateralZ !== 0) {
    const testZPos = Math.cos(baseAngle + Math.PI / 3);
    preferredTurnSign =
      Math.sign(testZPos) === preferredLateralZ ? 1 : -1;
  } else {
    // Probe lookahead at ±55° to see which side has more open space
    const probeDist = 0.85;
    const posOpen = isPointWalkable(
      currentX + Math.sin(baseAngle + 0.95) * probeDist,
      currentZ + Math.cos(baseAngle + 0.95) * probeDist
    );
    const negOpen = isPointWalkable(
      currentX + Math.sin(baseAngle - 0.95) * probeDist,
      currentZ + Math.cos(baseAngle - 0.95) * probeDist
    );
    if (negOpen && !posOpen) preferredTurnSign = -1;
  }

  const angleDegs = [18, 34, 50, 66, 80, 92];
  for (const scale of [1.0, 0.72]) {
    for (const deg of angleDegs) {
      const rad = (deg * Math.PI) / 180;
      for (const sign of [preferredTurnSign, -preferredTurnSign]) {
        const candX = currentX + Math.sin(baseAngle + rad * sign) * stepLen * scale;
        const candZ = currentZ + Math.cos(baseAngle + rad * sign) * stepLen * scale;
        if (isPointWalkable(candX, candZ)) {
          return [candX, candZ, true];
        }
      }
    }
  }

  // 3. Fallback axis-aligned slide
  if (Math.abs(clampedX - currentX) > 1e-4 && isPointWalkable(clampedX, currentZ)) {
    return [clampedX, currentZ, true];
  }
  if (Math.abs(clampedZ - currentZ) > 1e-4 && isPointWalkable(currentX, clampedZ)) {
    return [currentX, clampedZ, true];
  }

  // 4. Direct lateral sidestep around blocking furniture face when walking dead-on perpendicular
  if (preferredLateralX !== 0) {
    const sideX = currentX + preferredLateralX * stepLen * 0.9;
    if (isPointWalkable(sideX, currentZ)) {
      return [sideX, currentZ, true];
    }
  }
  if (preferredLateralZ !== 0) {
    const sideZ = currentZ + preferredLateralZ * stepLen * 0.9;
    if (isPointWalkable(currentX, sideZ)) {
      return [currentX, sideZ, true];
    }
  }

  return [currentX, currentZ, true];
}

export function findNearestWalkablePoint(
  x: number,
  z: number,
  maxSearchRadius = 2.5,
  preferFromX?: number,
  preferFromZ?: number
): [number, number] | null {
  if (isPointWalkable(x, z)) return [x, z];

  const radialSteps = 18;
  const angleSteps = 28;
  const hasPrefer = preferFromX !== undefined && preferFromZ !== undefined;
  const basePrefAngle = hasPrefer
    ? Math.atan2(preferFromZ! - z, preferFromX! - x)
    : 0;

  for (let rIdx = 1; rIdx <= radialSteps; rIdx++) {
    const r = (rIdx / radialSteps) * maxSearchRadius;
    for (let aIdx = 0; aIdx < angleSteps; aIdx++) {
      // Alternate +/- around basePrefAngle so we always pick the side of the furniture facing the visitor
      const offsetIdx =
        aIdx % 2 === 0 ? aIdx / 2 : -Math.ceil(aIdx / 2);
      const angle =
        basePrefAngle + (offsetIdx / angleSteps) * Math.PI * 2;
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
  const steps = Math.max(2, Math.ceil(dist / 0.1));
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
const GRID_STEP = 0.22;
const GRID_MIN_X = -3.72;
const GRID_MAX_X = 3.58;
const GRID_MIN_Z = -5.45;
const GRID_MAX_Z = 10.65;

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
  const validStart = findNearestWalkablePoint(startX, startZ, 1.6) ?? [
    startX,
    startZ,
  ];
  const validGoal = findNearestWalkablePoint(
    goalX,
    goalZ,
    2.6,
    validStart[0],
    validStart[1]
  );
  if (!validGoal) return [];

  const [sx, sz] = validStart;
  const [gx, gz] = validGoal;

  // Direct line-of-sight shortcut
  if (hasLineOfSight(sx, sz, gx, gz, CHARACTER_RADIUS * 0.92)) {
    return [[gx, gz]];
  }

  const [sc, sr] = toGrid(sx, sz);
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

  while (openSet.size > 0 && iterations < 3200) {
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
      if (!isPointWalkable(wx, wz, CHARACTER_RADIUS * 0.88)) continue;

      // Prevent diagonal corner-cutting across furniture corners
      if (dc !== 0 && dr !== 0) {
        const [wx1, wz1] = toWorld(cc + dc, cr);
        const [wx2, wz2] = toWorld(cc, cr + dr);
        if (
          !isPointWalkable(wx1, wz1, CHARACTER_RADIUS * 0.82) ||
          !isPointWalkable(wx2, wz2, CHARACTER_RADIUS * 0.82)
        ) {
          continue;
        }
      }

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

  // String-pulling path smoothing so movement follows natural straight lines
  const smoothed: Array<[number, number]> = [];
  let anchorX = sx;
  let anchorZ = sz;
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
          CHARACTER_RADIUS * 0.88
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

  const minX = isCharacterOutside ? -4.6 : -4.05;
  const maxX = isCharacterOutside ? 4.6 : 3.72;
  const minZ = isCharacterOutside ? 6.4 : -6.05;
  const maxZ = isCharacterOutside ? 11.2 : 6.12;
  const minY = 0.65;
  const maxY = isCharacterOutside ? 3.8 : 3.05;

  const finalX = Math.max(minX, Math.min(maxX, desiredCamX));
  const finalY = Math.max(minY, Math.min(maxY, desiredCamY));
  const finalZ = Math.max(minZ, Math.min(maxZ, desiredCamZ));

  return [finalX, finalY, finalZ];
}
