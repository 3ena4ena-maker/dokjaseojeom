import React, { useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  GENRE_SHELVES,
  REPRESENTATIVE_BOOKS,
  SEAT_OBJECTS,
  SPACE_STORIES,
  TABLE_OBJECTS,
  WAYPOINT_NODES,
} from '../data/bookstoreData';
import {
  BookItem,
  GenreShelfData,
  SeatObjectData,
  SpaceStoryData,
  TableObjectData,
  WaypointNode,
} from '../types';
import { isPointWalkable } from '../systems/collisionAndNav';

interface BookstoreEnvironment3DProps {
  characterPos: [number, number, number];
  activeGenreShelf: GenreShelfData | null;
  nearbyBookId: string | null;
  heldBook: BookItem | null;
  tablePlacedBooks: Record<string, BookItem | null>;
  activeSeatId: string | null;
  navTarget: [number, number] | null;
  navPath: Array<[number, number]>;
  windowLampOn: boolean;
  onFloorClick: (x: number, z: number) => void;
  onSelectBook: (book: BookItem) => void;
  onSelectGenreShelf: (shelf: GenreShelfData) => void;
  onSelectSeat: (seat: SeatObjectData) => void;
  onSelectTable: (table: TableObjectData) => void;
  onSelectStory: (story: SpaceStoryData) => void;
  onSelectWaypoint: (wp: WaypointNode) => void;
}

interface DecorativeBookSpine {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

export const BookstoreEnvironment3D: React.FC<BookstoreEnvironment3DProps> = ({
  characterPos,
  activeGenreShelf,
  nearbyBookId,
  heldBook,
  tablePlacedBooks,
  activeSeatId,
  navTarget,
  navPath,
  windowLampOn,
  onFloorClick,
  onSelectBook,
  onSelectGenreShelf,
  onSelectSeat,
  onSelectTable,
  onSelectStory,
  onSelectWaypoint,
}) => {
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [hoveredWaypointId, setHoveredWaypointId] = useState<string | null>(null);
  const [floorCursor, setFloorCursor] = useState<{
    x: number;
    z: number;
    walkable: boolean;
  } | null>(null);

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (targetRingRef.current) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 5) * 0.12;
      targetRingRef.current.scale.set(s, s, 1);
    }
  });

  // Generate hundreds of decorative books to fill the 9 bays of the Right Wall 6-tier Walnut Bookcase
  const decorativeBooks = useMemo<DecorativeBookSpine[]>(() => {
    const spines: DecorativeBookSpine[] = [];
    const palette = [
      '#dfd8cc',
      '#ebe5da',
      '#c85a28',
      '#1e3a5f',
      '#2b2623',
      '#8c2d19',
      '#d4a359',
      '#3d5a45',
      '#5c4033',
      '#f4efe6',
      '#708090',
      '#a34828',
      '#243b4a',
      '#c2b280',
      '#e2725b',
    ];

    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const shelfHeights = [0.22, 0.68, 1.14, 1.58, 2.02, 2.46];
    const bayRanges: Array<[number, number]> = [
      [4.4, 5.28],
      [3.45, 4.32],
      [2.5, 3.37],
      [1.55, 2.42],
      [0.58, 1.47],
      [-1.68, -0.82],
      [-2.75, -1.76],
      [-3.82, -2.83],
      [-4.92, -3.9],
    ];

    for (const [zStart, zEnd] of bayRanges) {
      for (let sIdx = 0; sIdx < shelfHeights.length; sIdx++) {
        // Leave space on top shelf of bay 1 for Pepsi/Chilsung crates & bay 5 for Christmas Village
        if (sIdx === 5 && (zStart > 4.3 || (zStart > 0.5 && zStart < 1.5))) {
          continue;
        }
        const yBase = shelfHeights[sIdx];
        let zCursor = zStart + 0.04;
        while (zCursor < zEnd - 0.05) {
          if (rand() < 0.14) {
            zCursor += 0.08 + rand() * 0.12;
            continue;
          }
          const thickness = 0.022 + rand() * 0.026;
          const height = 0.24 + rand() * 0.11;
          const depth = 0.18 + rand() * 0.05;
          const color = palette[Math.floor(rand() * palette.length)];

          spines.push({
            position: [4.26, yBase + height / 2, zCursor + thickness / 2],
            size: [depth, height, thickness * 0.92],
            color,
          });
          zCursor += thickness + 0.003;
        }
      }
    }

    // Lower shelves of Room-Divider Cabinet
    let xCursor = -4.25;
    while (xCursor < -1.8) {
      const thickness = 0.028 + rand() * 0.025;
      const height = 0.26 + rand() * 0.08;
      const color = palette[Math.floor(rand() * palette.length)];
      spines.push({
        position: [xCursor, 0.22 + height / 2, -0.05],
        size: [thickness * 0.9, height, 0.22],
        color,
      });
      if (rand() > 0.2) {
        spines.push({
          position: [xCursor, 0.68 + height / 2, -0.05],
          size: [thickness * 0.9, height * 0.92, 0.22],
          color: palette[Math.floor(rand() * palette.length)],
        });
      }
      xCursor += thickness + 0.004;
    }

    return spines;
  }, []);

  const handleFloorPointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleFloorPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!pointerDownPosRef.current) return;
    const moveDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    pointerDownPosRef.current = null;
    if (moveDist > 7) return;
    e.stopPropagation();

    const hitX = e.point.x;
    const hitZ = e.point.z;
    if (isPointWalkable(hitX, hitZ)) {
      onFloorClick(hitX, hitZ);
    }
  };

  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const hitX = e.point.x;
    const hitZ = e.point.z;
    setFloorCursor({
      x: hitX,
      z: hitZ,
      walkable: isPointWalkable(hitX, hitZ),
    });
  };

  const placedBookIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(tablePlacedBooks).forEach((b) => {
      if (b) set.add(b.id);
    });
    return set;
  }, [tablePlacedBooks]);

  return (
    <group>
      {/* ============================================================
          1. LIGHTING & TERRACOTTA CEILING AMBIENCE
         ============================================================ */}
      <ambientLight intensity={0.78} color="#ffeedd" />
      <hemisphereLight
        color="#e58450"
        groundColor="#3e352f"
        intensity={0.7}
      />

      {/* Outdoor Street Daylight / Warm Dusk Light */}
      <directionalLight
        position={[-2, 7.5, 13]}
        intensity={0.85}
        color="#fff5e6"
      />

      {/* Main Front Chandelier Warm Point Light */}
      <pointLight
        position={[0.25, 2.52, 3.05]}
        intensity={2.65}
        distance={12}
        decay={1.35}
        color="#ffbb77"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Right-Wall Recommendation Table & Corridor Warm Light */}
      <pointLight
        position={[1.8, 2.65, 0.15]}
        intensity={1.75}
        distance={9.5}
        decay={1.45}
        color="#ffcaa0"
      />
      {/* Back Hall, Leather Workshop & Wine/Leather Shelf Light */}
      <pointLight
        position={[0.5, 2.8, -3.5]}
        intensity={1.95}
        distance={11}
        decay={1.45}
        color="#fff0dd"
      />
      {/* Window Orange Lamp Point Light */}
      {windowLampOn && (
        <pointLight
          position={[-2.85, 1.15, 5.75]}
          intensity={1.3}
          distance={4.2}
          color="#ff7722"
        />
      )}
      {/* Duck Mascot Fairy-Light Tree Glow */}
      <pointLight
        position={[-3.55, 1.1, 0.55]}
        intensity={1.1}
        distance={3.8}
        color="#ffd27d"
      />

      {/* ============================================================
          2. OUTDOOR ROAD, SIDEWALK, STEPS & TREES (Z = +6.6..+11.5)
         ============================================================ */}
      <group>
        {/* Walkable Asphalt Road Surface */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.18, 9.2]}
          receiveShadow
          onPointerDown={handleFloorPointerDown}
          onPointerUp={handleFloorPointerUp}
          onPointerMove={handleFloorPointerMove}
          onPointerOut={() => setFloorCursor(null)}
        >
          <planeGeometry args={[12.5, 4.8]} />
          <meshStandardMaterial color="#32353a" roughness={0.92} />
        </mesh>

        {/* Yellow Curb / Road Line (visible in exterior photo KakaoTalk_261106_113955_21.jpg) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.172, 7.95]}>
          <planeGeometry args={[12.5, 0.14]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>

        {/* Concrete Sidewalk & 2-Step Stone Stairs leading into '독자' Entrance */}
        {/* Lower Stone Step */}
        <mesh
          position={[0, -0.135, 7.25]}
          receiveShadow
          onPointerDown={handleFloorPointerDown}
          onPointerUp={handleFloorPointerUp}
          onPointerMove={handleFloorPointerMove}
        >
          <boxGeometry args={[9.4, 0.09, 0.65]} />
          <meshStandardMaterial color="#8c8881" roughness={0.88} />
        </mesh>
        {/* Upper Stone Step / Threshold */}
        <mesh
          position={[0, -0.045, 6.82]}
          receiveShadow
          onPointerDown={handleFloorPointerDown}
          onPointerUp={handleFloorPointerUp}
          onPointerMove={handleFloorPointerMove}
        >
          <boxGeometry args={[9.4, 0.09, 0.52]} />
          <meshStandardMaterial color="#9e9a93" roughness={0.85} />
        </mesh>

        {/* White & Mint 'PP' Sacks by the Left Brick Pillar (exact match to exterior photo!) */}
        <group position={[-3.35, 0, 6.88]}>
          {/* Mint Green Sack */}
          <mesh position={[0.18, 0.28, -0.05]} rotation={[0, 0, 0.08]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.56, 12]} />
            <meshStandardMaterial color="#6ee7b7" roughness={0.75} />
          </mesh>
          {/* White & Red 'PP' Sack */}
          <mesh position={[-0.08, 0.22, 0.06]} rotation={[0, 0.2, -0.05]} castShadow>
            <cylinderGeometry args={[0.17, 0.2, 0.44, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </mesh>
          <mesh position={[-0.08, 0.28, 0.25]}>
            <planeGeometry args={[0.22, 0.1]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        </group>

        {/* Across-the-Street White Guardrail & Green Street Trees */}
        <group position={[0, -0.18, 11.2]}>
          {/* White Guardrail Fence */}
          {[-4.5, -3.0, -1.5, 0, 1.5, 3.0, 4.5].map((px, i) => (
            <mesh key={i} position={[px, 0.42, 0]}>
              <boxGeometry args={[0.06, 0.84, 0.06]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>
          ))}
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[10.5, 0.05, 0.05]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[10.5, 0.04, 0.05]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
          {/* Lush Street Trees */}
          {[-3.6, 0.4, 3.8].map((tx, idx) => (
            <group key={idx} position={[tx, 0, 0.45]}>
              <mesh position={[0, 1.3, 0]}>
                <cylinderGeometry args={[0.14, 0.18, 2.6, 10]} />
                <meshStandardMaterial color="#4a3728" roughness={0.9} />
              </mesh>
              <mesh position={[0, 2.8, 0]}>
                <sphereGeometry args={[1.15, 14, 14]} />
                <meshStandardMaterial color="#2e5a36" roughness={0.85} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* ============================================================
          3. INTERIOR FLOOR, TERRACOTTA CEILING, WALLS & CARPETS
         ============================================================ */}
      {/* Interactive Walkable Concrete/Stone Interior Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerDown={handleFloorPointerDown}
        onPointerUp={handleFloorPointerUp}
        onPointerMove={handleFloorPointerMove}
        onPointerOut={() => setFloorCursor(null)}
      >
        <planeGeometry args={[9.2, 13.6]} />
        <meshStandardMaterial color="#6e675f" roughness={0.88} metalness={0.05} />
      </mesh>

      {/* Subtle Concrete Tile Grout Lines */}
      <gridHelper
        args={[13.6, 17, '#575049', '#5c554e']}
        position={[0, 0.003, 0]}
      />

      {/* Front Red/Burgundy Ornate Persian Rug (under chandelier) */}
      <group position={[0.15, 0.008, 3.15]}>
        {/* Outer Cream Fringe Border */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[4.2, 3.25]} />
          <meshStandardMaterial color="#d8c3a5" roughness={0.92} />
        </mesh>
        {/* Burgundy Frame */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[3.85, 2.9]} />
          <meshStandardMaterial color="#7c1d1d" roughness={0.9} />
        </mesh>
        {/* Gold Floral Inner Border */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[3.28, 2.35]} />
          <meshStandardMaterial color="#c9b086" roughness={0.9} />
        </mesh>
        {/* Deep Crimson Center Field */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[2.98, 2.05]} />
          <meshStandardMaterial color="#6b1414" roughness={0.9} />
        </mesh>
        {/* Center Floral Medallion & Corner Accents */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <circleGeometry args={[0.54, 24]} />
          <meshStandardMaterial color="#cbb288" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
          <circleGeometry args={[0.28, 20]} />
          <meshStandardMaterial color="#7c1d1d" roughness={0.9} />
        </mesh>
      </group>

      {/* Back Navy/Gold Persian Rug (in front of back bookshelves) */}
      <group position={[1.85, 0.008, -3.55]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.2, 3.8]} />
          <meshStandardMaterial color="#c5b088" roughness={0.92} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[2.8, 3.4]} />
          <meshStandardMaterial color="#19212e" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[2.3, 2.85]} />
          <meshStandardMaterial color="#b39b6e" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[2.05, 2.6]} />
          <meshStandardMaterial color="#141a24" roughness={0.9} />
        </mesh>
      </group>

      {/* Black Entrance Doormat just inside the doorway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.25, 0.01, 5.95]}>
        <planeGeometry args={[1.38, 0.72]} />
        <meshStandardMaterial color="#27272a" roughness={0.95} />
      </mesh>

      {/* Signature Terracotta Burnt-Orange Ceiling (single-sided facing down so zooming out wide above the room sees right inside!) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.45, 0]}>
        <planeGeometry args={[9.2, 13.6]} />
        <meshStandardMaterial color="#c85a28" roughness={0.72} />
      </mesh>
      {/* Warm Caustic Light Glow Rings on Terracotta Ceiling above Chandelier */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.25, 3.44, 3.05]}>
        <ringGeometry args={[0.45, 1.25, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.25, 3.442, 3.05]}>
        <ringGeometry args={[1.35, 1.95, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.12} />
      </mesh>
      {/* Ceiling Structural Beam across middle */}
      <mesh position={[0, 3.35, 0.1]}>
        <boxGeometry args={[9.2, 0.2, 0.32]} />
        <meshStandardMaterial color="#bd5122" roughness={0.8} />
      </mesh>
      {/* Ceiling AC Cassette in middle-back */}
      <mesh position={[-0.2, 3.41, -1.8]}>
        <boxGeometry args={[1.1, 0.08, 1.1]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
      </mesh>

      {/* ============================================================
          4. ULTRA-DETAILED 6-ARM GOLD CRYSTAL CHANDELIER & PENDANTS
         ============================================================ */}
      <group
        position={[0.25, 2.72, 3.05]}
        onClick={(e) => {
          e.stopPropagation();
          const st = SPACE_STORIES.find((s) => s.id === 'story_chandelier');
          if (st) onSelectStory(st);
        }}
        onPointerOver={() => setHoveredStoryId('story_chandelier')}
        onPointerOut={() => setHoveredStoryId(null)}
      >
        {/* Brass Ceiling Rose Canopy */}
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.11, 0.08, 0.06, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.18} />
        </mesh>
        {/* Multi-link Chain */}
        {[0.58, 0.48, 0.38].map((cy, idx) => (
          <mesh
            key={idx}
            position={[0, cy, 0]}
            rotation={[0, (idx * Math.PI) / 2, 0]}
          >
            <torusGeometry args={[0.025, 0.006, 8, 14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.2} />
          </mesh>
        ))}
        {/* Upper Crown Ring (where crystal bead garlands attach) */}
        <mesh position={[0, 0.29, 0]}>
          <cylinderGeometry args={[0.12, 0.06, 0.08, 18]} />
          <meshStandardMaterial color="#e5c158" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Ornate Central Baluster Column */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.045, 0.085, 0.42, 18]} />
          <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.18, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.18} />
        </mesh>
        {/* Lower Finial & Faceted Crystal Ball Drop */}
        <mesh position={[0, -0.31, 0]}>
          <coneGeometry args={[0.035, 0.14, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.88} roughness={0.18} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <octahedronGeometry args={[0.055, 1]} />
          <meshStandardMaterial
            color="#fffbeb"
            emissive="#fde68a"
            emissiveIntensity={0.6}
            roughness={0.1}
          />
        </mesh>

        {/* 6 Double S-Scroll Arms, Candle Bulbs, Teardrop Prisms & Catenary Crystal Bead Garlands */}
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const angle = (idx / 6) * Math.PI * 2;
          const nextAngle = ((idx + 1) / 6) * Math.PI * 2;
          const armRadius = 0.56;
          const ax = Math.cos(angle) * armRadius;
          const az = Math.sin(angle) * armRadius;
          const nx = Math.cos(nextAngle) * armRadius;
          const nz = Math.sin(nextAngle) * armRadius;

          return (
            <group key={idx}>
              {/* Main Lower Curved Brass Arm */}
              <mesh
                position={[ax * 0.5, -0.09, az * 0.5]}
                rotation={[0, -angle, Math.PI / 2 - 0.12]}
              >
                <cylinderGeometry args={[0.013, 0.015, armRadius, 10]} />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.88}
                  roughness={0.18}
                />
              </mesh>
              {/* Decorative Upper Scroll Filigree Loop */}
              <mesh
                position={[ax * 0.42, 0.02, az * 0.42]}
                rotation={[0, -angle + Math.PI / 2, 0]}
              >
                <torusGeometry args={[0.09, 0.008, 8, 18]} />
                <meshStandardMaterial
                  color="#e5c158"
                  metalness={0.88}
                  roughness={0.2}
                />
              </mesh>
              <mesh
                position={[ax * 0.68, -0.16, az * 0.68]}
                rotation={[0, -angle + Math.PI / 2, 0]}
              >
                <torusGeometry args={[0.075, 0.008, 8, 18]} />
                <meshStandardMaterial
                  color="#e5c158"
                  metalness={0.88}
                  roughness={0.2}
                />
              </mesh>

              {/* Scalloped Brass Bobeche (Drip Dish) */}
              <mesh position={[ax, 0.01, az]}>
                <cylinderGeometry args={[0.072, 0.032, 0.032, 16]} />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.9}
                  roughness={0.16}
                />
              </mesh>
              {/* Ivory Candle Sleeve */}
              <mesh position={[ax, 0.11, az]}>
                <cylinderGeometry args={[0.021, 0.021, 0.17, 12]} />
                <meshStandardMaterial color="#fdf6e2" roughness={0.4} />
              </mesh>
              {/* Warm Flame-Tip Bulb */}
              <mesh position={[ax, 0.23, az]}>
                <coneGeometry args={[0.034, 0.095, 12]} />
                <meshBasicMaterial color="#fff6b3" />
              </mesh>
              <mesh position={[ax, 0.2, az]}>
                <sphereGeometry args={[0.035, 12, 12]} />
                <meshBasicMaterial color="#ffe57f" />
              </mesh>

              {/* Hanging Teardrop Crystal Prisms under Bobeche */}
              {[-0.04, 0, 0.04].map((offset, pIdx) => (
                <mesh
                  key={pIdx}
                  position={[
                    ax + Math.sin(angle) * offset,
                    -0.065,
                    az - Math.cos(angle) * offset,
                  ]}
                >
                  <octahedronGeometry args={[0.022, 0]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    emissive="#fde68a"
                    emissiveIntensity={0.7}
                  />
                </mesh>
              ))}

              {/* Radial Catenary Crystal Bead Garland (from Top Crown to Arm Tip) */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
                const t = step / 9;
                const bx = Math.cos(angle) * (0.09 + (armRadius - 0.09) * t);
                const bz = Math.sin(angle) * (0.09 + (armRadius - 0.09) * t);
                const sag = Math.sin(t * Math.PI) * 0.11;
                const by = 0.28 * (1 - t) + 0.02 * t - sag;
                return (
                  <mesh key={`rad-${step}`} position={[bx, by, bz]}>
                    <sphereGeometry args={[0.014, 8, 8]} />
                    <meshBasicMaterial color="#fffbeb" />
                  </mesh>
                );
              })}

              {/* Perimeter Swag Crystal Bead Garland (between adjacent arms) */}
              {[1, 2, 3, 4, 5, 6].map((step) => {
                const t = step / 7;
                const bx = ax * (1 - t) + nx * t;
                const bz = az * (1 - t) + nz * t;
                const sag = Math.sin(t * Math.PI) * 0.09;
                const by = 0.01 - sag;
                return (
                  <mesh key={`swag-${step}`} position={[bx, by, bz]}>
                    <sphereGeometry args={[0.012, 8, 8]} />
                    <meshBasicMaterial color="#fef3c7" />
                  </mesh>
                );
              })}
            </group>
          );
        })}

        {hoveredStoryId === 'story_chandelier' && (
          <Html position={[0, -0.58, 0]} center zIndexRange={[5, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
              ✨ [클릭 / E] 6구 골드 크리스탈 샹들리에 & 테라코타 천장
            </div>
          </Html>
        )}
      </group>

      {/* Faceted Crystal Pendant Lights around shelves */}
      {[
        [-3.6, 2.55, 3.8],
        [-3.6, 2.55, 1.5],
        [3.35, 2.55, 4.4],
        [3.35, 2.55, 1.6],
        [3.35, 2.55, -1.5],
      ].map(([lx, ly, lz], i) => (
        <group key={i} position={[lx, ly, lz]}>
          <mesh position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.04, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.82, 6]} />
            <meshBasicMaterial color="#3f3f46" />
          </mesh>
          <mesh>
            <octahedronGeometry args={[0.115, 1]} />
            <meshStandardMaterial
              color="#fffbeb"
              emissive="#fde68a"
              emissiveIntensity={0.88}
              roughness={0.12}
            />
          </mesh>
        </group>
      ))}

      {/* ============================================================
          5. STOREFRONT ENTRANCE WALL & OPEN DOUBLE DOORS (South Z = +6.6)
         ============================================================ */}
      <group position={[0, 0, 6.6]}>
        {/* Red Brick Left & Right Columns */}
        <mesh position={[-4.15, 1.72, 0]} castShadow>
          <boxGeometry args={[0.92, 3.45, 0.36]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>
        <mesh position={[4.15, 1.72, 0]} castShadow>
          <boxGeometry args={[0.92, 3.45, 0.36]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>

        {/* Top Brick Facade Header & Soldier Brick Lintel */}
        <mesh position={[0, 3.16, 0]}>
          <boxGeometry args={[8.4, 0.58, 0.36]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.82, 0.02]}>
          <boxGeometry args={[7.5, 0.16, 0.38]} />
          <meshStandardMaterial color="#732819" roughness={0.88} />
        </mesh>

        {/* 3D White '독자' Exterior Sign on the Red Brick Header */}
        <group position={[0.15, 3.16, 0.2]}>
          {/* Spotlight Fixture above '독자' */}
          <mesh position={[0, 0.24, 0.04]}>
            <boxGeometry args={[0.24, 0.05, 0.08]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* '독' 3D Strokes */}
          <mesh position={[-0.28, 0, 0]}>
            <boxGeometry args={[0.28, 0.26, 0.04]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fffbeb"
              emissiveIntensity={0.35}
            />
          </mesh>
          {/* '자' 3D Strokes */}
          <mesh position={[0.28, 0, 0]}>
            <boxGeometry args={[0.28, 0.26, 0.04]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fffbeb"
              emissiveIntensity={0.35}
            />
          </mesh>
        </group>

        {/* Glass Storefront Windows Left & Right of the Open Doorway */}
        <mesh position={[-2.25, 1.38, 0.02]}>
          <planeGeometry args={[2.9, 2.72]} />
          <meshStandardMaterial
            color="#47594e"
            transparent
            opacity={0.28}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[2.4, 1.38, 0.02]}>
          <planeGeometry args={[2.75, 2.72]} />
          <meshStandardMaterial
            color="#47594e"
            transparent
            opacity={0.28}
            roughness={0.2}
          />
        </mesh>

        {/* Open Vintage Distressed White/Wood Double Entrance Doors (Walkable Open Passage!) */}
        <group
          position={[0.15, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            const st = SPACE_STORIES.find((s) => s.id === 'story_entrance');
            if (st) onSelectStory(st);
          }}
          onPointerOver={() => setHoveredStoryId('story_entrance')}
          onPointerOut={() => setHoveredStoryId(null)}
        >
          {/* Left & Right Door Frame Posts */}
          <mesh position={[-0.82, 1.38, 0]}>
            <boxGeometry args={[0.1, 2.76, 0.16]} />
            <meshStandardMaterial color="#c9bca8" roughness={0.8} />
          </mesh>
          <mesh position={[0.82, 1.38, 0]}>
            <boxGeometry args={[0.1, 2.76, 0.16]} />
            <meshStandardMaterial color="#c9bca8" roughness={0.8} />
          </mesh>

          {/* Left Door Leaf — Swung Open Invitingly! */}
          <group position={[-0.78, 0, 0]} rotation={[0, 1.18, 0]}>
            <mesh position={[0.38, 1.32, 0]}>
              <boxGeometry args={[0.76, 2.64, 0.07]} />
              <meshStandardMaterial color="#d4c7b4" roughness={0.82} />
            </mesh>
            <mesh position={[0.38, 1.55, 0]}>
              <boxGeometry args={[0.56, 1.58, 0.08]} />
              <meshStandardMaterial
                color="#334139"
                transparent
                opacity={0.45}
              />
            </mesh>
            {/* '책값 돌려주기' Poster on Left Door Glass */}
            <mesh position={[0.45, 0.98, 0.045]}>
              <planeGeometry args={[0.28, 0.38]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
          </group>

          {/* Right Door Leaf — Swung Open Invitingly! */}
          <group position={[0.78, 0, 0]} rotation={[0, -1.18, 0]}>
            <mesh position={[-0.38, 1.32, 0]}>
              <boxGeometry args={[0.76, 2.64, 0.07]} />
              <meshStandardMaterial color="#d4c7b4" roughness={0.82} />
            </mesh>
            <mesh position={[-0.38, 1.55, 0]}>
              <boxGeometry args={[0.56, 1.58, 0.08]} />
              <meshStandardMaterial
                color="#334139"
                transparent
                opacity={0.45}
              />
            </mesh>
            {/* Wooden Sign '딤프치' on Handle */}
            <mesh position={[-0.66, 1.4, 0.05]}>
              <boxGeometry args={[0.12, 0.42, 0.03]} />
              <meshStandardMaterial color="#d9a066" roughness={0.7} />
            </mesh>
          </group>

          <Html position={[0, 2.62, 0.12]} center zIndexRange={[5, 0]}>
            <div
              className={`pointer-events-none rounded-lg px-2.5 py-0.5 text-[11px] font-serif tracking-widest transition-all ${
                hoveredStoryId === 'story_entrance'
                  ? 'bg-[#c85a28] text-white shadow-lg'
                  : 'bg-[#1c1613]/85 text-[#f5efe6] border border-[#d4af37]/40'
              }`}
            >
              독 자 (DOKJA) · 딤프치 출입문
            </div>
          </Html>
        </group>

        {/* Sheer Floral Lace Curtains (Left & Right Windows) */}
        <mesh position={[-1.25, 1.45, -0.12]} rotation={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.18, 0.35, 2.75, 12]} />
          <meshStandardMaterial
            color="#f5ebe1"
            transparent
            opacity={0.78}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[3.35, 1.45, -0.12]} rotation={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.22, 0.38, 2.75, 12]} />
          <meshStandardMaterial
            color="#f5ebe1"
            transparent
            opacity={0.78}
            roughness={0.9}
          />
        </mesh>

        {/* Potted Plants & 8 Wine Bottles by the Right Window Curtain */}
        <group position={[2.85, 0, -0.45]}>
          {/* Ceramic Plant Pot 1 (Broad-leaf Monstera/Alocasia) */}
          <mesh position={[0.32, 0.24, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.18, 0.48, 16]} />
            <meshStandardMaterial color="#9c8c78" roughness={0.85} />
          </mesh>
          <mesh position={[0.32, 0.85, 0]}>
            <sphereGeometry args={[0.36, 12, 12]} />
            <meshStandardMaterial color="#3f6a34" roughness={0.75} />
          </mesh>
          {/* Ceramic Plant Pot 2 */}
          <mesh position={[-0.22, 0.2, 0.1]} castShadow>
            <cylinderGeometry args={[0.18, 0.14, 0.4, 16]} />
            <meshStandardMaterial color="#d6d3cd" roughness={0.6} />
          </mesh>
          <mesh position={[-0.22, 0.65, 0.1]}>
            <sphereGeometry args={[0.28, 10, 10]} />
            <meshStandardMaterial color="#4d7c3f" roughness={0.75} />
          </mesh>
          {/* Ceramic Plant Pot 3 */}
          <mesh position={[0.62, 0.18, -0.15]} castShadow>
            <cylinderGeometry args={[0.15, 0.12, 0.36, 14]} />
            <meshStandardMaterial color="#b48a64" roughness={0.75} />
          </mesh>
          {/* 8 Dark Wine Bottles with Labels lined up on the floor */}
          {[-0.72, -0.59, -0.46, -0.33, -0.2, -0.65, -0.52, -0.39].map(
            (bx, i) => (
              <group
                key={i}
                position={[bx, 0.16, i >= 5 ? -0.18 : -0.05]}
              >
                <mesh castShadow>
                  <cylinderGeometry args={[0.036, 0.038, 0.32, 10]} />
                  <meshStandardMaterial
                    color="#182218"
                    roughness={0.2}
                    metalness={0.3}
                  />
                </mesh>
                <mesh position={[0, -0.02, -0.037]}>
                  <planeGeometry args={[0.045, 0.09]} />
                  <meshBasicMaterial
                    color={i % 3 === 0 ? '#dc2626' : '#f5ebd6'}
                  />
                </mesh>
              </group>
            )
          )}
        </group>
      </group>

      {/* ============================================================
          6. WINDOW READING DESK, BOOK CART & WOODEN ARMCHAIR (Front-Left)
         ============================================================ */}
      {(() => {
        const deskData = TABLE_OBJECTS.find(
          (t) => t.id === 'table_window_desk'
        )!;
        const chairData = SEAT_OBJECTS.find(
          (s) => s.id === 'seat_window_chair'
        )!;
        const placedBook = tablePlacedBooks['table_window_desk'];
        const isChairActive = activeSeatId === 'seat_window_chair';

        return (
          <group>
            {/* Rolling Book Cart / Trolley with White Lighthouse & Umbrella Stand next to door */}
            <group position={[-1.38, 0, 5.75]}>
              <mesh position={[0, 0.42, 0]} castShadow>
                <boxGeometry args={[0.62, 0.68, 0.48]} />
                <meshStandardMaterial color="#eab308" roughness={0.6} />
              </mesh>
              <mesh position={[0, 0.78, 0]} castShadow>
                <boxGeometry args={[0.66, 0.04, 0.52]} />
                <meshStandardMaterial color="#27272a" />
              </mesh>
              {/* White Lighthouse Figurine on Cart */}
              <mesh position={[0.18, 0.9, -0.1]}>
                <cylinderGeometry args={[0.03, 0.05, 0.22, 10]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
              {/* Black Umbrella Stand & Red Umbrella */}
              <mesh position={[0.38, 0.22, -0.18]}>
                <cylinderGeometry args={[0.1, 0.1, 0.44, 12]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0.38, 0.48, -0.18]} rotation={[0, 0, -0.08]}>
                <cylinderGeometry args={[0.025, 0.04, 0.65, 10]} />
                <meshStandardMaterial color="#dc2626" />
              </mesh>
            </group>

            {/* Window Wooden Desk */}
            <group
              position={[-2.45, 0, 5.85]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(deskData);
              }}
              onPointerOver={() => setHoveredTableId(deskData.id)}
              onPointerOut={() => setHoveredTableId(null)}
            >
              <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.45, 0.06, 0.72]} />
                <meshStandardMaterial color="#8b5a2b" roughness={0.7} />
              </mesh>
              {[
                [-0.65, 0.37, -0.3],
                [0.65, 0.37, -0.3],
                [-0.65, 0.37, 0.3],
                [0.65, 0.37, 0.3],
              ].map(([lx, ly, lz], idx) => (
                <mesh key={idx} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.06, 0.74, 0.06]} />
                  <meshStandardMaterial color="#6e441f" roughness={0.75} />
                </mesh>
              ))}
              {/* Signature Orange Mushroom Lamp */}
              <group position={[-0.45, 0.77, 0.05]}>
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.03, 0.065, 0.24, 12]} />
                  <meshStandardMaterial color="#ea580c" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.24, 0]}>
                  <sphereGeometry
                    args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]}
                  />
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#ea580c"
                    emissiveIntensity={windowLampOn ? 0.65 : 0.1}
                  />
                </mesh>
              </group>
              {/* Small Black Screen / Monitor on Desk */}
              <mesh position={[0.12, 0.92, 0.12]}>
                <boxGeometry args={[0.48, 0.3, 0.03]} />
                <meshStandardMaterial color="#18181b" roughness={0.4} />
              </mesh>
            </group>

            {placedBook && (
              <group
                position={deskData.bookPlacePosition}
                rotation={[-Math.PI / 2, 0, 0.2]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBook(placedBook);
                }}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.2, 0.27, 0.04]} />
                  <meshStandardMaterial color={placedBook.coverColor} />
                </mesh>
              </group>
            )}

            {/* Mid-Century Wooden Reading Armchair */}
            <group
              position={chairData.seatPosition}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(chairData);
              }}
              onPointerOver={() => setHoveredSeatId(chairData.id)}
              onPointerOut={() => setHoveredSeatId(null)}
            >
              <mesh position={[0, 0.44, 0]} castShadow>
                <boxGeometry args={[0.52, 0.07, 0.5]} />
                <meshStandardMaterial
                  color={
                    hoveredSeatId === chairData.id || isChairActive
                      ? '#3f3f46'
                      : '#1c1917'
                  }
                  roughness={0.7}
                />
              </mesh>
              <mesh position={[0, 0.72, -0.22]} castShadow>
                <boxGeometry args={[0.54, 0.22, 0.05]} />
                <meshStandardMaterial color="#7c4a21" roughness={0.65} />
              </mesh>
              {[
                [-0.22, 0.22, -0.21],
                [0.22, 0.22, -0.21],
                [-0.22, 0.22, 0.21],
                [0.22, 0.22, 0.21],
              ].map(([lx, ly, lz], i) => (
                <mesh key={i} position={[lx, ly, lz]} castShadow>
                  <cylinderGeometry args={[0.022, 0.018, 0.44, 8]} />
                  <meshStandardMaterial color="#6e411c" />
                </mesh>
              ))}
              {hoveredSeatId === chairData.id && (
                <Html position={[0, 1.05, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    🪑 [클릭 / E] 창가 독서 의자에 앉기
                  </div>
                </Html>
              )}
            </group>
          </group>
        );
      })()}

      {/* ============================================================
          7. LEFT WALL: RUSTIC WOOD PLANKS, MONITORS & 3-TIER LEDGES
         ============================================================ */}
      <group>
        {/* Front-Left Rustic Horizontal Wood Plank Wall (Z = +0.5..+6.6) */}
        <mesh position={[-4.5, 1.72, 3.55]} receiveShadow>
          <boxGeometry args={[0.2, 3.45, 6.1]} />
          <meshStandardMaterial color="#6e4726" roughness={0.85} />
        </mesh>
        {/* Multi-tone Reclaimed Wood Plank Strips */}
        {[0.3, 0.65, 1.0, 1.35, 1.7, 2.05, 2.4, 2.75, 3.1].map((py, idx) => (
          <mesh key={idx} position={[-4.39, py, 3.3]}>
            <boxGeometry args={[0.022, 0.22, 5.4]} />
            <meshStandardMaterial
              color={
                idx % 3 === 0
                  ? '#5a381c'
                  : idx % 3 === 1
                  ? '#7d522d'
                  : '#4d2f16'
              }
              roughness={0.85}
            />
          </mesh>
        ))}

        {/* Rounded-Rectangle Wall Mirror & Small Shadowbox Frame on Left End (113957_81.jpg) */}
        <group position={[-4.36, 1.82, 5.05]}>
          <mesh>
            <boxGeometry args={[0.08, 0.48, 0.34]} />
            <meshStandardMaterial color="#a67c52" roughness={0.6} />
          </mesh>
          <mesh position={[0.042, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.28, 0.42]} />
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
        </group>

        {/* Two Wide Flat-Screen Monitors Showing Tokyo Street Scenes */}
        {[3.9, 2.1].map((mz, idx) => (
          <group key={idx} position={[-4.36, 2.38, mz]}>
            <mesh>
              <boxGeometry args={[0.06, 0.72, 1.38]} />
              <meshStandardMaterial color="#18181b" roughness={0.4} />
            </mesh>
            <mesh position={[0.032, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.3, 0.64]} />
              <meshStandardMaterial
                color={idx === 0 ? '#385868' : '#4a3d36'}
                emissive={idx === 0 ? '#1e3a4c' : '#3b2820'}
                emissiveIntensity={0.65}
              />
            </mesh>
          </group>
        ))}

        {/* Small Framed Dokja Storefront Photo on Wood Wall (113957_71.jpg) */}
        <group position={[-4.37, 2.05, 1.15]}>
          <mesh>
            <boxGeometry args={[0.04, 0.32, 0.32]} />
            <meshStandardMaterial color="#a67c52" />
          </mesh>
          <mesh position={[0.022, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.26, 0.26]} />
            <meshBasicMaterial color="#b45309" />
          </mesh>
        </group>

        {/* 3-Tier Floating Wooden Book Display Ledges (Z = +1.1..+4.9) */}
        {[0.5, 1.05, 1.55].map((ly, idx) => (
          <group key={idx} position={[-4.24, ly, 3.0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.32, 0.05, 3.8]} />
              <meshStandardMaterial color="#593318" roughness={0.7} />
            </mesh>
            <mesh position={[-0.12, -0.08, 0]}>
              <boxGeometry args={[0.06, 0.14, 3.8]} />
              <meshStandardMaterial color="#4a2912" roughness={0.75} />
            </mesh>
          </group>
        ))}

        {/* Decorative Face-Out Books & Objects on Left Wall Ledges (113957_71.jpg, 81.jpg) */}
        {/* Rabbit Clock on Top Left Ledge */}
        <group position={[-4.22, 1.66, 4.72]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 14]} />
            <meshStandardMaterial color="#e5d5c0" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
        </group>
        {/* Minimalist Tall Black Bar Lamp on Top Right Ledge */}
        <group position={[-4.2, 1.65, 1.25]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.08, 12]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.34, 8]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
        </group>
        {/* Ceramic Pitcher & White Bust Figurine on Middle Ledge */}
        <mesh position={[-4.2, 1.13, 2.3]}>
          <cylinderGeometry args={[0.035, 0.045, 0.1, 10]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[-4.2, 1.13, 2.18]}>
          <boxGeometry args={[0.04, 0.11, 0.04]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* Additional TASCHEN City Books (Berlin, Rome, Vienna) on Bottom Ledge */}
        {[
          [4.65, '#3b82f6'],
          [4.25, '#a8896c'],
          [3.15, '#64748b'],
        ].map(([bz, col], idx) => (
          <mesh
            key={idx}
            position={[-4.22, 0.65, Number(bz)]}
            rotation={[-0.15, Math.PI / 2, 0]}
            castShadow
          >
            <boxGeometry args={[0.22, 0.29, 0.04]} />
            <meshStandardMaterial color={String(col)} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ============================================================
          8. WHITE DUCK MASCOT, FAIRY TREE, WOODEN BENCH & DIVIDER SHELF
         ============================================================ */}
      {/* Plump White Duck Mascot on White Pedestal + Cork Roll + Fairy-Light Tree */}
      <group
        position={[-3.68, 0, 0.62]}
        onClick={(e) => {
          e.stopPropagation();
          const st = SPACE_STORIES.find((s) => s.id === 'story_duck_mascot');
          if (st) onSelectStory(st);
        }}
        onPointerOver={() => setHoveredStoryId('story_duck_mascot')}
        onPointerOut={() => setHoveredStoryId(null)}
      >
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.44, 16]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </mesh>
        {/* Cork Cylinder Roll & Mini Plant Pot next to Duck (113956_31.jpg) */}
        <mesh position={[-0.25, 0.2, 0.25]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.4, 12]} />
          <meshStandardMaterial color="#b48456" roughness={0.9} />
        </mesh>
        <mesh position={[-0.18, 0.08, 0.38]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color="#3f6212" />
        </mesh>

        {/* Plump White Duck Body */}
        <mesh position={[0, 0.58, 0]} castShadow>
          <sphereGeometry args={[0.27, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.75} />
        </mesh>
        {/* Orange Duck Beak */}
        <mesh position={[0.18, 0.64, 0.16]} rotation={[0.2, 0.6, 0]}>
          <coneGeometry args={[0.055, 0.12, 12]} />
          <meshStandardMaterial color="#ea580c" roughness={0.5} />
        </mesh>
        {/* Duck Eyes */}
        <mesh position={[0.12, 0.68, 0.21]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial color="#18181b" />
        </mesh>
        <mesh position={[0.21, 0.68, 0.1]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshBasicMaterial color="#18181b" />
        </mesh>
        {/* Dangling Orange Webbed Feet */}
        <mesh position={[0.12, 0.26, 0.16]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.22, 0.02]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>
        <mesh position={[0.2, 0.26, 0.04]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.22, 0.02]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>

        {/* Glowing Fairy-Light Tree behind Duck */}
        <mesh position={[0.12, 0.65, -0.22]}>
          <cylinderGeometry args={[0.018, 0.03, 1.3, 8]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        {[
          [0.05, 1.15, -0.18],
          [0.22, 1.25, -0.25],
          [0.12, 1.35, -0.12],
          [-0.02, 1.05, -0.28],
          [0.25, 1.08, -0.15],
        ].map(([bx, by, bz], i) => (
          <mesh key={i} position={[bx, by, bz]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
        ))}

        {hoveredStoryId === 'story_duck_mascot' && (
          <Html position={[0, 1.15, 0]} center zIndexRange={[5, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
              🦆 [클릭 / E] 독자서점 마스코트 오리 이야기
            </div>
          </Html>
        )}
      </group>

      {/* Live-Edge Wooden Bench Sofa (`seat_wood_bench`) */}
      {(() => {
        const bench = SEAT_OBJECTS.find((s) => s.id === 'seat_wood_bench')!;
        const isActive = activeSeatId === bench.id;
        return (
          <group
            position={bench.seatPosition}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSeat(bench);
            }}
            onPointerOver={() => setHoveredSeatId(bench.id)}
            onPointerOut={() => setHoveredSeatId(null)}
          >
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.52, 0.08, 1.28]} />
              <meshStandardMaterial
                color={
                  hoveredSeatId === bench.id || isActive ? '#9c6334' : '#7c4d25'
                }
                roughness={0.75}
              />
            </mesh>
            <mesh position={[0, 0.2, -0.45]} castShadow>
              <boxGeometry args={[0.44, 0.4, 0.1]} />
              <meshStandardMaterial color="#5e3a1b" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.2, 0.45]} castShadow>
              <boxGeometry args={[0.44, 0.4, 0.1]} />
              <meshStandardMaterial color="#5e3a1b" roughness={0.8} />
            </mesh>
            {hoveredSeatId === bench.id && (
              <Html position={[0, 0.85, 0]} center zIndexRange={[5, 0]}>
                <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                  🛋️ [클릭 / E] 통원목 벤치 소파에 앉기
                </div>
              </Html>
            )}
          </group>
        );
      })()}

      {/* Room-Divider Open Cabinet (`story_divider_cabinet`) */}
      <group
        position={[-3.05, 0, -0.05]}
        onClick={(e) => {
          e.stopPropagation();
          const st = SPACE_STORIES.find(
            (s) => s.id === 'story_divider_cabinet'
          );
          if (st) onSelectStory(st);
        }}
        onPointerOver={() => setHoveredStoryId('story_divider_cabinet')}
        onPointerOut={() => setHoveredStoryId(null)}
      >
        {[0.18, 0.65, 1.12, 1.58, 2.04, 2.52].map((sy, idx) => (
          <mesh key={idx} position={[0, sy, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.75, 0.045, 0.46]} />
            <meshStandardMaterial color="#4a2c16" roughness={0.75} />
          </mesh>
        ))}
        {[-1.34, -0.45, 0.45, 1.34].map((vx, idx) => (
          <mesh key={idx} position={[vx, 1.26, 0]} castShadow>
            <boxGeometry args={[0.05, 2.52, 0.46]} />
            <meshStandardMaterial color="#4a2c16" roughness={0.75} />
          </mesh>
        ))}
        {/* Top Shelf Prop: Vintage Black PFAFF 130 Sewing Machine */}
        <group position={[0.65, 2.55, 0]}>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[0.46, 0.05, 0.22]} />
            <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0.14, 0.16, 0]}>
            <boxGeometry args={[0.12, 0.24, 0.14]} />
            <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <boxGeometry args={[0.38, 0.09, 0.12]} />
            <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
        {/* 2nd Shelf: White Enamel Kettle, Black Leather Briefcase, Red Yashica Box & Orange Handbag */}
        <mesh position={[-0.78, 2.18, 0.04]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.18, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0.05, 2.24, 0]} castShadow>
          <boxGeometry args={[0.48, 0.34, 0.16]} />
          <meshStandardMaterial color="#1c1917" roughness={0.4} />
        </mesh>
        <mesh position={[0.45, 2.18, 0.04]} castShadow>
          <boxGeometry args={[0.18, 0.22, 0.14]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
        <mesh position={[0.88, 2.22, 0]} castShadow>
          <boxGeometry args={[0.36, 0.28, 0.15]} />
          <meshStandardMaterial color="#c2410c" roughness={0.45} />
        </mesh>
        {/* 3rd Shelf: CD Stacks & TRANSPARENT Glass Speaker */}
        <mesh position={[-0.85, 1.76, 0.04]}>
          <boxGeometry args={[0.42, 0.28, 0.16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
        </mesh>
        <group position={[0.65, 1.78, 0]}>
          <mesh>
            <boxGeometry args={[0.56, 0.36, 0.18]} />
            <meshStandardMaterial
              color="#d4d4d8"
              transparent
              opacity={0.45}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0.08, -0.02, 0.092]}>
            <circleGeometry args={[0.11, 20]} />
            <meshBasicMaterial color="#18181b" />
          </mesh>
          <mesh position={[-0.14, 0.08, 0.092]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color="#18181b" />
          </mesh>
        </group>
        {/* 4th Shelf: 3 Plush Horse Heads, Glowing Orange Lamp & LEGO Modular Building */}
        {[-0.95, -0.68, -0.42].map((hx, hIdx) => (
          <mesh key={hIdx} position={[hx, 1.28, 0.05]} castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial
              color={
                hIdx === 0 ? '#c26a2d' : hIdx === 1 ? '#5c4033' : '#271c19'
              }
              roughness={0.85}
            />
          </mesh>
        ))}
        <mesh position={[0.25, 1.28, 0]}>
          <cylinderGeometry args={[0.14, 0.06, 0.24, 16]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ea580c"
            emissiveIntensity={0.6}
          />
        </mesh>
        <mesh position={[0.85, 1.3, 0]}>
          <boxGeometry args={[0.42, 0.3, 0.24]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.5} />
        </mesh>
      </group>

      {/* ============================================================
          9. RIGHT WALL: 6-TIER MAIN WALNUT BOOKCASES, FRONT PROPS & BACK LEATHER/WINE
         ============================================================ */}
      <group>
        {/* Right Wall Background Backing */}
        <mesh position={[4.5, 1.72, 0]} receiveShadow>
          <boxGeometry args={[0.2, 3.45, 13.6]} />
          <meshStandardMaterial color="#2e1c10" roughness={0.85} />
        </mesh>

        {/* Wood-Paneled Structural Pillar dividing Front 5 Bays and Back 4 Bays */}
        <group position={[4.15, 1.72, -0.12]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.68, 3.45, 0.92]} />
            <meshStandardMaterial color="#59351c" roughness={0.75} />
          </mesh>
          {/* Small Framed Butterfly/Botanical Artworks on the Pillar (113955_01.jpg) */}
          <mesh position={[-0.35, 0.12, -0.18]}>
            <boxGeometry args={[0.03, 0.34, 0.32]} />
            <meshStandardMaterial color="#27272a" />
          </mesh>
          <mesh position={[-0.35, 0.1, 0.18]}>
            <boxGeometry args={[0.02, 0.38, 0.26]} />
            <meshStandardMaterial color="#fef3c7" />
          </mesh>
          <mesh position={[-0.35, -0.28, 0.18]}>
            <boxGeometry args={[0.03, 0.22, 0.26]} />
            <meshStandardMaterial color="#7c2d12" />
          </mesh>
        </group>

        {/* Horizontal Walnut Shelves (Front 5 Bays & Back 4 Bays) */}
        {[0.18, 0.65, 1.11, 1.55, 1.99, 2.43, 2.88].map((sy, idx) => (
          <React.Fragment key={idx}>
            <mesh position={[4.22, sy, 2.9]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.04, 5.0]} />
              <meshStandardMaterial color="#4a2a14" roughness={0.75} />
            </mesh>
            <mesh position={[4.22, sy, -2.82]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.04, 4.35]} />
              <meshStandardMaterial color="#4a2a14" roughness={0.75} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Vertical Bookcase Dividers */}
        {[5.38, 4.36, 3.4, 2.45, 1.5, 0.52, -0.75, -1.72, -2.79, -3.86, -4.96].map(
          (vz, idx) => (
            <mesh key={idx} position={[4.22, 1.52, vz]} castShadow>
              <boxGeometry args={[0.46, 2.75, 0.045]} />
              <meshStandardMaterial color="#4a2a14" roughness={0.75} />
            </mesh>
          )
        )}

        {/* Hanging White Paper Guide Notices on Vertical Dividers ('구매 안내') */}
        {[3.4, 1.5, -2.79].map((vz, idx) => (
          <mesh key={idx} position={[3.98, 1.52, vz]}>
            <boxGeometry args={[0.01, 0.24, 0.16]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        ))}

        {/* Front Bookcase Special Props (from KakaoTalk_261106_113955_01.jpg): */}
        {/* 1) Top Right Bay (6th shelf): Vintage Beverage Crates (Chilsung Cider & Pepsi) with Bottles */}
        <group position={[4.22, 2.58, 4.85]}>
          <mesh position={[0, 0, -0.22]}>
            <boxGeometry args={[0.3, 0.26, 0.36]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <boxGeometry args={[0.3, 0.26, 0.36]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
        </group>
        {/* 2) Top Left Bay (6th shelf next to pillar): Miniature Christmas Village Diorama */}
        <group position={[4.22, 2.55, 0.98]}>
          <mesh>
            <boxGeometry args={[0.32, 0.12, 0.68]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh position={[0, 0.12, -0.15]}>
            <coneGeometry args={[0.08, 0.18, 8]} />
            <meshStandardMaterial color="#15803d" />
          </mesh>
          <mesh position={[0, 0.12, 0.15]}>
            <boxGeometry args={[0.14, 0.16, 0.16]} />
            <meshStandardMaterial color="#991b1b" />
          </mesh>
        </group>
        {/* 3) 5th Shelf White Duck Figurines */}
        <mesh position={[4.15, 2.09, 3.55]}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[4.15, 2.08, 3.95]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* 4) Bottom Shelf Yellow/Black DEWALT Tool Case */}
        <mesh position={[4.2, 0.32, 0.92]}>
          <boxGeometry args={[0.26, 0.22, 0.32]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>

        {/* Decorative Book Spines filling all 9 Bays */}
        {decorativeBooks.map((b, i) => (
          <mesh key={i} position={b.position} castShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} roughness={0.75} />
          </mesh>
        ))}

        {/* Back Bookcase & Concrete Block Shelf: Handcrafted Leather Goods, Wine Bottles & Cameras */}
        <group
          position={[4.2, 0, -5.65]}
          onClick={(e) => {
            e.stopPropagation();
            const st = SPACE_STORIES.find(
              (s) => s.id === 'story_camera_leather'
            );
            if (st) onSelectStory(st);
          }}
          onPointerOver={() => setHoveredStoryId('story_camera_leather')}
          onPointerOut={() => setHoveredStoryId(null)}
        >
          {/* Red Coca-Cola Cooler on Bottom of Back Bookcase (114029_01.jpg) */}
          <mesh position={[0, 0.34, 1.15]} castShadow>
            <boxGeometry args={[0.36, 0.32, 0.52]} />
            <meshStandardMaterial color="#dc2626" roughness={0.4} />
          </mesh>

          {/* Grey Concrete Block Columns */}
          {[-0.58, 0.58].map((dz, idx) => (
            <mesh key={idx} position={[0, 1.35, dz]} castShadow>
              <boxGeometry args={[0.44, 2.7, 0.36]} />
              <meshStandardMaterial color="#9ca3af" roughness={0.9} />
            </mesh>
          ))}
          {[0.45, 1.05, 1.65, 2.25].map((sy, idx) => (
            <mesh key={idx} position={[0, sy, 0]}>
              <boxGeometry args={[0.42, 0.04, 1.45]} />
              <meshStandardMaterial color="#7c4a21" roughness={0.7} />
            </mesh>
          ))}

          {/* Top Shelf (2.25m): Vintage Cameras (Nikon, Pentax, Lubitel) */}
          {[-0.25, 0, 0.25].map((cz, idx) => (
            <mesh key={idx} position={[-0.06, 2.36, cz]} castShadow>
              <boxGeometry args={[0.12, 0.12, 0.16]} />
              <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}

          {/* 3rd Shelf (1.65m): Handcrafted Leather Tote Bags & Clutches with Pom-Pom Keychains */}
          <mesh position={[-0.04, 1.88, 0.12]} castShadow>
            <boxGeometry args={[0.18, 0.36, 0.42]} />
            <meshStandardMaterial color="#5c2e14" roughness={0.42} />
          </mesh>
          <mesh position={[-0.08, 1.82, -0.18]} castShadow>
            <boxGeometry args={[0.16, 0.26, 0.3]} />
            <meshStandardMaterial color="#ea580c" roughness={0.42} />
          </mesh>
          {/* Fluffy Fur Pom-Pom Keychain */}
          <mesh position={[-0.16, 1.72, -0.02]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color="#d6b49c" roughness={0.95} />
          </mesh>

          {/* 2nd Shelf (1.05m): Black & Burgundy Leather Handbags + Digital Clock (16:33) */}
          <mesh position={[-0.06, 1.25, -0.22]} castShadow>
            <boxGeometry args={[0.18, 0.32, 0.32]} />
            <meshStandardMaterial color="#18181b" roughness={0.35} />
          </mesh>
          <mesh position={[-0.06, 1.22, 0.12]} castShadow>
            <boxGeometry args={[0.16, 0.24, 0.28]} />
            <meshStandardMaterial color="#581c2c" roughness={0.45} />
          </mesh>
          <mesh position={[-0.15, 1.18, -0.04]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#d97736" roughness={0.95} />
          </mesh>

          {/* 1st Shelf (0.45m): Handcrafted Leather Wallets, Gold Certificate & Wine Bottles! */}
          {/* Gold Leather Master Certificate Frame */}
          <mesh position={[0.02, 0.62, 0.25]} rotation={[0, -0.15, 0]}>
            <boxGeometry args={[0.04, 0.24, 0.3]} />
            <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Row of Handcrafted Leather Wallets */}
          {[-0.32, -0.24, -0.16, -0.08, 0].map((wz, idx) => (
            <mesh key={idx} position={[-0.08, 0.54, wz]}>
              <boxGeometry args={[0.14, 0.12, 0.05]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#7c3f1d' : '#3b2314'}
                roughness={0.5}
              />
            </mesh>
          ))}
          {/* Wine Bottles Displayed on Back Shelf & Floor Corner */}
          {[-0.35, -0.22, -0.09, 0.04].map((wz, idx) => (
            <group key={`back-wine-${idx}`} position={[-0.08, 0.18, wz - 0.1]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.036, 0.038, 0.32, 10]} />
                <meshStandardMaterial
                  color="#1b261b"
                  roughness={0.2}
                  metalness={0.35}
                />
              </mesh>
              <mesh position={[0, 0, -0.038]}>
                <planeGeometry args={[0.045, 0.09]} />
                <meshBasicMaterial color="#fde68a" />
              </mesh>
            </group>
          ))}

          {hoveredStoryId === 'story_camera_leather' && (
            <Html position={[-0.3, 1.6, 0]} center zIndexRange={[5, 0]}>
              <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                👜 [클릭 / E] 후면 가죽공예품 · 와인 · 카메라 선반 보기
              </div>
            </Html>
          )}
        </group>

        {/* Detailed Yellow Molded Plastic Stool in front of Front-Right Bookshelf (`seat_yellow_stool`) */}
        {(() => {
          const stool = SEAT_OBJECTS.find((s) => s.id === 'seat_yellow_stool')!;
          const isActive = activeSeatId === stool.id;
          const stoolColor =
            hoveredSeatId === stool.id || isActive ? '#fde047' : '#eab308';
          return (
            <group
              position={stool.seatPosition}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(stool);
              }}
              onPointerOver={() => setHoveredSeatId(stool.id)}
              onPointerOut={() => setHoveredSeatId(null)}
            >
              {/* Stool Seat Top */}
              <mesh position={[0, 0.44, 0]} castShadow>
                <boxGeometry args={[0.34, 0.04, 0.34]} />
                <meshStandardMaterial color={stoolColor} roughness={0.35} />
              </mesh>
              {/* 4 Splayed Stool Legs */}
              {[
                [-0.14, 0.22, -0.14],
                [0.14, 0.22, -0.14],
                [-0.14, 0.22, 0.14],
                [0.14, 0.22, 0.14],
              ].map(([lx, ly, lz], idx) => (
                <mesh key={idx} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.045, 0.44, 0.045]} />
                  <meshStandardMaterial color={stoolColor} roughness={0.35} />
                </mesh>
              ))}
              {hoveredSeatId === stool.id && (
                <Html position={[0, 0.72, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    🪑 [클릭 / E] 노란 간이 스툴에 앉기
                  </div>
                </Html>
              )}
            </group>
          );
        })()}
      </group>

      {/* ============================================================
          10. GENRE SIGNS & INTERACTIVE REPRESENTATIVE BOOKS
         ============================================================ */}
      {GENRE_SHELVES.map((shelf) => {
        const isCurrentActive = activeGenreShelf?.id === shelf.id;
        return (
          <group
            key={shelf.id}
            position={shelf.signPosition}
            rotation={[0, shelf.signRotationY, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectGenreShelf(shelf);
            }}
          >
            <mesh castShadow>
              <boxGeometry args={[0.52, 0.18, 0.04]} />
              <meshStandardMaterial
                color={isCurrentActive ? '#c85a28' : '#29201b'}
                roughness={0.5}
              />
            </mesh>
            <Html position={[0, 0, 0.04]} center zIndexRange={[5, 0]}>
              <div
                className={`pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all shadow-md ${
                  isCurrentActive
                    ? 'bg-[#c85a28] text-white ring-1 ring-[#fde68a]'
                    : 'bg-[#1c1613]/90 text-[#f5efe6] border border-[#d4af37]/50'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: shelf.accentColor }}
                />
                <span>{shelf.name}</span>
              </div>
            </Html>
          </group>
        );
      })}

      {/* Representative Selectable 3D Books on the Shelves */}
      {REPRESENTATIVE_BOOKS.map((book) => {
        if (heldBook?.id === book.id || placedBookIds.has(book.id)) {
          return null;
        }

        const isHovered = hoveredBookId === book.id;

        return (
          <group
            key={book.id}
            position={book.shelfPosition}
            rotation={book.shelfRotation}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBook(book);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredBookId(book.id);
            }}
            onPointerOut={() => setHoveredBookId(null)}
          >
            <mesh
              position={[0, 0, isHovered ? 0.04 : 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.21, 0.28, 0.042]} />
              <meshStandardMaterial
                color={book.coverColor}
                emissive={isHovered ? book.accentColor : '#000000'}
                emissiveIntensity={isHovered ? 0.35 : 0}
                roughness={0.45}
              />
            </mesh>
            <mesh position={[0, -0.05, isHovered ? 0.062 : 0.022]}>
              <boxGeometry args={[0.212, 0.055, 0.004]} />
              <meshStandardMaterial color={book.accentColor} />
            </mesh>
            {(isHovered || nearbyBookId === book.id) && (
              <Html position={[0, 0.25, 0.05]} center zIndexRange={[6, 0]}>
                <div
                  className={`pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition-all shadow-md ${
                    isHovered || nearbyBookId === book.id
                      ? 'bg-[#c85a28] text-white ring-1 ring-[#fde68a]'
                      : 'bg-[#1c1613]/90 text-[#fde68a] border border-[#e09f3e]/60'
                  }`}
                >
                  <span>📕</span>
                  <span className="max-w-[130px] truncate">{book.title}</span>
                  {nearbyBookId === book.id && (
                    <span className="ml-0.5 rounded bg-black/30 px-1 text-[10px]">
                      [E]
                    </span>
                  )}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* ============================================================
          11. RIGHT-WALL ATTACHED RECOMMENDATION TABLE & LEATHER MACHINE
              (Attached flush to the Right Wall Wood Pillar at X = 2.65!)
         ============================================================ */}
      {(() => {
        const centerTable = TABLE_OBJECTS.find(
          (t) => t.id === 'table_center_recommend'
        )!;
        const placedBook = tablePlacedBooks['table_center_recommend'];

        return (
          <group position={centerTable.position}>
            <group
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(centerTable);
              }}
              onPointerOver={() => setHoveredTableId(centerTable.id)}
              onPointerOut={() => setHoveredTableId(null)}
            >
              {/* Dark Wood Tabletop with Black Metal Frame Edge (X spans 1.45..3.85, flush against right wall pillar!) */}
              <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.35, 0.05, 0.94]} />
                <meshStandardMaterial color="#6e4423" roughness={0.65} />
              </mesh>
              {/* Black Steel Legs */}
              {[
                [-1.12, 0.39, -0.42],
                [1.12, 0.39, -0.42],
                [-1.12, 0.39, 0.42],
                [1.12, 0.39, 0.42],
              ].map(([lx, ly, lz], idx) => (
                <mesh key={idx} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.055, 0.78, 0.055]} />
                  <meshStandardMaterial color="#18181b" roughness={0.5} />
                </mesh>
              ))}

              {/* Vintage Military-Style Wooden Crate underneath ('주의: 1. 이 포장은 방습포장이 아니므로...') */}
              <group position={[-0.25, 0.34, 0]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[1.48, 0.66, 0.76]} />
                  <meshStandardMaterial color="#c49a60" roughness={0.85} />
                </mesh>
                {/* White Shipping Label on Left Side of Crate */}
                <mesh position={[-0.48, 0.06, 0.382]}>
                  <planeGeometry args={[0.24, 0.22]} />
                  <meshBasicMaterial color="#f8fafc" />
                </mesh>
                {/* Vertical Wood Battens on Crate */}
                {[-0.7, 0, 0.7].map((bx, bIdx) => (
                  <mesh key={bIdx} position={[bx, 0, 0.382]}>
                    <boxGeometry args={[0.05, 0.66, 0.015]} />
                    <meshStandardMaterial color="#a67c46" />
                  </mesh>
                ))}
              </group>

              {/* Stacked Yellow & Grey Plastic Stools tucked under right side of table (114029_11.jpg) */}
              <mesh position={[0.78, 0.24, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.22, 0.48, 14]} />
                <meshStandardMaterial color="#eab308" roughness={0.4} />
              </mesh>
              <mesh position={[0.78, 0.36, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.22, 0.5, 14]} />
                <meshStandardMaterial color="#57534e" roughness={0.5} />
              </mesh>

              {/* Detailed Props on Top of Recommendation Table (114029_11.jpg): */}
              {/* 7 Stacks of Curated Featured Books lined along front edge */}
              {[
                [-0.92, '#f5efe6', 0.09],
                [-0.62, '#e7d5b8', 0.06],
                [-0.36, '#dc2626', 0.05],
                [-0.12, '#f8fafc', 0.05],
                [0.14, '#7c2d12', 0.06],
                [0.4, '#fef3c7', 0.07],
                [0.68, '#d97736', 0.06],
              ].map(([bx, col, h], bIdx) => (
                <mesh
                  key={bIdx}
                  position={[Number(bx), 0.805 + Number(h) / 2, 0.26]}
                  castShadow
                >
                  <boxGeometry args={[0.21, Number(h), 0.26]} />
                  <meshStandardMaterial color={String(col)} roughness={0.6} />
                </mesh>
              ))}

              {/* Open Book on Book Stand + Vintage Camera + Red Rose in Bottle */}
              <mesh
                position={[-0.45, 0.88, -0.02]}
                rotation={[-0.35, 0, 0]}
                castShadow
              >
                <boxGeometry args={[0.32, 0.22, 0.02]} />
                <meshStandardMaterial color="#fffbeb" />
              </mesh>
              {/* Vintage Film Camera */}
              <mesh position={[-0.18, 0.85, 0.04]} castShadow>
                <boxGeometry args={[0.12, 0.09, 0.08]} />
                <meshStandardMaterial color="#18181b" metalness={0.5} />
              </mesh>
              {/* Red Rose in Glass Bottle */}
              <mesh position={[-0.18, 0.88, -0.1]}>
                <cylinderGeometry args={[0.025, 0.035, 0.14, 10]} />
                <meshStandardMaterial color="#e2e8f0" transparent opacity={0.7} />
              </mesh>
              <mesh position={[-0.18, 0.98, -0.1]}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <meshStandardMaterial color="#dc2626" />
              </mesh>
              {/* Angled 'READ MORE BOOKS' Mirror Sign */}
              <mesh
                position={[0.18, 0.92, -0.15]}
                rotation={[-0.25, 0, 0]}
                castShadow
              >
                <boxGeometry args={[0.34, 0.24, 0.02]} />
                <meshStandardMaterial
                  color="#cbd5e1"
                  metalness={0.75}
                  roughness={0.18}
                />
              </mesh>
              {/* Magazine / Newspaper Rack on Right End of Table */}
              <mesh position={[0.92, 0.92, -0.05]} rotation={[0, -0.3, 0]}>
                <boxGeometry args={[0.28, 0.26, 0.22]} />
                <meshStandardMaterial color="#d6d3cd" />
              </mesh>

              {hoveredTableId === centerTable.id && (
                <Html position={[0, 1.22, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    📚 [클릭 / E] 추천 도서 테이블 & 방명록 이용하기
                  </div>
                </Html>
              )}
            </group>

            {/* User's Placed Book on Recommendation Table */}
            {placedBook && (
              <group
                position={[
                  centerTable.bookPlacePosition[0] - centerTable.position[0],
                  centerTable.bookPlacePosition[1],
                  centerTable.bookPlacePosition[2] - centerTable.position[2],
                ]}
                rotation={[-Math.PI / 2, 0, 0.1]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBook(placedBook);
                }}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.21, 0.28, 0.042]} />
                  <meshStandardMaterial color={placedBook.coverColor} />
                </mesh>
              </group>
            )}

            {/* Grey Leather Skiving Machine with Cute White Character Cushion behind table */}
            <group position={[-0.15, 0, -1.02]}>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[1.25, 0.85, 0.72]} />
                <meshStandardMaterial color="#64748b" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.58, -0.38]} castShadow>
                <boxGeometry args={[0.32, 0.3, 0.08]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.7} />
              </mesh>
            </group>
          </group>
        );
      })()}

      {/* ============================================================
          12. BACK-LEFT: DIMPCHI LEATHER WORKSHOP & LARGE ADJACENT TABLE
         ============================================================ */}
      {(() => {
        const workbench = TABLE_OBJECTS.find(
          (t) => t.id === 'table_leather_workbench'
        )!;
        const workshopChair = SEAT_OBJECTS.find(
          (s) => s.id === 'seat_workshop_chair'
        )!;
        const placedBook = tablePlacedBooks['table_leather_workbench'];
        const isChairActive = activeSeatId === workshopChair.id;

        return (
          <group>
            {/* Back-Left White Gallery Wall */}
            <mesh position={[-4.5, 1.72, -3.3]} receiveShadow>
              <boxGeometry args={[0.2, 3.45, 6.8]} />
              <meshStandardMaterial color="#e7e2da" roughness={0.8} />
            </mesh>

            {/* Iconic Hanging Natural Tan Cowhide Leather Pelt on the Wall */}
            <group
              position={[-4.38, 1.85, -2.5]}
              onClick={(e) => {
                e.stopPropagation();
                const st = SPACE_STORIES.find(
                  (s) => s.id === 'story_leather_workshop'
                );
                if (st) onSelectStory(st);
              }}
              onPointerOver={() => setHoveredStoryId('story_leather_workshop')}
              onPointerOut={() => setHoveredStoryId(null)}
            >
              <mesh castShadow>
                <boxGeometry args={[0.04, 1.35, 1.85]} />
                <meshStandardMaterial color="#c86428" roughness={0.65} />
              </mesh>
              {hoveredStoryId === 'story_leather_workshop' && (
                <Html position={[0.2, 0, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    🧵 [클릭 / E] 책방 속 가죽공방 ‘딤프치’ 이야기
                  </div>
                </Html>
              )}
            </group>

            {/* Framed Aerial Cherry-Blossom City Photograph next to Cowhide */}
            <group position={[-4.38, 1.85, -4.65]}>
              <mesh>
                <boxGeometry args={[0.04, 1.05, 1.35]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.4} />
              </mesh>
              <mesh position={[0.025, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[1.15, 0.85]} />
                <meshStandardMaterial color="#d8b4c8" roughness={0.5} />
              </mesh>
            </group>

            {/* 1) Left Leather Craft Workbench with Cylindrical Leather Roll Tubes underneath */}
            <group
              position={[-3.05, 0, -3.2]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(workbench);
              }}
              onPointerOver={() => setHoveredTableId(workbench.id)}
              onPointerOut={() => setHoveredTableId(null)}
            >
              <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.65, 0.06, 2.75]} />
                <meshStandardMaterial color="#5c3818" roughness={0.7} />
              </mesh>
              {/* Cylindrical Leather Storage Tubes under Workbench */}
              {[-0.8, -0.4, 0, 0.4, 0.8].map((tz, rIdx) =>
                [0.18, 0.38, 0.58].map((ty, cIdx) => (
                  <mesh
                    key={`${rIdx}-${cIdx}`}
                    position={[0.45, ty, tz]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <cylinderGeometry args={[0.085, 0.085, 0.55, 12]} />
                    <meshStandardMaterial
                      color={
                        (rIdx + cIdx) % 2 === 0 ? '#b48a60' : '#8c5830'
                      }
                    />
                  </mesh>
                ))
              )}
              {/* Leather Swatches & Tools on Workbench */}
              <mesh position={[0.25, 0.82, 0.2]} rotation={[0, 0.3, 0]}>
                <boxGeometry args={[0.45, 0.02, 0.35]} />
                <meshStandardMaterial color="#c2410c" />
              </mesh>
              <mesh position={[0.12, 0.83, -0.25]} rotation={[0, -0.2, 0]}>
                <boxGeometry args={[0.38, 0.02, 0.3]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>

            {/* 2) Large Table Next to Leather Space (`가죽 공간 옆 큰 테이블` at X = -0.85, Z = -3.45) */}
            <group
              position={[-0.85, 0, -3.45]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(workbench);
              }}
              onPointerOver={() => setHoveredTableId(workbench.id)}
              onPointerOut={() => setHoveredTableId(null)}
            >
              <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.55, 0.06, 2.35]} />
                <meshStandardMaterial color="#6e4423" roughness={0.68} />
              </mesh>
              {[
                [-0.68, 0.38, -1.05],
                [0.68, 0.38, -1.05],
                [-0.68, 0.38, 1.05],
                [0.68, 0.38, 1.05],
              ].map(([lx, ly, lz], idx) => (
                <mesh key={idx} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.06, 0.76, 0.06]} />
                  <meshStandardMaterial color="#27272a" />
                </mesh>
              ))}
              {/* Computer Monitor & Book Stacks on Large Table */}
              <mesh position={[-0.25, 0.98, -0.35]} rotation={[0, 0.2, 0]}>
                <boxGeometry args={[0.05, 0.36, 0.56]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0.25, 0.82, 0.35]}>
                <boxGeometry args={[0.28, 0.07, 0.22]} />
                <meshStandardMaterial color="#f5efe6" />
              </mesh>
            </group>

            {placedBook && (
              <group
                position={workbench.bookPlacePosition}
                rotation={[-Math.PI / 2, 0, -0.2]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBook(placedBook);
                }}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.21, 0.28, 0.042]} />
                  <meshStandardMaterial color={placedBook.coverColor} />
                </mesh>
              </group>
            )}

            {/* Workshop Reading Chair (`seat_workshop_chair`) */}
            <group
              position={workshopChair.seatPosition}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(workshopChair);
              }}
              onPointerOver={() => setHoveredSeatId(workshopChair.id)}
              onPointerOut={() => setHoveredSeatId(null)}
            >
              <mesh position={[0, 0.44, 0]} castShadow>
                <boxGeometry args={[0.48, 0.06, 0.48]} />
                <meshStandardMaterial
                  color={
                    hoveredSeatId === workshopChair.id || isChairActive
                      ? '#9c6334'
                      : '#6e4423'
                  }
                />
              </mesh>
              <mesh position={[0.21, 0.72, 0]} castShadow>
                <boxGeometry args={[0.05, 0.26, 0.48]} />
                <meshStandardMaterial color="#5c3818" />
              </mesh>
              {hoveredSeatId === workshopChair.id && (
                <Html position={[0, 1.0, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    🪑 [클릭 / E] 대형 테이블 의자에 앉기
                  </div>
                </Html>
              )}
            </group>
          </group>
        );
      })()}

      {/* Back Wall Counter & Doorway (North Z = -6.6) */}
      <mesh position={[0, 1.72, -6.65]} receiveShadow>
        <boxGeometry args={[9.2, 3.45, 0.25]} />
        <meshStandardMaterial color="#dfd9ce" roughness={0.85} />
      </mesh>

      {/* ============================================================
          13. ROADVIEW-STYLE FLOOR WAYPOINTS & CLICK TARGET MARKERS
         ============================================================ */}
      {WAYPOINT_NODES.map((wp) => {
        const distToChar = Math.hypot(
          characterPos[0] - wp.position[0],
          characterPos[2] - wp.position[2]
        );
        if (distToChar < 0.75) return null;
        const isHovered = hoveredWaypointId === wp.id;
        const wpY = wp.position[2] > 7.4 ? -0.16 : 0.02;

        return (
          <group
            key={wp.id}
            position={[wp.position[0], wpY, wp.position[2]]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectWaypoint(wp);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredWaypointId(wp.id);
            }}
            onPointerOut={() => setHoveredWaypointId(null)}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.22, 0.29, 28]} />
              <meshBasicMaterial
                color={isHovered ? '#fde047' : '#f59e0b'}
                transparent
                opacity={isHovered ? 0.95 : 0.55}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
              <circleGeometry args={[0.14, 24]} />
              <meshBasicMaterial
                color={isHovered ? '#c85a28' : '#fef3c7'}
                transparent
                opacity={isHovered ? 0.85 : 0.35}
              />
            </mesh>
            {isHovered && (
              <Html position={[0, 0.35, 0]} center zIndexRange={[5, 0]}>
                <div className="pointer-events-none whitespace-nowrap rounded-full bg-[#1c1613]/95 px-2.5 py-0.5 text-[11px] font-medium text-[#fde68a] border border-[#f59e0b]/50 shadow-md">
                  👣 {wp.label} (클릭 이동)
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Hover Floor Cursor Indicator */}
      {floorCursor && (
        <group
          position={[
            floorCursor.x,
            floorCursor.z > 7.4 ? -0.16 : 0.018,
            floorCursor.z,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.16, 0.21, 24]} />
            <meshBasicMaterial
              color={floorCursor.walkable ? '#fde68a' : '#ef4444'}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
      )}

      {/* Active Click-to-Move Destination Ring & Path Breadcrumbs */}
      {navTarget && (
        <group
          position={[
            navTarget[0],
            navTarget[1] > 7.4 ? -0.155 : 0.025,
            navTarget[1],
          ]}
        >
          <mesh ref={targetRingRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 0.28, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.85} />
          </mesh>
        </group>
      )}

      {navPath.map(([px, pz], idx) => (
        <mesh
          key={idx}
          position={[px, pz > 7.4 ? -0.158 : 0.022, pz]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.055, 12]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
};
