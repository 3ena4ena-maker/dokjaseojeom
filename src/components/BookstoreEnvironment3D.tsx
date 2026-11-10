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
import { BookshopOwner3D } from './BookshopOwner3D';

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
  collectedStampIds: string[];
  onFindHiddenStamp: (missionId: string) => void;
  isOwnerPresent: boolean;
  isOwnerTalking: boolean;
  selectedOwnerQuestionIdx: number | null;
  onOpenOwnerTalk: () => void;
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
  collectedStampIds,
  onFindHiddenStamp,
  isOwnerPresent,
  isOwnerTalking,
  selectedOwnerQuestionIdx,
  onOpenOwnerTalk,
}) => {
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredStoryId, setHoveredStoryId] = useState<string | null>(null);
  const [hoveredWaypointId, setHoveredWaypointId] = useState<string | null>(null);
  const [hoveredHiddenId, setHoveredHiddenId] = useState<string | null>(null);
  const [ownerLibraryNoticeOpen, setOwnerLibraryNoticeOpen] =
    useState<boolean>(false);
  const [hoveredOwnerLibrary, setHoveredOwnerLibrary] =
    useState<boolean>(false);
  const [ownerDisplayNoticeOpen, setOwnerDisplayNoticeOpen] =
    useState<boolean>(false);
  const [hoveredOwnerDisplay, setHoveredOwnerDisplay] =
    useState<boolean>(false);
  const [floorCursor, setFloorCursor] = useState<{
    x: number;
    z: number;
    walkable: boolean;
  } | null>(null);

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);

  // Refs for the 3-Minute (180s) Morning -> Bright Day -> Sunset -> Evening Window Scenery Cycle
  const skyBand0MatRef = useRef<THREE.MeshBasicMaterial>(null); // Lower Horizon Band
  const skyBand1MatRef = useRef<THREE.MeshBasicMaterial>(null); // Lower-Mid Band
  const skyBand2MatRef = useRef<THREE.MeshBasicMaterial>(null); // Middle Sky Band
  const skyBand3MatRef = useRef<THREE.MeshBasicMaterial>(null); // Upper-Mid Sky Band
  const skyBand4MatRef = useRef<THREE.MeshBasicMaterial>(null); // Upper Zenith Sky Band
  const sunGroupRef = useRef<THREE.Group>(null);
  const sunCoreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const sunHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  const moonMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const starsGroupRef = useRef<THREE.Group>(null);
  const cloudGroupRefs = useRef<Array<THREE.Group | null>>([]);
  const outdoorDirLightRef = useRef<THREE.DirectionalLight>(null);
  const outdoorHemiLightRef = useRef<THREE.HemisphereLight>(null);
  const streetLampLeftLightRef = useRef<THREE.PointLight>(null);
  const streetLampRightLightRef = useRef<THREE.PointLight>(null);
  const windowSunbeamGroupRef = useRef<THREE.Group>(null);

  // Shared Materials for Multi-Mesh Dynamic Window Scenery Objects
  const skySharedMats = useMemo(
    () => ({
      cloud: new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        emissive: '#fbbf24',
        emissiveIntensity: 0.05,
        roughness: 0.92,
      }),
      streetLampGlobe: new THREE.MeshStandardMaterial({
        color: '#fffbeb',
        emissive: '#fbbf24',
        emissiveIntensity: 0,
        roughness: 0.2,
      }),
      buildingWin: new THREE.MeshBasicMaterial({
        color: '#334155',
      }),
      windowGlass: new THREE.MeshStandardMaterial({
        color: '#60a5fa',
        transparent: true,
        opacity: 0.16,
        roughness: 0.15,
        side: THREE.DoubleSide,
      }),
      sunbeam: new THREE.MeshBasicMaterial({
        color: '#fef3c7',
        transparent: true,
        opacity: 0.18,
      }),
    }),
    []
  );

  // Pre-allocated Scratch Colors & Keyframes for Zero-GC 60fps Interpolation
  const skyKeyframes = useMemo(() => {
    const c = (hex: string) => new THREE.Color(hex);
    return [
      // t = 0.00: Fresh Morning Sunrise (아침 해돋이 시작)
      {
        t: 0.0,
        zenith: c('#38bdf8'),
        mid: c('#93c5fd'),
        horizon: c('#fde68a'),
        cloud: c('#fffbeb'),
        sun: c('#fef08a'),
        halo: c('#fbbf24'),
        lightCol: c('#fff7ed'),
        lightInt: 0.95,
        beamCol: c('#fef3c7'),
        beamOp: 0.18,
        winGlass: c('#60a5fa'),
        bgFog: c('#2a3644'),
        night: 0.0,
      },
      // t = 0.24: Bright Clear Midday (환하게 밝아진 한낮, ~43초)
      {
        t: 0.24,
        zenith: c('#0284c7'),
        mid: c('#7dd3fc'),
        horizon: c('#e0f2fe'),
        cloud: c('#ffffff'),
        sun: c('#ffffff'),
        halo: c('#fef08a'),
        lightCol: c('#ffffff'),
        lightInt: 1.4,
        beamCol: c('#fffbeb'),
        beamOp: 0.28,
        winGlass: c('#7dd3fc'),
        bgFog: c('#33485c'),
        night: 0.0,
      },
      // t = 0.44: Warm Golden Afternoon (따사로운 오후 햇살, ~1분 19초)
      {
        t: 0.44,
        zenith: c('#1d4ed8'),
        mid: c('#93c5fd'),
        horizon: c('#fef08a'),
        cloud: c('#fff7ed'),
        sun: c('#fde047'),
        halo: c('#f59e0b'),
        lightCol: c('#ffedd5'),
        lightInt: 1.22,
        beamCol: c('#fde68a'),
        beamOp: 0.25,
        winGlass: c('#93c5fd'),
        bgFog: c('#383430'),
        night: 0.0,
      },
      // t = 0.62: Blazing Golden & Crimson Sunset (황금빛·주홍빛 노을 절정, ~1분 52초)
      {
        t: 0.62,
        zenith: c('#312e81'),
        mid: c('#ea580c'),
        horizon: c('#fbbf24'),
        cloud: c('#fdba74'),
        sun: c('#f97316'),
        halo: c('#ef4444'),
        lightCol: c('#fb923c'),
        lightInt: 1.1,
        beamCol: c('#fb923c'),
        beamOp: 0.32,
        winGlass: c('#ea580c'),
        bgFog: c('#2e1c18'),
        night: 0.35,
      },
      // t = 0.75: Deep Magenta-Violet Dusk / Twilight (붉은 석양과 어스름한 황혼, ~2분 15초)
      {
        t: 0.75,
        zenith: c('#1e1b4b'),
        mid: c('#9d174d'),
        horizon: c('#ea580c'),
        cloud: c('#f472b6'),
        sun: c('#ef4444'),
        halo: c('#be123c'),
        lightCol: c('#f43f5e'),
        lightInt: 0.55,
        beamCol: c('#f97316'),
        beamOp: 0.14,
        winGlass: c('#4c1d95'),
        bgFog: c('#1d1522'),
        night: 0.85,
      },
      // t = 0.90: Starry Evening Night Sky (어두워진 저녁 밤하늘과 별빛·가로등, ~2분 42초)
      {
        t: 0.9,
        zenith: c('#090d16'),
        mid: c('#1e1b4b'),
        horizon: c('#31102f'),
        cloud: c('#475569'),
        sun: c('#ea580c'),
        halo: c('#9a3412'),
        lightCol: c('#60a5fa'),
        lightInt: 0.25,
        beamCol: c('#93c5fd'),
        beamOp: 0.06,
        winGlass: c('#1e293b'),
        bgFog: c('#121016'),
        night: 1.0,
      },
      // t = 1.00: Seamless Wrap Back to Morning Sunrise (3분 = 180초 주기 완료)
      {
        t: 1.0,
        zenith: c('#38bdf8'),
        mid: c('#93c5fd'),
        horizon: c('#fde68a'),
        cloud: c('#fffbeb'),
        sun: c('#fef08a'),
        halo: c('#fbbf24'),
        lightCol: c('#fff7ed'),
        lightInt: 0.95,
        beamCol: c('#fef3c7'),
        beamOp: 0.18,
        winGlass: c('#60a5fa'),
        bgFog: c('#2a3644'),
        night: 0.0,
      },
    ];
  }, []);

  const scratchColors = useMemo(
    () => ({
      zenith: new THREE.Color(),
      mid: new THREE.Color(),
      horizon: new THREE.Color(),
      band1: new THREE.Color(),
      band3: new THREE.Color(),
      cloud: new THREE.Color(),
      sun: new THREE.Color(),
      halo: new THREE.Color(),
      light: new THREE.Color(),
      beam: new THREE.Color(),
      winGlass: new THREE.Color(),
      bgFog: new THREE.Color(),
      winGlowOn: new THREE.Color('#fde047'),
      winGlowOff: new THREE.Color('#334155'),
    }),
    []
  );

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (targetRingRef.current) {
      const s = 1 + Math.sin(elapsed * 5) * 0.12;
      targetRingRef.current.scale.set(s, s, 1);
    }

    // ------------------------------------------------------------
    // 3-MINUTE (180-SECOND) MORNING -> BRIGHT DAY -> SUNSET -> EVENING CYCLE
    // ------------------------------------------------------------
    const CYCLE_SECONDS = 180; // 3 minutes
    const cycleT = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS;

    // Find current keyframe pair
    let k0 = skyKeyframes[0];
    let k1 = skyKeyframes[1];
    for (let i = 0; i < skyKeyframes.length - 1; i++) {
      if (cycleT >= skyKeyframes[i].t && cycleT <= skyKeyframes[i + 1].t) {
        k0 = skyKeyframes[i];
        k1 = skyKeyframes[i + 1];
        break;
      }
    }
    const span = Math.max(0.0001, k1.t - k0.t);
    const localT = THREE.MathUtils.smoothstep(
      (cycleT - k0.t) / span,
      0,
      1
    );

    scratchColors.zenith.lerpColors(k0.zenith, k1.zenith, localT);
    scratchColors.mid.lerpColors(k0.mid, k1.mid, localT);
    scratchColors.horizon.lerpColors(k0.horizon, k1.horizon, localT);
    scratchColors.band1.lerpColors(scratchColors.horizon, scratchColors.mid, 0.5);
    scratchColors.band3.lerpColors(scratchColors.mid, scratchColors.zenith, 0.5);
    scratchColors.cloud.lerpColors(k0.cloud, k1.cloud, localT);
    scratchColors.sun.lerpColors(k0.sun, k1.sun, localT);
    scratchColors.halo.lerpColors(k0.halo, k1.halo, localT);
    scratchColors.light.lerpColors(k0.lightCol, k1.lightCol, localT);
    scratchColors.beam.lerpColors(k0.beamCol, k1.beamCol, localT);
    scratchColors.winGlass.lerpColors(k0.winGlass, k1.winGlass, localT);
    scratchColors.bgFog.lerpColors(k0.bgFog, k1.bgFog, localT);

    const lightInt = THREE.MathUtils.lerp(k0.lightInt, k1.lightInt, localT);
    const beamOp = THREE.MathUtils.lerp(k0.beamOp, k1.beamOp, localT);
    const nightFactor = THREE.MathUtils.lerp(k0.night, k1.night, localT);

    // Update 5 Sky Gradient Bands outside the window
    if (skyBand0MatRef.current) skyBand0MatRef.current.color.copy(scratchColors.horizon);
    if (skyBand1MatRef.current) skyBand1MatRef.current.color.copy(scratchColors.band1);
    if (skyBand2MatRef.current) skyBand2MatRef.current.color.copy(scratchColors.mid);
    if (skyBand3MatRef.current) skyBand3MatRef.current.color.copy(scratchColors.band3);
    if (skyBand4MatRef.current) skyBand4MatRef.current.color.copy(scratchColors.zenith);

    // Update Scene Background & Fog so the sky beyond the road matches seamlessly
    if (state.scene.background instanceof THREE.Color) {
      state.scene.background.copy(scratchColors.bgFog);
    }
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(scratchColors.bgFog);
    }

    // Sun Arc across the window sky (rises in East +X at t=0, peaks at t=0.30, sets in West -X at t=0.72)
    if (sunGroupRef.current) {
      const dayProgress = Math.min(1, cycleT / 0.78);
      const sunAngle = dayProgress * Math.PI; // 0 -> PI
      const sunX = Math.cos(sunAngle) * 5.2; // +5.2 (East) -> -5.2 (West)
      const sunY = 0.55 + Math.sin(sunAngle) * 3.85 - (cycleT > 0.75 ? (cycleT - 0.75) * 12 : 0);
      sunGroupRef.current.position.set(sunX, sunY, 15.6);
      // Enlarge Sun slightly during Golden Sunset (t = 0.52..0.75)
      const sunsetBoost =
        cycleT > 0.48 && cycleT < 0.78
          ? 1 + Math.sin(((cycleT - 0.48) / 0.3) * Math.PI) * 0.42
          : 1;
      sunGroupRef.current.scale.setScalar(sunsetBoost);
      sunGroupRef.current.visible = sunY > -0.8;

      if (outdoorDirLightRef.current) {
        outdoorDirLightRef.current.position.set(
          sunX * 1.4,
          Math.max(1.8, sunY * 2.1),
          13.5
        );
        outdoorDirLightRef.current.color.copy(scratchColors.light);
        outdoorDirLightRef.current.intensity = lightInt;
      }
      if (windowSunbeamGroupRef.current) {
        windowSunbeamGroupRef.current.position.x = -sunX * 0.08;
      }
    }
    if (sunCoreMatRef.current) sunCoreMatRef.current.color.copy(scratchColors.sun);
    if (sunHaloMatRef.current) {
      sunHaloMatRef.current.color.copy(scratchColors.halo);
      sunHaloMatRef.current.opacity =
        cycleT > 0.45 && cycleT < 0.78 ? 0.52 : 0.26;
    }

    // Update Outdoor Hemisphere Light
    if (outdoorHemiLightRef.current) {
      outdoorHemiLightRef.current.color.copy(scratchColors.mid);
      outdoorHemiLightRef.current.intensity = 0.35 + (1 - nightFactor) * 0.45;
    }

    // Update Crescent Moon & Twinkling Stars in the Evening/Night Sky
    if (moonGroupRef.current && moonMatRef.current) {
      moonGroupRef.current.visible = nightFactor > 0.08;
      const moonY = 1.6 + nightFactor * 2.15;
      moonGroupRef.current.position.set(-2.35, moonY, 15.5);
      moonMatRef.current.opacity = nightFactor * 0.95;
    }
    if (starsGroupRef.current) {
      starsGroupRef.current.visible = nightFactor > 0.15;
      starsGroupRef.current.children.forEach((starMesh, idx) => {
        const mat = (starMesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat) {
          const twinkle = 0.55 + 0.45 * Math.sin(elapsed * 3.2 + idx * 1.7);
          mat.opacity = Math.max(0, (nightFactor - 0.15) / 0.85) * twinkle;
        }
      });
    }

    // Drift 5 Cloud Clusters slowly across the window sky & tint them
    skySharedMats.cloud.color.copy(scratchColors.cloud);
    skySharedMats.cloud.emissive.copy(scratchColors.halo);
    skySharedMats.cloud.emissiveIntensity =
      cycleT > 0.48 && cycleT < 0.76 ? 0.28 : 0.04;

    cloudGroupRefs.current.forEach((cg, idx) => {
      if (!cg) return;
      const baseSpeed = 0.18 + (idx % 3) * 0.06;
      const startX = -8 + idx * 4.2;
      const wrappedX = ((((startX + elapsed * baseSpeed) + 11) % 22) + 22) % 22 - 11;
      cg.position.x = wrappedX;
    });

    // Streetlamps & Across-the-Street Neighborhood Building Windows (Auto-turn on at Sunset/Evening!)
    skySharedMats.streetLampGlobe.emissiveIntensity = nightFactor * 1.45;
    if (streetLampLeftLightRef.current) {
      streetLampLeftLightRef.current.intensity = nightFactor * 1.65;
    }
    if (streetLampRightLightRef.current) {
      streetLampRightLightRef.current.intensity = nightFactor * 1.65;
    }
    skySharedMats.buildingWin.color.lerpColors(
      scratchColors.winGlowOff,
      scratchColors.winGlowOn,
      nightFactor
    );

    // Storefront Window Glass Tint & Interior Floor Sunbeam / Sunset Glow Patch
    skySharedMats.windowGlass.color.copy(scratchColors.winGlass);
    skySharedMats.sunbeam.color.copy(scratchColors.beam);
    skySharedMats.sunbeam.opacity = beamOp;
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
      // Back 6 Columns (6열) of Dark Walnut Bookcase (KakaoTalk_261106_114029_01.jpg)
      [-1.18, -0.61],
      [-1.81, -1.24],
      [-2.44, -1.87],
      [-3.07, -2.5],
      [-3.7, -3.13],
      [-4.33, -3.76],
    ];

    for (const [zStart, zEnd] of bayRanges) {
      for (let sIdx = 0; sIdx < shelfHeights.length; sIdx++) {
        // Leave space on top shelf of bay 1 for Pepsi/Chilsung crates & bay 5 for Christmas Village
        if (sIdx === 5 && (zStart > 4.3 || (zStart > 0.5 && zStart < 1.5))) {
          continue;
        }
        // Leave space on bottom shelf of back-leftmost bay for Red Coca-Cola crate, and 3rd shelf of 5th back bay for miniatures
        if (
          (sIdx === 0 && zStart < -3.72) ||
          (sIdx === 2 && zStart < -3.12 && zStart > -3.72)
        ) {
          continue;
        }
        const yBase = shelfHeights[sIdx];
        const bayMid = (zStart + zEnd) * 0.5;
        let zCursor = zStart + 0.04;
        while (zCursor < zEnd - 0.05) {
          // Leave a clean face-out display slot on 3rd shelf (sIdx === 2) in the 5 front bays for each genre's 1 representative book
          if (sIdx === 2 && zStart > 0.5 && Math.abs(zCursor - bayMid) < 0.16) {
            zCursor += 0.04;
            continue;
          }
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
    if (moveDist > 4) return;
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
        ref={outdoorHemiLightRef}
        color="#e58450"
        groundColor="#3e352f"
        intensity={0.7}
      />

      {/* Outdoor Street Daylight / Sunset / Evening Moonlight */}
      <directionalLight
        ref={outdoorDirLightRef}
        position={[-2, 7.5, 13]}
        intensity={0.95}
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

        {/* Across-the-Street White Guardrail, Green Street Trees & Vintage Streetlamps */}
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

          {/* 2 Vintage Cast-Iron Streetlamps Across the Street (Auto-Light Up at Sunset & Evening!) */}
          {[-2.25, 2.45].map((lx, lIdx) => (
            <group key={`streetlamp-${lIdx}`} position={[lx, 0, -0.15]}>
              {/* Cast-Iron Post & Base */}
              <mesh position={[0, 1.45, 0]}>
                <cylinderGeometry args={[0.038, 0.065, 2.9, 10]} />
                <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.4} />
              </mesh>
              {/* Warm Glowing Lantern Globe */}
              <mesh
                position={[0, 2.98, 0]}
                material={skySharedMats.streetLampGlobe}
              >
                <sphereGeometry args={[0.16, 14, 14]} />
              </mesh>
              {/* Lantern Hat */}
              <mesh position={[0, 3.16, 0]}>
                <coneGeometry args={[0.2, 0.12, 12]} />
                <meshStandardMaterial color="#18181b" metalness={0.6} />
              </mesh>
            </group>
          ))}
          <pointLight
            ref={streetLampLeftLightRef}
            position={[-2.25, 2.85, -0.15]}
            color="#fbbf24"
            intensity={0}
            distance={7.5}
          />
          <pointLight
            ref={streetLampRightLightRef}
            position={[2.45, 2.85, -0.15]}
            color="#fbbf24"
            intensity={0}
            distance={7.5}
          />
        </group>

        {/* ============================================================
            3-MINUTE DYNAMIC WINDOW SCENERY PANORAMA (Z = +13.4 .. +16.5)
            Transitions smoothly over 3 minutes:
            Morning Sunrise -> Bright Midday -> Golden/Crimson Sunset -> Starry Evening
           ============================================================ */}
        {/* 1) 5-Band Panoramic Sky Gradient Backdrop Facing the Storefront Windows */}
        <group position={[0, 0, 16.5]} rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <planeGeometry args={[34, 1.8]} />
            <meshBasicMaterial ref={skyBand0MatRef} color="#fde68a" fog={false} />
          </mesh>
          <mesh position={[0, 2.15, 0]}>
            <planeGeometry args={[34, 1.7]} />
            <meshBasicMaterial ref={skyBand1MatRef} color="#bfdbfe" fog={false} />
          </mesh>
          <mesh position={[0, 3.85, 0]}>
            <planeGeometry args={[34, 1.8]} />
            <meshBasicMaterial ref={skyBand2MatRef} color="#93c5fd" fog={false} />
          </mesh>
          <mesh position={[0, 5.65, 0]}>
            <planeGeometry args={[34, 1.9]} />
            <meshBasicMaterial ref={skyBand3MatRef} color="#60a5fa" fog={false} />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <planeGeometry args={[34, 3.4]} />
            <meshBasicMaterial ref={skyBand4MatRef} color="#38bdf8" fog={false} />
          </mesh>
        </group>

        {/* 2) Animated Sun Orb & Glowing Sunset Halo Ring (`sunGroupRef`) */}
        <group ref={sunGroupRef} position={[4.5, 1.8, 15.6]} rotation={[0, Math.PI, 0]}>
          {/* Outer Sunset Glow Halo */}
          <mesh position={[0, 0, -0.05]}>
            <circleGeometry args={[1.45, 32]} />
            <meshBasicMaterial
              ref={sunHaloMatRef}
              color="#fbbf24"
              transparent
              opacity={0.32}
              fog={false}
            />
          </mesh>
          {/* Bright Sun Core Disc */}
          <mesh>
            <circleGeometry args={[0.62, 28]} />
            <meshBasicMaterial ref={sunCoreMatRef} color="#fef08a" fog={false} />
          </mesh>
        </group>

        {/* 3) Evening Crescent Moon & 24 Twinkling Night Stars (`moonGroupRef`, `starsGroupRef`) */}
        <group
          ref={moonGroupRef}
          position={[-2.35, 3.6, 15.5]}
          rotation={[0, Math.PI, 0]}
          visible={false}
        >
          <mesh>
            <circleGeometry args={[0.38, 24]} />
            <meshBasicMaterial
              ref={moonMatRef}
              color="#fef08a"
              transparent
              opacity={0}
              fog={false}
            />
          </mesh>
        </group>

        <group ref={starsGroupRef} position={[0, 0, 15.8]} visible={false}>
          {[
            [-6.2, 4.8],
            [-5.1, 3.6],
            [-4.2, 5.2],
            [-3.4, 4.1],
            [-2.8, 4.9],
            [-1.9, 3.4],
            [-1.1, 4.6],
            [-0.3, 3.8],
            [0.6, 5.1],
            [1.4, 3.5],
            [2.2, 4.4],
            [3.1, 3.7],
            [3.9, 5.0],
            [4.8, 3.9],
            [5.7, 4.7],
            [-3.8, 2.9],
            [-1.5, 2.8],
            [1.8, 2.9],
            [3.5, 2.8],
            [0.2, 4.3],
          ].map(([sx, sy], sIdx) => (
            <mesh
              key={`star-${sIdx}`}
              position={[sx, sy, 0]}
              rotation={[0, Math.PI, 0]}
            >
              <circleGeometry args={[0.042 + (sIdx % 3) * 0.015, 8]} />
              <meshBasicMaterial
                color="#fffbeb"
                transparent
                opacity={0}
                fog={false}
              />
            </mesh>
          ))}
        </group>

        {/* 4) 5 Drifting 3D Cloud Clusters Outside the Window (`cloudGroupRefs`) */}
        {[
          [-6.5, 3.6, 14.5, 1.0],
          [-2.5, 4.1, 14.8, 1.15],
          [1.5, 3.4, 14.4, 0.95],
          [5.2, 3.9, 14.7, 1.1],
          [8.5, 3.5, 14.6, 0.9],
        ].map(([cx, cy, cz, cScale], cIdx) => (
          <group
            key={`cloud-cluster-${cIdx}`}
            ref={(el) => {
              cloudGroupRefs.current[cIdx] = el;
            }}
            position={[cx, cy, cz]}
            scale={[cScale, cScale * 0.68, cScale * 0.55]}
          >
            <mesh position={[0, 0, 0]} material={skySharedMats.cloud}>
              <sphereGeometry args={[0.62, 12, 12]} />
            </mesh>
            <mesh position={[-0.48, -0.1, 0.05]} material={skySharedMats.cloud}>
              <sphereGeometry args={[0.46, 10, 10]} />
            </mesh>
            <mesh position={[0.5, -0.08, -0.04]} material={skySharedMats.cloud}>
              <sphereGeometry args={[0.48, 10, 10]} />
            </mesh>
          </group>
        ))}

        {/* 5) Across-the-Street Neighborhood Buildings & Rooftops with Cozy Evening Windows (Z = +13.6) */}
        <group position={[0, -0.18, 13.6]}>
          {[
            [-6.2, 2.2, 2.4, '#27272a'],
            [-3.6, 2.6, 2.2, '#1e293b'],
            [-1.2, 1.9, 2.1, '#334155'],
            [1.3, 2.4, 2.3, '#1f2937'],
            [3.9, 2.1, 2.2, '#27272a'],
            [6.4, 2.5, 2.4, '#1e293b'],
          ].map(([bx, bh, bw, bCol], bIdx) => (
            <group key={`n-bldg-${bIdx}`} position={[Number(bx), 0, 0]}>
              <mesh position={[0, Number(bh) / 2, 0]}>
                <boxGeometry args={[Number(bw), Number(bh), 0.9]} />
                <meshStandardMaterial color={String(bCol)} roughness={0.88} />
              </mesh>
              {/* Warm Lit Windows on Across-the-Street Buildings (Glow Golden in Sunset/Evening!) */}
              {[-0.48, 0.48].map((wx, wIdx) =>
                [0.75, 1.45].map((wy, wyIdx) => (
                  <mesh
                    key={`bwin-${wIdx}-${wyIdx}`}
                    position={[wx, wy, -0.46]}
                    rotation={[0, Math.PI, 0]}
                    material={skySharedMats.buildingWin}
                  >
                    <planeGeometry args={[0.34, 0.38]} />
                  </mesh>
                ))
              )}
            </group>
          ))}
        </group>

        {/* 6) Interior Window Sunbeam & Sunset Glow Patches Cast onto the Bookstore Floor (`Z = +5.35`) */}
        <group ref={windowSunbeamGroupRef} position={[0, 0.012, 5.35]}>
          <mesh
            position={[-2.52, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={skySharedMats.sunbeam}
          >
            <planeGeometry args={[2.85, 1.45]} />
          </mesh>
          <mesh
            position={[2.68, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={skySharedMats.sunbeam}
          >
            <planeGeometry args={[2.65, 1.45]} />
          </mesh>
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

      {/* Back Navy & Beige Patterned Vintage Persian Rug (between leather workbench, personal study & back bookcase/bicycle) */}
      <group position={[1.15, 0.008, -2.35]}>
        {/* Outer Warm Beige Fringe Border */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.35, 3.65]} />
          <meshStandardMaterial color="#d2c09e" roughness={0.92} />
        </mesh>
        {/* Deep Navy Ornate Frame */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[2.98, 3.28]} />
          <meshStandardMaterial color="#1b263b" roughness={0.9} />
        </mesh>
        {/* Beige & Gold Geometric Inner Border */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[2.52, 2.82]} />
          <meshStandardMaterial color="#c5b088" roughness={0.9} />
        </mesh>
        {/* Midnight Navy Center Field */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[2.22, 2.52]} />
          <meshStandardMaterial color="#162032" roughness={0.9} />
        </mesh>
        {/* Center Beige/Crimson Persian Floral Medallion */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <circleGeometry args={[0.52, 24]} />
          <meshStandardMaterial color="#cbb58b" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
          <circleGeometry args={[0.26, 20]} />
          <meshStandardMaterial color="#7f2929" roughness={0.9} />
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
            <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
              오렌지 천장과 크리스탈 샹들리에
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
        {/* Red Brick Left & Right Outer Corner Columns (Flush with exterior corners so Left Window reaches West Wall!) */}
        <mesh position={[-4.42, 1.72, 0.04]} castShadow>
          <boxGeometry args={[0.36, 3.45, 0.34]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>
        <mesh position={[4.42, 1.72, 0.04]} castShadow>
          <boxGeometry args={[0.36, 3.45, 0.34]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>

        {/* Top Brick Facade Header & Soldier Brick Lintel */}
        <mesh position={[0, 3.16, 0]}>
          <boxGeometry args={[9.1, 0.58, 0.36]} />
          <meshStandardMaterial color="#8c3322" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.82, 0.02]}>
          <boxGeometry args={[8.6, 0.16, 0.38]} />
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

        {/* Glass Storefront Windows Left & Right of the Open Doorway (Reaching all the way to the West/East Walls) */}
        <mesh
          position={[-2.52, 1.38, 0.02]}
          material={skySharedMats.windowGlass}
        >
          <planeGeometry args={[3.56, 2.72]} />
        </mesh>
        <mesh
          position={[2.68, 1.38, 0.02]}
          material={skySharedMats.windowGlass}
        >
          <planeGeometry args={[3.28, 2.72]} />
        </mesh>

        {/* Open Vintage Distressed White/Wood Double Entrance Doors (Walkable Open Passage!) */}
        <group position={[0.15, 0, 0]}>
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
        </group>

        {/* ============================================================
            REALISTIC MULTI-PLEATED GATHERED SHEER FLORAL-LACE CURTAINS
            (Left Window Curtain by the Desk & Right Window Curtain by Plants)
           ============================================================ */}
        {/* Top Wooden/Brass Curtain Rods across Left & Right Windows */}
        <mesh position={[-2.54, 2.71, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 3.6, 10]} />
          <meshStandardMaterial color="#785232" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[2.68, 2.71, -0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.016, 0.016, 3.3, 10]} />
          <meshStandardMaterial color="#785232" metalness={0.4} roughness={0.5} />
        </mesh>

        {/* Top Ruffled Lace Valance Header along both Curtain Rods (Continuous soft pleats) */}
        {Array.from({ length: 34 }).map((_, idx) => {
          const lx = -4.3 + idx * 0.103;
          return (
            <mesh
              key={`valance-l-${idx}`}
              position={[lx, 2.64, -0.2 + (idx % 2 === 0 ? -0.012 : 0.012)]}
            >
              <cylinderGeometry args={[0.048, 0.054, 0.16, 10]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#f8f1e7' : '#efe4d4'}
                transparent
                opacity={0.82}
                roughness={0.92}
              />
            </mesh>
          );
        })}
        {Array.from({ length: 32 }).map((_, idx) => {
          const rx = 1.08 + idx * 0.102;
          return (
            <mesh
              key={`valance-r-${idx}`}
              position={[rx, 2.64, -0.2 + (idx % 2 === 0 ? -0.012 : 0.012)]}
            >
              <cylinderGeometry args={[0.048, 0.054, 0.16, 10]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#f8f1e7' : '#efe4d4'}
                transparent
                opacity={0.82}
                roughness={0.92}
              />
            </mesh>
          );
        })}

        {/* 1) Left Storefront Window Gathered Lace Curtain (Sweeping smoothly into West Corner behind Desk Lamp!) */}
        <group position={[0, 0, -0.22]}>
          {Array.from({ length: 18 }).map((_, i) => {
            const t = i / 17;
            // Top spreads along the rod from X = -4.32 to X = -2.92; gathers into a snug waist at X = -4.20..-4.02
            const topX = -4.32 + t * 1.4;
            const tieX = -4.21 + t * 0.19;
            const botX = -4.28 + t * 0.36;
            const waveZ = (i % 2 === 0 ? -0.018 : 0.018) + Math.sin(i * 1.1) * 0.008;

            // Upper sweeping pleat segment (Y = 2.68 down to Y = 1.16)
            const upMidX = (topX + tieX) / 2;
            const upMidY = (2.68 + 1.16) / 2;
            const upDx = topX - tieX;
            const upDy = 2.68 - 1.16;
            const upLen = Math.hypot(upDx, upDy);
            const upAngleZ = -Math.atan2(upDx, upDy);

            // Lower pleated skirt segment (Y = 1.16 down to Y = 0.08)
            const lowMidX = (tieX + botX) / 2;
            const lowMidY = (1.16 + 0.08) / 2;
            const lowDx = tieX - botX;
            const lowDy = 1.16 - 0.08;
            const lowLen = Math.hypot(lowDx, lowDy);
            const lowAngleZ = -Math.atan2(lowDx, lowDy);

            const shade = i % 2 === 0 ? '#f8f1e7' : '#efe4d4';

            return (
              <group key={`curtain-left-fold-${i}`}>
                {/* Upper Pleated Drapery Fold */}
                <mesh
                  position={[upMidX, upMidY, waveZ]}
                  rotation={[0, 0, upAngleZ]}
                >
                  <cylinderGeometry args={[0.052, 0.022, upLen, 10]} />
                  <meshStandardMaterial
                    color={shade}
                    transparent
                    opacity={0.86}
                    roughness={0.92}
                  />
                </mesh>
                {/* Lower Pleated Skirt Fold */}
                <mesh
                  position={[lowMidX, lowMidY, waveZ]}
                  rotation={[0, 0, lowAngleZ]}
                >
                  <cylinderGeometry args={[0.022, 0.038, lowLen, 10]} />
                  <meshStandardMaterial
                    color={shade}
                    transparent
                    opacity={0.88}
                    roughness={0.92}
                  />
                </mesh>
              </group>
            );
          })}
          {/* Snug Fabric Curtain Tie-Back Band at Y = 1.16 */}
          <mesh position={[-4.11, 1.16, 0]} rotation={[0, 0, -0.1]}>
            <cylinderGeometry args={[0.118, 0.112, 0.055, 18]} />
            <meshStandardMaterial color="#dfd1be" roughness={0.85} />
          </mesh>
        </group>

        {/* Black Geometric Wire-Cage Pendant Light & Warm Fairy String Bulbs over Left Window (entrance_interior.jpg) */}
        <group position={[-3.28, 2.28, -0.52]}>
          {/* Pendant Cord from Ceiling */}
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 1.16, 6]} />
            <meshBasicMaterial color="#18181b" />
          </mesh>
          {/* Black Wire-Cage Diamond Shade */}
          <mesh>
            <octahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial color="#18181b" wireframe />
          </mesh>
          {/* Warm Glowing Edison Bulb inside Cage */}
          <mesh position={[0, -0.02, 0]}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial color="#fde68a" />
          </mesh>
          {/* Draped Fairy Light String with 7 Glowing Mini Bulbs toward West Wall */}
          {Array.from({ length: 7 }).map((_, bIdx) => {
            const t = (bIdx + 1) / 8;
            const bx = -t * 1.05;
            const by = -Math.sin(t * Math.PI) * 0.18 + t * 0.12;
            const bz = t * 0.25;
            return (
              <mesh key={`fairy-${bIdx}`} position={[bx, by, bz]}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
            );
          })}
        </group>

        {/* 2) Right Storefront Window Gathered Lace Curtain (Behind Potted Plants & Wine Bottles!) */}
        <group position={[0, 0, -0.22]}>
          {Array.from({ length: 18 }).map((_, i) => {
            const t = i / 17;
            const topX = 2.88 + t * 1.42;
            const tieX = 3.96 + t * 0.19;
            const botX = 3.88 + t * 0.36;
            const waveZ = (i % 2 === 0 ? -0.018 : 0.018) + Math.cos(i * 1.1) * 0.008;

            const upMidX = (topX + tieX) / 2;
            const upMidY = (2.68 + 1.16) / 2;
            const upDx = topX - tieX;
            const upDy = 2.68 - 1.16;
            const upLen = Math.hypot(upDx, upDy);
            const upAngleZ = -Math.atan2(upDx, upDy);

            const lowMidX = (tieX + botX) / 2;
            const lowMidY = (1.16 + 0.08) / 2;
            const lowDx = tieX - botX;
            const lowDy = 1.16 - 0.08;
            const lowLen = Math.hypot(lowDx, lowDy);
            const lowAngleZ = -Math.atan2(lowDx, lowDy);

            const shade = i % 2 === 0 ? '#f8f1e7' : '#efe4d4';

            return (
              <group key={`curtain-right-fold-${i}`}>
                <mesh
                  position={[upMidX, upMidY, waveZ]}
                  rotation={[0, 0, upAngleZ]}
                >
                  <cylinderGeometry args={[0.052, 0.022, upLen, 10]} />
                  <meshStandardMaterial
                    color={shade}
                    transparent
                    opacity={0.86}
                    roughness={0.92}
                  />
                </mesh>
                <mesh
                  position={[lowMidX, lowMidY, waveZ]}
                  rotation={[0, 0, lowAngleZ]}
                >
                  <cylinderGeometry args={[0.022, 0.038, lowLen, 10]} />
                  <meshStandardMaterial
                    color={shade}
                    transparent
                    opacity={0.88}
                    roughness={0.92}
                  />
                </mesh>
              </group>
            );
          })}
          {/* Snug Fabric Curtain Tie-Back Band at Y = 1.16 */}
          <mesh position={[4.05, 1.16, 0]} rotation={[0, 0, 0.1]}>
            <cylinderGeometry args={[0.118, 0.112, 0.055, 18]} />
            <meshStandardMaterial color="#dfd1be" roughness={0.85} />
          </mesh>
        </group>

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
          6. WINDOW READING DESK (FLUSH AGAINST WEST WALL), BOOK CART & ARMCHAIR
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
            {/* Rolling Book Cart / Trolley ('책값 돌려주기') & Umbrella Stand right beside the Desk */}
            <group position={[-2.38, 0, 5.88]}>
              {/* Ochre-Yellow Rolling Cart Body */}
              <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.64, 0.68, 0.48]} />
                <meshStandardMaterial color="#d99b16" roughness={0.55} />
              </mesh>
              {/* Dark Rim Tray Top */}
              <mesh position={[0, 0.78, 0]} castShadow>
                <boxGeometry args={[0.68, 0.045, 0.52]} />
                <meshStandardMaterial color="#27272a" roughness={0.5} />
              </mesh>
              {/* 4 Caster Wheels under Cart */}
              {[
                [-0.26, 0.04, -0.18],
                [0.26, 0.04, -0.18],
                [-0.26, 0.04, 0.18],
                [0.26, 0.04, 0.18],
              ].map(([wx, wy, wz], wIdx) => (
                <mesh key={wIdx} position={[wx, wy, wz]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.04, 10]} />
                  <meshStandardMaterial color="#18181b" />
                </mesh>
              ))}
              {/* White '책값 돌려주기' Notice Sheet taped on Cart Side */}
              <mesh position={[0.322, 0.48, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.26, 0.34]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
              {/* White Lighthouse Figurine with Red Lantern Top on Cart */}
              <group position={[0.16, 0.8, -0.08]}>
                <mesh position={[0, 0.11, 0]} castShadow>
                  <cylinderGeometry args={[0.028, 0.052, 0.22, 12]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.23, 0]}>
                  <coneGeometry args={[0.036, 0.05, 12]} />
                  <meshStandardMaterial color="#dc2626" />
                </mesh>
              </group>
              {/* Small Stack of Curated/Returned Books on Cart Top */}
              <mesh position={[-0.12, 0.82, 0.04]} castShadow>
                <boxGeometry args={[0.22, 0.045, 0.18]} />
                <meshStandardMaterial color="#fef3c7" roughness={0.6} />
              </mesh>
              <mesh position={[-0.1, 0.86, 0.03]} rotation={[0, 0.12, 0]} castShadow>
                <boxGeometry args={[0.2, 0.038, 0.16]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.6} />
              </mesh>

              {/* Matte Black Cylindrical Umbrella Stand & Red/Black Umbrellas right next to Cart */}
              <group position={[0.5, 0, 0.06]}>
                <mesh position={[0, 0.23, 0]} castShadow>
                  <cylinderGeometry args={[0.105, 0.1, 0.46, 14]} />
                  <meshStandardMaterial color="#18181b" roughness={0.5} />
                </mesh>
                {/* Bright Red Long Umbrella */}
                <mesh position={[-0.02, 0.48, 0.02]} rotation={[0.05, 0, -0.08]} castShadow>
                  <cylinderGeometry args={[0.022, 0.038, 0.68, 10]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.45} />
                </mesh>
                {/* Dark Navy/Black Umbrella */}
                <mesh position={[0.03, 0.45, -0.03]} rotation={[-0.06, 0, 0.1]} castShadow>
                  <cylinderGeometry args={[0.02, 0.034, 0.62, 10]} />
                  <meshStandardMaterial color="#27272a" roughness={0.5} />
                </mesh>
              </group>
            </group>

            {/* Window Wooden Reading Desk — Pushed Flush Against the West Wood Wall (X = -4.36..-2.80) & Window! */}
            <group
              position={deskData.position}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTable(deskData);
              }}
              onPointerOver={() => setHoveredTableId(deskData.id)}
              onPointerOut={() => setHoveredTableId(null)}
            >
              {/* Warm Walnut Tabletop (1.56m wide so West edge touches West wall at X = -4.36!) */}
              <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.56, 0.055, 0.72]} />
                <meshStandardMaterial color="#8b5a2b" roughness={0.68} />
              </mesh>
              {/* Under-table Apron Frame */}
              <mesh position={[0, 0.68, 0]}>
                <boxGeometry args={[1.46, 0.06, 0.62]} />
                <meshStandardMaterial color="#6e441f" roughness={0.75} />
              </mesh>
              {/* 4 Wooden Desk Legs */}
              {[
                [-0.72, 0.37, -0.3],
                [0.72, 0.37, -0.3],
                [-0.72, 0.37, 0.3],
                [0.72, 0.37, 0.3],
              ].map(([lx, ly, lz], idx) => (
                <mesh key={idx} position={[lx, ly, lz]} castShadow>
                  <boxGeometry args={[0.055, 0.74, 0.055]} />
                  <meshStandardMaterial color="#6e441f" roughness={0.75} />
                </mesh>
              ))}

              {/* Soft Sage-Green Cylindrical Basket / Pouf tucked under Desk */}
              <mesh position={[-0.22, 0.22, 0.08]} castShadow>
                <cylinderGeometry args={[0.17, 0.15, 0.44, 14]} />
                <meshStandardMaterial color="#68a378" roughness={0.75} />
              </mesh>

              {/* Signature Glowing Orange Mushroom Lamp (Right/West Corner near Wall & Curtain) */}
              <group position={[-0.48, 0.77, 0.06]}>
                <mesh position={[0, 0.12, 0]} castShadow>
                  <cylinderGeometry args={[0.032, 0.068, 0.24, 14]} />
                  <meshStandardMaterial color="#ea580c" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.24, 0]} castShadow>
                  <sphereGeometry
                    args={[0.135, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]}
                  />
                  <meshStandardMaterial
                    color="#f97316"
                    emissive="#ea580c"
                    emissiveIntensity={windowLampOn ? 0.72 : 0.12}
                  />
                </mesh>
              </group>

              {/* Dark Green/Black Bottle behind Lamp */}
              <mesh position={[-0.64, 0.87, 0.18]} castShadow>
                <cylinderGeometry args={[0.032, 0.036, 0.2, 10]} />
                <meshStandardMaterial color="#1e2923" roughness={0.3} />
              </mesh>

              {/* Open Laptop / Monitor & Keyboard Base in Center of Desk */}
              <group position={[0.04, 0.77, 0.02]}>
                {/* Keyboard Base & Desk Mat */}
                <mesh position={[0, 0.01, -0.06]}>
                  <boxGeometry args={[0.42, 0.018, 0.26]} />
                  <meshStandardMaterial color="#27272a" roughness={0.6} />
                </mesh>
                {/* Angled Laptop / Monitor Screen */}
                <mesh position={[0, 0.15, 0.08]} rotation={[0.15, 0, 0]} castShadow>
                  <boxGeometry args={[0.44, 0.28, 0.022]} />
                  <meshStandardMaterial color="#18181b" roughness={0.35} />
                </mesh>
              </group>

              {/* Small Book Stack & Wooden Pen Cup on Left/East End of Desk */}
              <mesh position={[0.5, 0.79, 0.08]} castShadow>
                <boxGeometry args={[0.2, 0.045, 0.25]} />
                <meshStandardMaterial color="#e7d5b8" roughness={0.65} />
              </mesh>
              <mesh position={[0.66, 0.82, 0.14]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.1, 10]} />
                <meshStandardMaterial color="#784721" roughness={0.7} />
              </mesh>

              {hoveredTableId === deskData.id && (
                <Html position={[0, 1.25, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                    창가 독서 책상
                  </div>
                </Html>
              )}
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

            {/* Mid-Century Wooden Reading Armchair in front of Wall-Flush Desk */}
            <group
              position={chairData.seatPosition}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSeat(chairData);
              }}
              onPointerOver={() => setHoveredSeatId(chairData.id)}
              onPointerOut={() => setHoveredSeatId(null)}
            >
              {/* Dark Cushioned Seat Pad */}
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
              {/* Curved Walnut Backrest */}
              <mesh position={[0, 0.74, -0.22]} castShadow>
                <boxGeometry args={[0.56, 0.22, 0.045]} />
                <meshStandardMaterial color="#7c4a21" roughness={0.65} />
              </mesh>
              {/* Left & Right Wooden Armrests */}
              <mesh position={[-0.25, 0.61, -0.02]} castShadow>
                <boxGeometry args={[0.045, 0.035, 0.44]} />
                <meshStandardMaterial color="#7c4a21" roughness={0.65} />
              </mesh>
              <mesh position={[0.25, 0.61, -0.02]} castShadow>
                <boxGeometry args={[0.045, 0.035, 0.44]} />
                <meshStandardMaterial color="#7c4a21" roughness={0.65} />
              </mesh>
              {/* 4 Tapered Wooden Chair Legs + Backrest Supports */}
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
                  <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                    창가 독서 의자에 앉기
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
        {/* Multi-tone Reclaimed Wood Plank Strips reaching all the way to the Storefront Window! */}
        {[0.3, 0.65, 1.0, 1.35, 1.7, 2.05, 2.4, 2.75, 3.1].map((py, idx) => (
          <mesh key={idx} position={[-4.39, py, 3.55]}>
            <boxGeometry args={[0.022, 0.22, 6.05]} />
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

        {/* Rounded-Rectangle Wall Mirror & Small Duck Shadowbox Frame on Top (media_1794279939763_57a87c53.jpg) */}
        <group position={[-4.36, 1.76, 5.06]}>
          <mesh>
            <boxGeometry args={[0.08, 0.44, 0.34]} />
            <meshStandardMaterial color="#b4834e" roughness={0.6} />
          </mesh>
          <mesh position={[0.042, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.28, 0.38]} />
            <meshStandardMaterial
              color="#94a3b8"
              metalness={0.85}
              roughness={0.12}
            />
          </mesh>
          {/* Small Wooden Shadowbox with White Duck Figurine Sitting on Top of Mirror */}
          <group position={[0, 0.32, 0]}>
            <mesh>
              <boxGeometry args={[0.07, 0.19, 0.26]} />
              <meshStandardMaterial color="#b4834e" roughness={0.65} />
            </mesh>
            <mesh position={[0.02, -0.02, 0]}>
              <sphereGeometry args={[0.042, 10, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </mesh>
          </group>
        </group>

        {/* Two Large Light-Oak Framed Seascape Photographs with Wide White Mattes (media_1794279939763_57a87c53.jpg) */}
        {[3.92, 2.08].map((mz, idx) => (
          <group key={idx} position={[-4.36, 2.5, mz]}>
            {/* Natural Light-Oak Picture Frame */}
            <mesh castShadow>
              <boxGeometry args={[0.045, 0.78, 1.38]} />
              <meshStandardMaterial color="#c89d6c" roughness={0.6} />
            </mesh>
            {/* Wide Crisp White Matte */}
            <mesh position={[0.024, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.3, 0.7]} />
              <meshBasicMaterial color="#f8fafc" />
            </mesh>
            {/* Bright Blue Sky Photo Upper Area */}
            <mesh position={[0.026, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.04, 0.36]} />
              <meshBasicMaterial color="#60a5fa" />
            </mesh>
            {/* Turquoise Sea & Coastline Photo Lower Area */}
            <mesh position={[0.027, -0.14, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.04, 0.14]} />
              <meshBasicMaterial color={idx === 0 ? '#0284c7' : '#0ea5e9'} />
            </mesh>
            {idx === 0 ? (
              /* Left Frame: White Coastal Wind Turbine & Dark Basalt Shore */
              <>
                <mesh position={[0.028, -0.16, 0.1]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.76, 0.035]} />
                  <meshBasicMaterial color="#334155" />
                </mesh>
                <mesh position={[0.029, -0.02, 0.24]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.016, 0.26]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0.029, 0.11, 0.24]} rotation={[0.4, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.14, 0.01]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </>
            ) : (
              /* Right Frame: Curved Sandy Beach Spit & Headland */
              <>
                <mesh position={[0.028, -0.1, -0.12]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.68, 0.035]} />
                  <meshBasicMaterial color="#92400e" />
                </mesh>
                <mesh position={[0.028, -0.17, -0.18]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.52, 0.06]} />
                  <meshBasicMaterial color="#e7d5b8" />
                </mesh>
              </>
            )}
          </group>
        ))}

        {/* HIDDEN OBJECT #2 (`hidden_house_frame`): Framed Painting on Right Side of Wood Wall */}
        <group
          position={[-4.36, 2.26, 0.92]}
          onClick={(e) => {
            e.stopPropagation();
            onFindHiddenStamp('hidden_house_frame');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredHiddenId('hidden_house_frame');
          }}
          onPointerOut={() => setHoveredHiddenId(null)}
        >
          {/* Generous invisible touch/click collider */}
          <mesh visible={false}>
            <boxGeometry args={[0.25, 0.48, 0.48]} />
          </mesh>
          {/* Warm Wooden Picture Frame */}
          <mesh castShadow>
            <boxGeometry args={[0.045, 0.36, 0.36]} />
            <meshStandardMaterial
              color={
                hoveredHiddenId === 'hidden_house_frame' ? '#d97706' : '#a67c52'
              }
              roughness={0.55}
            />
          </mesh>
          {/* Sky-Blue Canvas Background */}
          <mesh position={[0.024, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.29, 0.29]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Green Hill at Bottom of Painting */}
          <mesh position={[0.026, -0.085, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.29, 0.12]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
          {/* Little White House Body in Painting */}
          <mesh position={[0.028, -0.015, 0.01]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.095, 0.075]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Bright Red Roof Triangle in Painting */}
          <mesh position={[0.03, 0.042, 0.01]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.068, 0.06, 4]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
          {/* Golden Sun in Top-Left of Painting */}
          <mesh position={[0.028, 0.088, -0.075]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.026, 14]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          {(hoveredHiddenId === 'hidden_house_frame' ||
            collectedStampIds.includes('hidden_house_frame')) && (
            <Html position={[0.12, 0.26, 0]} center zIndexRange={[6, 0]}>
              <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                {collectedStampIds.includes('hidden_house_frame')
                  ? '빨간 지붕 집 액자 확인'
                  : '빨간 지붕 집 액자 발견'}
              </div>
            </Html>
          )}
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

        {/* Upright Curated Books & Props on Left Wall 3-Tier Ledges (media_1794279939763_57a87c53.jpg)
            - 100% Straight Upright (`rotation={[0, Math.PI / 2, 0]}` — ZERO slant!)
            - Clicking ANY book on this shelf opens 박근태 『동경전 (東京傳)』! */}
        {/* Top Ledge Left: Wooden Clock with Black Rabbit Silhouette */}
        <group position={[-4.21, 1.635, 4.72]}>
          <mesh castShadow>
            <boxGeometry args={[0.05, 0.12, 0.12]} />
            <meshStandardMaterial color="#e5d5c0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.085, 0]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
        </group>
        {/* Top Ledge Right: Tiny White Ghost Figurine + Minimalist Black T-Bar Lamp */}
        <mesh position={[-4.2, 1.61, 1.28]} castShadow>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <group position={[-4.2, 1.62, 1.16]}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.07, 12]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.34, 8]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.39, 0]}>
            <boxGeometry args={[0.02, 0.012, 0.12]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
        </group>
        {/* Middle Ledge Left: Glass Terrarium Bowl on White Coaster */}
        <group position={[-4.2, 1.09, 4.68]}>
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, 0.018, 12]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.062, 0.052, 0.08, 12]} />
            <meshStandardMaterial color="#365314" roughness={0.4} />
          </mesh>
        </group>
        {/* Middle Ledge Right: Small Black Card Stand with Mini Orange Clip Lamp */}
        <group position={[-4.2, 1.13, 1.16]}>
          <mesh>
            <boxGeometry args={[0.04, 0.11, 0.09]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <coneGeometry args={[0.022, 0.035, 8]} />
            <meshStandardMaterial color="#ea580c" />
          </mesh>
        </group>

        {/* Stacked Natural Pine Lumber Beams under Bottom Ledge on Floor (media_1794279939763_57a87c53.jpg) */}
        <group position={[-4.16, 0.09, 2.95]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.17, 3.45]} />
            <meshStandardMaterial color="#e7d3b5" roughness={0.75} />
          </mesh>
          {[-0.65, 0.85].map((sz, sIdx) => (
            <mesh key={sIdx} position={[0.121, 0, sz]}>
              <boxGeometry args={[0.006, 0.174, 0.018]} />
              <meshBasicMaterial color="#dc2626" />
            </mesh>
          ))}
        </group>

        {/* All Upright Curated Books on the 3 Ledges (`rotation={[0, Math.PI / 2, 0]}`) — Clicking ANY book opens 박근태 『동경전』! */}
        {(() => {
          const tokyoDenBook = REPRESENTATIVE_BOOKS.find(
            (b) => b.id === 'book_tokyo_den'
          );
          const curatedWallBooks: Array<{
            pos: [number, number, number];
            size: [number, number, number];
            cover: string;
            band?: string;
            bandPos?: 'bottom' | 'center' | 'top';
          }> = [
            // Top Ledge (Y_top = 1.575 -> center Y = 1.71): 6 upright books
            { pos: [-4.21, 1.71, 4.26], size: [0.19, 0.27, 0.032], cover: '#f5f2eb', band: '#1e293b', bandPos: 'center' },
            { pos: [-4.21, 1.715, 3.70], size: [0.2, 0.28, 0.034], cover: '#ffffff', band: '#65a30d', bandPos: 'bottom' },
            { pos: [-4.21, 1.71, 3.12], size: [0.19, 0.27, 0.032], cover: '#ea580c', band: '#7c2d12', bandPos: 'top' },
            { pos: [-4.21, 1.715, 2.54], size: [0.2, 0.28, 0.034], cover: '#fef9c3', band: '#ca8a04', bandPos: 'bottom' },
            { pos: [-4.21, 1.71, 1.98], size: [0.19, 0.27, 0.032], cover: '#7e22ce', band: '#fde047', bandPos: 'center' },
            { pos: [-4.21, 1.71, 1.44], size: [0.19, 0.27, 0.032], cover: '#faf3e3', band: '#c2410c', bandPos: 'center' },

            // Middle Ledge (Y_top = 1.075 -> center Y = 1.215): 4 upright books + 東京傳 at Z = 1.52
            { pos: [-4.21, 1.22, 4.14], size: [0.21, 0.29, 0.034], cover: '#e5e0d8', band: '#dc2626', bandPos: 'center' },
            { pos: [-4.21, 1.215, 3.48], size: [0.2, 0.28, 0.034], cover: '#27272a', band: '#71717a', bandPos: 'bottom' },
            { pos: [-4.21, 1.21, 2.82], size: [0.19, 0.27, 0.034], cover: '#ffffff', band: '#ef4444', bandPos: 'bottom' },
            { pos: [-4.21, 1.215, 2.18], size: [0.2, 0.28, 0.038], cover: '#689f78', band: '#e11d48', bandPos: 'center' },

            // Bottom Ledge (Y_top = 0.525 -> center Y = 0.695): 4 large upright city photo books (Berlin, London, Vienna, Rome)
            { pos: [-4.21, 0.695, 4.28], size: [0.25, 0.34, 0.042], cover: '#60a5fa', band: '#334155', bandPos: 'bottom' },
            { pos: [-4.21, 0.695, 3.45], size: [0.25, 0.34, 0.042], cover: '#b91c1c', band: '#e7d5b8', bandPos: 'top' },
            { pos: [-4.21, 0.695, 2.60], size: [0.25, 0.34, 0.042], cover: '#475569', band: '#94a3b8', bandPos: 'top' },
            { pos: [-4.21, 0.695, 1.75], size: [0.25, 0.34, 0.042], cover: '#b45309', band: '#fed7aa', bandPos: 'top' },
          ];

          return curatedWallBooks.map((cb, idx) => (
            <group
              key={`dokja-wall-book-${idx}`}
              position={cb.pos}
              rotation={[0, Math.PI / 2, 0]}
              onClick={(e) => {
                e.stopPropagation();
                if (tokyoDenBook) onSelectBook(tokyoDenBook);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (tokyoDenBook) setHoveredBookId(tokyoDenBook.id);
              }}
              onPointerOut={() => setHoveredBookId(null)}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={cb.size} />
                <meshStandardMaterial color={cb.cover} roughness={0.48} />
              </mesh>
              {cb.band && (
                <mesh
                  position={[
                    0,
                    cb.bandPos === 'top'
                      ? cb.size[1] * 0.28
                      : cb.bandPos === 'bottom'
                      ? -cb.size[1] * 0.28
                      : 0,
                    cb.size[2] * 0.5 + 0.002,
                  ]}
                >
                  <planeGeometry
                    args={[
                      cb.bandPos === 'center' ? cb.size[0] * 0.55 : cb.size[0] * 0.98,
                      cb.bandPos === 'center' ? cb.size[1] * 0.42 : cb.size[1] * 0.36,
                    ]}
                  />
                  <meshStandardMaterial color={cb.band} roughness={0.5} />
                </mesh>
              )}
            </group>
          ));
        })()}
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
            <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
              마스코트 오리 포토존
            </div>
          </Html>
        )}
      </group>

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

        {/* HIDDEN OBJECT #5 (`hidden_mumu_dog`): Cute Black Puppy 'Mumu' Hiding on Lower Shelf of Divider Cabinet! */}
        <group
          position={[-0.18, 0.68, 0.08]}
          onClick={(e) => {
            e.stopPropagation();
            onFindHiddenStamp('hidden_mumu_dog');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredHiddenId('hidden_mumu_dog');
          }}
          onPointerOut={() => setHoveredHiddenId(null)}
        >
          {/* Generous invisible touch/click collider */}
          <mesh position={[0, 0.14, 0]} visible={false}>
            <boxGeometry args={[0.38, 0.38, 0.38]} />
          </mesh>
          {/* Fluffy Charcoal-Black Puppy Body */}
          <mesh position={[0, 0.09, -0.02]} castShadow>
            <sphereGeometry args={[0.095, 14, 14]} />
            <meshStandardMaterial color="#1c1917" roughness={0.85} />
          </mesh>
          {/* Fluffy Round Black Head */}
          <mesh position={[0, 0.2, 0.03]} castShadow>
            <sphereGeometry args={[0.088, 16, 16]} />
            <meshStandardMaterial color="#18181b" roughness={0.85} />
          </mesh>
          {/* Cute Floppy Black Ears (Left & Right) */}
          <mesh position={[-0.085, 0.19, 0.02]} rotation={[0, 0, 0.25]} castShadow>
            <boxGeometry args={[0.035, 0.11, 0.065]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>
          <mesh position={[0.085, 0.19, 0.02]} rotation={[0, 0, -0.25]} castShadow>
            <boxGeometry args={[0.035, 0.11, 0.065]} />
            <meshStandardMaterial color="#09090b" roughness={0.9} />
          </mesh>
          {/* Red Collar & Gold Bell around Mumu's Neck */}
          <mesh position={[0, 0.135, 0.025]} rotation={[0.15, 0, 0]}>
            <cylinderGeometry args={[0.068, 0.072, 0.022, 14]} />
            <meshStandardMaterial color="#dc2626" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.125, 0.092]}>
            <sphereGeometry args={[0.018, 10, 10]} />
            <meshStandardMaterial color="#facc15" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Shiny Eyes with White Catchlights */}
          <mesh position={[-0.032, 0.215, 0.108]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.032, 0.215, 0.108]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-0.032, 0.215, 0.116]}>
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshBasicMaterial color="#09090b" />
          </mesh>
          <mesh position={[0.032, 0.215, 0.116]}>
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshBasicMaterial color="#09090b" />
          </mesh>
          {/* Black Button Nose & Cute Pink Tongue Sticking Out (Just like '무무를 찾아라!') */}
          <mesh position={[0, 0.195, 0.118]}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshStandardMaterial color="#09090b" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.168, 0.112]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.026, 0.032, 0.01]} />
            <meshBasicMaterial color="#fb7185" />
          </mesh>
          {(hoveredHiddenId === 'hidden_mumu_dog' ||
            collectedStampIds.includes('hidden_mumu_dog')) && (
            <Html position={[0, 0.36, 0]} center zIndexRange={[6, 0]}>
              <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                {collectedStampIds.includes('hidden_mumu_dog')
                  ? '까만 강아지 무무 확인'
                  : '숨은 무무 발견'}
              </div>
            </Html>
          )}
        </group>
      </group>

      {/* ============================================================
          9. RIGHT WALL: 6-TIER MAIN WALNUT BOOKCASES, FRONT PROPS & BACK LEATHER/WINE
         ============================================================ */}
      <group>
        {/* Right Wall Plaster Background (Warm Off-White matching the Back Wall!) */}
        <mesh position={[4.52, 1.72, 0]} receiveShadow>
          <boxGeometry args={[0.2, 3.45, 13.6]} />
          <meshStandardMaterial color="#dfd9ce" roughness={0.85} />
        </mesh>
        {/* Dark Walnut Bookcase Backing Panel (Strictly behind the Walnut Bookcases Z = -4.28..+5.40, leaving the wall behind the Concrete-Block Shelf off-white!) */}
        <mesh position={[4.41, 1.48, 0.56]} receiveShadow>
          <boxGeometry args={[0.04, 2.94, 9.7]} />
          <meshStandardMaterial color="#2e1c10" roughness={0.85} />
        </mesh>

        {/* Wood-Paneled Structural Pillar dividing Front 5 Bays and Back 4 Bays */}
        <group position={[4.15, 1.72, -0.12]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.68, 3.45, 0.92]} />
            <meshStandardMaterial color="#59351c" roughness={0.75} />
          </mesh>
          {/* HIDDEN OBJECT #3 (`hidden_butterfly_frame`): Framed Blue Butterfly Artwork on Pillar */}
          <group
            position={[-0.35, 0.12, -0.18]}
            onClick={(e) => {
              e.stopPropagation();
              onFindHiddenStamp('hidden_butterfly_frame');
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredHiddenId('hidden_butterfly_frame');
            }}
            onPointerOut={() => setHoveredHiddenId(null)}
          >
            {/* Generous invisible touch/click collider */}
            <mesh visible={false}>
              <boxGeometry args={[0.22, 0.45, 0.45]} />
            </mesh>
            {/* Dark Frame & Cream Matte Backing */}
            <mesh>
              <boxGeometry args={[0.035, 0.34, 0.32]} />
              <meshStandardMaterial
                color={
                  hoveredHiddenId === 'hidden_butterfly_frame'
                    ? '#d97706'
                    : '#27272a'
                }
              />
            </mesh>
            <mesh position={[-0.019, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.26, 0.28]} />
              <meshBasicMaterial color="#fef3c7" />
            </mesh>
            {/* Vivid Blue Butterfly Wings inside Frame */}
            <mesh
              position={[-0.021, 0.01, -0.042]}
              rotation={[0.2, -Math.PI / 2, 0]}
            >
              <circleGeometry args={[0.055, 12]} />
              <meshBasicMaterial color="#0ea5e9" />
            </mesh>
            <mesh
              position={[-0.021, 0.01, 0.042]}
              rotation={[-0.2, -Math.PI / 2, 0]}
            >
              <circleGeometry args={[0.055, 12]} />
              <meshBasicMaterial color="#0ea5e9" />
            </mesh>
            <mesh
              position={[-0.021, -0.035, -0.028]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <circleGeometry args={[0.036, 10]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <mesh
              position={[-0.021, -0.035, 0.028]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <circleGeometry args={[0.036, 10]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            {/* Butterfly Body */}
            <mesh position={[-0.022, -0.01, 0]}>
              <boxGeometry args={[0.004, 0.09, 0.012]} />
              <meshBasicMaterial color="#18181b" />
            </mesh>
            {(hoveredHiddenId === 'hidden_butterfly_frame' ||
              collectedStampIds.includes('hidden_butterfly_frame')) && (
              <Html position={[-0.12, 0.25, 0]} center zIndexRange={[6, 0]}>
                <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                  {collectedStampIds.includes('hidden_butterfly_frame')
                    ? '파란 나비 액자 확인'
                    : '파란 나비 액자 발견'}
                </div>
              </Html>
            )}
          </group>
          {/* DIMPCHI Brass Miniature Leather Tools Shadowbox Frame (KakaoTalk_261108_120001_31.jpeg) */}
          <group position={[-0.35, 0.14, 0.18]}>
            <mesh castShadow>
              <boxGeometry args={[0.04, 0.34, 0.32]} />
              <meshStandardMaterial color="#3b2314" roughness={0.6} />
            </mesh>
            {/* Cream Matte Backing */}
            <mesh position={[-0.022, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.26, 0.28]} />
              <meshBasicMaterial color="#fdf6e2" />
            </mesh>
            {/* Gold 'DIMPCHI' Nameplate at Top of Shadowbox */}
            <mesh position={[-0.024, 0.095, 0]}>
              <boxGeometry args={[0.008, 0.032, 0.11]} />
              <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Miniature Brass & Wood Leather Craft Tools Mounted Inside */}
            {[-0.08, -0.04, 0, 0.04, 0.08].map((tz, tIdx) => (
              <group key={`mini-tool-${tIdx}`} position={[-0.024, -0.015, tz]}>
                {/* Wooden Tool Handle */}
                <mesh position={[0, 0.035, 0]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.045, 8]} />
                  <meshStandardMaterial color="#7c3f1d" />
                </mesh>
                {/* Brass Tool Blade / Head */}
                <mesh position={[0, -0.015, 0]}>
                  <boxGeometry args={[0.006, 0.042, tIdx === 2 ? 0.028 : 0.014]} />
                  <meshStandardMaterial color="#e5c158" metalness={0.88} roughness={0.2} />
                </mesh>
              </group>
            ))}
          </group>

          {/* 'Happy Birth-flower' Botanical Poster on Lower-Left of Pillar (120001_31.jpeg) */}
          <group position={[-0.35, -0.24, -0.18]}>
            <mesh position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.24, 0.32]} />
              <meshBasicMaterial color="#fef9eb" />
            </mesh>
            {/* Botanical Flower Stems Grid */}
            {[-0.06, 0, 0.06].map((fz, fIdx) => (
              <mesh key={fIdx} position={[-0.002, -0.01, fz]}>
                <boxGeometry args={[0.004, 0.18, 0.018]} />
                <meshBasicMaterial color={fIdx === 1 ? '#15803d' : '#ea580c'} />
              </mesh>
            ))}
          </group>

          {/* Beach/Cloud Photo & Burgundy Mini Frame on Lower-Right of Pillar */}
          <group position={[-0.35, -0.24, 0.18]}>
            <mesh>
              <boxGeometry args={[0.03, 0.24, 0.28]} />
              <meshStandardMaterial color="#7c2d12" />
            </mesh>
            <mesh position={[-0.016, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.22, 0.18]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>

        {/* Horizontal Walnut Shelves (Front 5 Bays & Back 6 Bays ending at Z = -4.36) */}
        {[0.18, 0.65, 1.11, 1.55, 1.99, 2.43, 2.88].map((sy, idx) => (
          <React.Fragment key={idx}>
            <mesh position={[4.22, sy, 2.9]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.04, 5.0]} />
              <meshStandardMaterial color="#4a2a14" roughness={0.75} />
            </mesh>
            <mesh position={[4.22, sy, -2.47]} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.04, 3.82]} />
              <meshStandardMaterial color="#4a2a14" roughness={0.75} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Vertical Bookcase Dividers (Front 5 Bays + Back 6 Bays) */}
        {[
          5.38, 4.36, 3.4, 2.45, 1.5, 0.52, -0.58, -1.21, -1.84, -2.47, -3.1,
          -3.73, -4.36,
        ].map((vz, idx) => (
          <mesh key={idx} position={[4.22, 1.52, vz]} castShadow>
            <boxGeometry args={[0.46, 2.75, 0.045]} />
            <meshStandardMaterial color="#4a2a14" roughness={0.75} />
          </mesh>
        ))}

        {/* Hanging White Paper Guide Notices on Vertical Dividers ('구매 안내') */}
        {[3.4, 1.5, -1.84, -3.1].map((vz, idx) => (
          <mesh key={idx} position={[3.98, 1.52, vz]}>
            <boxGeometry args={[0.01, 0.24, 0.16]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        ))}

        {/* Back 6-Column Bookcase Signature Props (KakaoTalk_261106_114029_01.jpg):
            1) Red 'Coca-Cola' Crate at bottom of 6th bay (Z = -4.05)
            2) Miniature figures & 'B K' letters on 3rd shelf of 5th bay (Z = -3.42)
            3) White 'A BATHING APE' (BAPE) head sign on bottom shelf of 4th bay (Z = -2.95)
            4) Brown cardboard box on bottom shelf of 3rd bay (Z = -2.15) */}
        <group>
          {/* Red Coca-Cola Crate in Back-Leftmost Bookcase Bay */}
          <group position={[4.2, 0.34, -4.08]}>
            <mesh castShadow>
              <boxGeometry args={[0.28, 0.24, 0.42]} />
              <meshStandardMaterial color="#dc2626" roughness={0.4} />
            </mesh>
            <mesh position={[-0.142, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.26, 0.07]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          {/* Miniature Figures & 'B K' Display on 3rd Shelf of 5th Back Bay */}
          <group position={[4.18, 1.24, -3.42]}>
            <mesh position={[0, 0, -0.12]} castShadow>
              <boxGeometry args={[0.12, 0.16, 0.14]} />
              <meshStandardMaterial color="#fca5a5" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.04, 0.06]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.12, 10]} />
              <meshStandardMaterial color="#ef4444" />
            </mesh>
            <mesh position={[-0.06, -0.04, 0]} castShadow>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
          </group>
          {/* White BAPE Ape Head Card on Bottom Shelf */}
          <mesh position={[4.08, 0.34, -2.96]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.14, 0.2]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
          {/* Brown Cardboard Box on Bottom Shelf */}
          <mesh position={[4.2, 0.33, -2.15]} castShadow>
            <boxGeometry args={[0.28, 0.22, 0.38]} />
            <meshStandardMaterial color="#b4834e" roughness={0.8} />
          </mesh>
        </group>

        {/* ============================================================
            BOOKSHOP OWNER'S PERSONAL STUDY BOOKCASE NOTICE (책방지기의 서재 공간 · 비매품 알림)
            Clicking anywhere on the Back 6-Column Bookcase (Z = -0.58 .. -4.36)
            or its top plaque toggles the notification right at the top of the bookcase!
           ============================================================ */}
        <group>
          {/* Full-Bookcase Front Interaction Hitbox so clicking any shelf/book on the Back 6-Column Bookcase opens the top notice */}
          <mesh
            position={[3.94, 1.54, -2.47]}
            onClick={(e) => {
              e.stopPropagation();
              setOwnerLibraryNoticeOpen((prev) => !prev);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredOwnerLibrary(true);
            }}
            onPointerOut={() => setHoveredOwnerLibrary(false)}
          >
            <boxGeometry args={[0.12, 2.76, 3.84]} />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>

          {/* Top-of-Bookcase Semi-Transparent Plaque & Notification UI (책장 윗쪽 알림) */}
          <group
            position={[3.95, 2.91, -2.47]}
            rotation={[0, -Math.PI / 2, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setOwnerLibraryNoticeOpen((prev) => !prev);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredOwnerLibrary(true);
            }}
            onPointerOut={() => setHoveredOwnerLibrary(false)}
          >
            <mesh visible={false}>
              <boxGeometry args={[0.76, 0.22, 0.08]} />
            </mesh>

            <Html position={[0, 0, 0.02]} center zIndexRange={[18, 0]}>
              {ownerLibraryNoticeOpen ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setOwnerLibraryNoticeOpen(false);
                  }}
                  className="pointer-events-auto flex flex-col gap-1 rounded-[4px] bg-black/55 px-3.5 py-2.5 text-white/95 shadow-lg backdrop-blur-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-white whitespace-nowrap">
                      책방지기의 서재
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOwnerLibraryNoticeOpen(false);
                      }}
                      className="cursor-pointer rounded-[3px] bg-white/15 px-1.5 py-0.5 text-[11px] text-white hover:bg-white/25 transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-white/90 whitespace-nowrap">
                    판매·대여되는 책은 아니지만 자유롭게 꺼내 읽으실 수 있습니다.
                  </p>
                  <p className="text-xs leading-relaxed text-white/80 whitespace-nowrap">
                    보시고 제자리에 꽂아 주세요.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOwnerLibraryNoticeOpen(true);
                  }}
                  className={`pointer-events-auto cursor-pointer whitespace-nowrap rounded-[4px] px-2.5 py-1 text-xs transition-all backdrop-blur-md ${
                    hoveredOwnerLibrary
                      ? 'bg-black/60 text-white shadow-md'
                      : 'bg-black/38 text-white/90 hover:bg-black/55 hover:text-white shadow-sm'
                  }`}
                >
                  책방지기의 서재
                </button>
              )}
            </Html>
          </group>
        </group>

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

        {/* Decorative Book Spines filling all 11 Bays */}
        {decorativeBooks.map((b, i) => (
          <mesh key={i} position={b.position} castShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} roughness={0.75} />
          </mesh>
        ))}

        {/* ============================================================
            BLACK FOLDING MINIVELO BICYCLE & BACK BOOKCASE FLOOR PROPS
            (KakaoTalk_261108_120001_51.jpeg, 120005_241.jpeg)
           ============================================================ */}
        <group position={[2.75, 0, -2.15]} rotation={[0, -0.22, 0]}>
          {/* Front & Rear 20-inch Minivelo Wheels (Black Tires + Silver Rims) */}
          {[-0.42, 0.42].map((wz, wIdx) => (
            <group key={`bike-wheel-${wIdx}`} position={[0, 0.26, wz]}>
              <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
                <torusGeometry args={[0.23, 0.032, 12, 24]} />
                <meshStandardMaterial color="#18181b" roughness={0.8} />
              </mesh>
              <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[0.195, 0.012, 8, 24]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Wheel Hub */}
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.025, 0.025, 0.09, 10]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.8} />
              </mesh>
            </group>
          ))}
          {/* Main Folding Frame Tube & Rear Triangle */}
          <mesh position={[0, 0.42, 0]} rotation={[0.18, 0, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.88, 10]} />
            <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.35} />
          </mesh>
          {/* Seat Tube, Tall Silver Seatpost & Black Saddle */}
          <mesh position={[0, 0.56, 0.22]} rotation={[-0.18, 0, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.022, 0.62, 10]} />
            <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.86, 0.28]} castShadow>
            <boxGeometry args={[0.14, 0.045, 0.24]} />
            <meshStandardMaterial color="#09090b" roughness={0.6} />
          </mesh>
          {/* Front Fork, Tall Folding Handlebar Stem & Flat Handlebars */}
          <mesh position={[0, 0.62, -0.38]} rotation={[0.12, 0, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 0.76, 10]} />
            <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.98, -0.34]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.52, 10]} />
            <meshStandardMaterial color="#27272a" metalness={0.7} />
          </mesh>
          {/* Red & White 'MERRY Christmas' Cloth Draped over Handlebars (120001_51.jpeg) */}
          <group position={[0, 0.88, -0.36]}>
            <mesh castShadow>
              <boxGeometry args={[0.28, 0.22, 0.04]} />
              <meshStandardMaterial color="#dc2626" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.02, -0.022]}>
              <planeGeometry args={[0.22, 0.08]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          {/* Crankset & Pedals */}
          <mesh position={[0, 0.26, 0.08]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.075, 0.075, 0.03, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
          </mesh>
        </group>

        {/* Props Leaning Against Back-Right Bookcase behind Bicycle:
            Yellow Duck Tote Bag, White Foam Boards, Red Rolled Hide & Mint Bag (120001_51.jpeg) */}
        <group position={[3.68, 0, -2.05]}>
          {/* Yellow Canvas Tote Bag with Cute Duck Illustration */}
          <mesh position={[0, 0.28, 0.28]} rotation={[0, -0.25, 0.08]} castShadow>
            <boxGeometry args={[0.14, 0.42, 0.36]} />
            <meshStandardMaterial color="#facc15" roughness={0.75} />
          </mesh>
          <mesh position={[-0.072, 0.28, 0.28]} rotation={[0, -Math.PI / 2 - 0.25, 0]}>
            <circleGeometry args={[0.08, 14]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Tall White Foam Boards & Rolled Red Leather Hide */}
          <mesh position={[0.08, 0.58, -0.25]} rotation={[0, 0, 0.06]} castShadow>
            <boxGeometry args={[0.06, 1.15, 0.58]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
          <mesh position={[0.02, 0.48, -0.58]} rotation={[0.08, 0, 0.05]} castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.95, 12]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.55} />
          </mesh>
          {/* Mint Plastic Trash Bag on Floor */}
          <mesh position={[-0.08, 0.22, -0.82]} castShadow>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color="#6ee7b7" roughness={0.65} />
          </mesh>
        </group>

        {/* ============================================================
            RIGHT-WALL 7-PLANK HOLLOW CONCRETE-BLOCK ARCHIVE SHELF
            (Cameras, Handcrafted Leather Goods, 8+ Certificates, 2-Tier Glass Jars & Cubby Columns)
            (KakaoTalk_261108_120004_231.jpeg, KakaoTalk_261106_114055_01.jpg)
           ============================================================ */}
        <group
          position={[4.22, 0, -5.44]}
          rotation={[0, -Math.PI / 2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            setOwnerDisplayNoticeOpen((prev) => !prev);
          }}
          onPointerOver={() => setHoveredOwnerDisplay(true)}
          onPointerOut={() => setHoveredOwnerDisplay(false)}
        >
          {/* Rolled Patterned Carpet/Mat Tube Leaning in the Far-Left Corner next to the Shelf */}
          <group position={[-1.12, 0, -0.05]}>
            <mesh position={[0, 1.15, 0]} rotation={[0, 0, -0.03]} castShadow>
              <cylinderGeometry args={[0.055, 0.065, 2.3, 12]} />
              <meshStandardMaterial color="#334155" roughness={0.85} />
            </mesh>
            <mesh position={[-0.05, 0.85, 0.04]} rotation={[0, 0, -0.02]}>
              <cylinderGeometry args={[0.022, 0.022, 1.7, 8]} />
              <meshStandardMaterial color="#ca8a04" roughness={0.7} />
            </mesh>
          </group>

          {/* 3 Columns of True 3D Hollow Square Concrete Block Cubbies (`속이 빈 사각 시멘트 블록 수납칸`)
              Each shelf tier has 2 stacked hollow square blocks (lower + upper), plus top cubby blocks at Y = 2.60! */}
          {[-0.95, 0, 0.95].map((bx, colIdx) => {
            // 13 hollow square block centers from floor up to top of shelf (2 blocks per tier!)
            const cubbyCentersY = [
              0.07,
              0.245, 0.405,
              0.595, 0.765,
              0.975, 1.145,
              1.36, 1.54,
              1.76, 1.94,
              2.16, 2.34,
              ...(colIdx >= 1 ? [2.58] : []),
            ];
            return (
              <group key={`cblock-col-${colIdx}`} position={[bx, 0, 0]}>
                {cubbyCentersY.map((cy, bIdx) => (
                  <group key={`cubby-${bIdx}`} position={[0, cy, 0]}>
                    {/* Top & Bottom Walls of Hollow Concrete Block */}
                    <mesh position={[0, 0.072, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.21, 0.024, 0.36]} />
                      <meshStandardMaterial color="#9ca3af" roughness={0.92} />
                    </mesh>
                    <mesh position={[0, -0.072, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.21, 0.024, 0.36]} />
                      <meshStandardMaterial color="#9ca3af" roughness={0.92} />
                    </mesh>
                    {/* Left & Right Walls of Hollow Concrete Block */}
                    <mesh position={[-0.093, 0, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.024, 0.12, 0.36]} />
                      <meshStandardMaterial color="#94a3b8" roughness={0.92} />
                    </mesh>
                    <mesh position={[0.093, 0, 0]} castShadow receiveShadow>
                      <boxGeometry args={[0.024, 0.12, 0.36]} />
                      <meshStandardMaterial color="#94a3b8" roughness={0.92} />
                    </mesh>
                    {/* Recessed Dark Interior Back Wall inside Block Cubby */}
                    <mesh position={[0, 0, -0.15]}>
                      <boxGeometry args={[0.165, 0.125, 0.02]} />
                      <meshStandardMaterial color="#334155" roughness={0.95} />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })}

          {/* 7 Horizontal Warm Wood Plank Shelves (`7단 원목 선반`, reaching up to match the Walnut Bookcase!) */}
          {[0.14, 0.5, 0.88, 1.26, 1.66, 2.06, 2.46].map((sy, idx) => (
            <mesh key={`cshelf-${idx}`} position={[0, sy, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.14, 0.032, 0.4]} />
              <meshStandardMaterial color="#854d27" roughness={0.68} />
            </mesh>
          ))}

          {/* ============================================================
              ITEMS INSIDE THE 2 HOLLOW CONCRETE-BLOCK CUBBY COLUMNS
              (Center Pillar `X = 0` & Right Pillar `X = +0.95` — KakaoTalk_261106_114055_01.jpg)
             ============================================================ */}
          {/* 1) CENTER BLOCK COLUMN CUBBY ITEMS (`X = 0`) */}
          <group position={[0, 0, 0.06]}>
            {/* Top Center Cubby (Y = 2.58): Silver Metallic Photo Frame */}
            <mesh position={[0, 2.57, 0]}>
              <boxGeometry args={[0.12, 0.095, 0.03]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* On Top of Center Block (Y = 2.74): Large Black Nikon DSLR Camera with Lens */}
            <group position={[0, 2.73, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.13, 0.095, 0.08]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.055, -0.01]}>
                <boxGeometry args={[0.06, 0.03, 0.06]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0, -0.005, 0.065]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.034, 0.036, 0.07, 14]} />
                <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
            {/* Tier 6 Upper Cubby (Y = 2.34): White Apple Box + Black Gadget Boxes */}
            <mesh position={[-0.025, 2.32, 0]}>
              <boxGeometry args={[0.08, 0.05, 0.08]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[-0.025, 2.365, 0]}>
              <boxGeometry args={[0.075, 0.04, 0.075]} />
              <meshStandardMaterial color="#18181b" />
            </mesh>
            {/* Tier 6 Lower Cubby (Y = 2.16): Vintage '9' Tin Box */}
            <mesh position={[0, 2.15, 0]}>
              <boxGeometry args={[0.09, 0.095, 0.05]} />
              <meshStandardMaterial color="#27272a" />
            </mesh>
            {/* Tier 5 Upper Cubby (Y = 1.94): 5 Colorful Mini Book Spines (Blue, Yellow, Orange) */}
            {[-0.05, -0.025, 0, 0.025, 0.05].map((mx, mIdx) => (
              <mesh key={`cmini-${mIdx}`} position={[mx, 1.93, 0]}>
                <boxGeometry args={[0.02, 0.09, 0.07]} />
                <meshStandardMaterial
                  color={mIdx < 2 ? '#2563eb' : mIdx === 2 ? '#facc15' : '#f97316'}
                />
              </mesh>
            ))}
            {/* Tier 5 Lower Cubby (Y = 1.76): Red Card Box & Small Pack */}
            <mesh position={[0.01, 1.75, 0]}>
              <boxGeometry args={[0.065, 0.085, 0.04]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            {/* Tier 4 Upper & Lower Cubbies (Y = 1.54, 1.36): White Bottle & Diffuser */}
            <mesh position={[-0.03, 1.53, 0]}>
              <cylinderGeometry args={[0.016, 0.018, 0.08, 10]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0.025, 1.53, 0]}>
              <boxGeometry args={[0.05, 0.07, 0.05]} />
              <meshStandardMaterial color="#ca8a04" />
            </mesh>
            <mesh position={[0, 1.35, 0]}>
              <cylinderGeometry args={[0.022, 0.025, 0.075, 10]} />
              <meshStandardMaterial color="#94a3b8" transparent opacity={0.7} />
            </mesh>
            {/* Tier 3 Multi-Plug Power Strip (`멀티탭`, Y = 0.96) */}
            <mesh position={[0, 0.96, 0.12]}>
              <boxGeometry args={[0.16, 0.055, 0.045]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </group>

          {/* 2) RIGHT BLOCK COLUMN CUBBY ITEMS (`X = +0.95`, KakaoTalk_261106_114055_01.jpg) */}
          <group position={[0.95, 0, 0.06]}>
            {/* On Top of Right Block (Y = 2.75): 'LUBITEL 166B' Vintage Twin-Lens Reflex (TLR) Camera! */}
            <group position={[0, 2.75, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.095, 0.145, 0.095]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              {/* Twin Vertical Lenses of TLR Camera */}
              <mesh position={[0, 0.028, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.025, 12]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.022, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.025, 12]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
            {/* Top Right Cubby (Y = 2.58): Vintage Silver/Black Rangefinder Camera */}
            <group position={[0, 2.56, 0]}>
              <mesh>
                <boxGeometry args={[0.11, 0.07, 0.055]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0, 0.026, 0]}>
                <boxGeometry args={[0.112, 0.02, 0.056]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
              </mesh>
              <mesh position={[0, -0.005, 0.038]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.03, 12]} />
                <meshStandardMaterial color="#09090b" />
              </mesh>
            </group>
            {/* Tier 6 Upper Cubby (Y = 2.34): Tiny White Figure & Cross Bell */}
            <mesh position={[-0.035, 2.32, 0]}>
              <cylinderGeometry args={[0.014, 0.016, 0.055, 8]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0.025, 2.33, 0]}>
              <coneGeometry args={[0.022, 0.065, 8]} />
              <meshStandardMaterial color="#78350f" metalness={0.6} />
            </mesh>
            {/* Tier 6 Lower Cubby (Y = 2.16): White Chicken & Brown Bull Mini Figurines */}
            <mesh position={[-0.03, 2.14, 0]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.03, 2.14, 0]}>
              <boxGeometry args={[0.045, 0.04, 0.03]} />
              <meshStandardMaterial color="#b45309" />
            </mesh>
            {/* Tier 5 Upper Cubby (Y = 1.94): Clear Case with White Golf Balls */}
            <group position={[0, 1.93, 0]}>
              <mesh>
                <boxGeometry args={[0.11, 0.065, 0.07]} />
                <meshStandardMaterial color="#e2e8f0" transparent opacity={0.5} />
              </mesh>
              {[-0.03, 0, 0.03].map((gx, gIdx) => (
                <mesh key={gIdx} position={[gx, 0, 0]}>
                  <sphereGeometry args={[0.014, 8, 8]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
              ))}
            </group>
            {/* Tier 5 Lower Cubby (Y = 1.76): Square Grey 'XIAOMI WATCH S1' Box */}
            <mesh position={[0, 1.76, 0.01]}>
              <boxGeometry args={[0.135, 0.115, 0.06]} />
              <meshStandardMaterial color="#78716c" roughness={0.5} />
            </mesh>
            {/* Tier 4 Hanging Beaded Necklaces, Black Leather Strap & Baseballs (Y = 1.35..1.62) */}
            <mesh position={[-0.06, 1.38, 0.13]}>
              <cylinderGeometry args={[0.008, 0.008, 0.48, 8]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
            <mesh position={[-0.035, 1.4, 0.13]}>
              <cylinderGeometry args={[0.007, 0.007, 0.44, 8]} />
              <meshStandardMaterial color="#fde68a" />
            </mesh>
            <mesh position={[0.01, 1.38, 0.13]}>
              <boxGeometry args={[0.032, 0.46, 0.01]} />
              <meshStandardMaterial color="#18181b" />
            </mesh>
            <mesh position={[0.02, 1.53, 0]}>
              <sphereGeometry args={[0.028, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0.02, 1.35, 0]}>
              <cylinderGeometry args={[0.028, 0.028, 0.065, 10]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
          </group>

          {/* 3) LEFT BLOCK COLUMN: Hanging '2026 11' Calendar & Small Cubby Bottles (`X = -0.95`) */}
          <group position={[-0.95, 1.74, 0.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.38, 0.52, 0.012]} />
              <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.17, 0.008]}>
              <planeGeometry args={[0.12, 0.055]} />
              <meshBasicMaterial color="#18181b" />
            </mesh>
            <mesh position={[-0.13, -0.04, 0.008]}>
              <planeGeometry args={[0.035, 0.28]} />
              <meshBasicMaterial color="#dc2626" />
            </mesh>
          </group>

          {/* ============================================================
              ROW 7 (TOP PLANK, Y = 2.46): NIKON CAMERA BOXES, DSLRs, LENSES & VINTAGE CAMERAS
              (KakaoTalk_261108_120004_231.jpeg, KakaoTalk_261106_114055_01.jpg)
             ============================================================ */}
          <group position={[0, 2.48, 0]}>
            {/* Left Bay: Black 'Nikon Z8' Box, Gold '16-35' Box, Gold 'D810' Box, Gold 'D750' Box */}
            {/* Black Nikon Z8 Box */}
            <group position={[-0.78, 0.08, 0.04]}>
              <mesh castShadow>
                <boxGeometry args={[0.24, 0.15, 0.18]} />
                <meshStandardMaterial color="#18181b" roughness={0.4} />
              </mesh>
              <mesh position={[0.08, -0.04, 0.092]}>
                <planeGeometry args={[0.05, 0.035]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
            {/* Tall Kraft/Gold '16-35' Box */}
            <mesh position={[-0.56, 0.12, -0.02]} castShadow>
              <boxGeometry args={[0.14, 0.24, 0.18]} />
              <meshStandardMaterial color="#a16207" roughness={0.55} />
            </mesh>
            {/* Gold 'D810' Box + Black DSLR Camera on top */}
            <group position={[-0.39, 0.08, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.18, 0.15, 0.18]} />
                <meshStandardMaterial color="#ca8a04" roughness={0.45} />
              </mesh>
              {/* DSLR Camera on D810 Box */}
              <mesh position={[0, 0.12, 0]} castShadow>
                <boxGeometry args={[0.12, 0.09, 0.08]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.12, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.032, 0.032, 0.06, 12]} />
                <meshStandardMaterial color="#27272a" metalness={0.6} />
              </mesh>
            </group>
            {/* Gold 'D750' Box + Black DSLR Camera on top */}
            <group position={[-0.2, 0.08, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.18, 0.15, 0.18]} />
                <meshStandardMaterial color="#d97706" roughness={0.45} />
              </mesh>
              {/* DSLR Camera on D750 Box */}
              <mesh position={[0, 0.115, 0]} castShadow>
                <boxGeometry args={[0.115, 0.085, 0.08]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.115, 0.058]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 0.055, 12]} />
                <meshStandardMaterial color="#27272a" metalness={0.6} />
              </mesh>
            </group>

            {/* Right Bay: 2 Standing Camera Lenses, Vintage Silver Rangefinder, Leather Case & PENTAX Camera */}
            {/* Lens 1 */}
            <mesh position={[0.18, 0.075, 0.04]} castShadow>
              <cylinderGeometry args={[0.038, 0.042, 0.15, 14]} />
              <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Lens 2 (Taller Telephoto) */}
            <mesh position={[0.29, 0.095, 0.04]} castShadow>
              <cylinderGeometry args={[0.038, 0.044, 0.19, 14]} />
              <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.3} />
            </mesh>
            {/* Vintage Silver & Gold Rangefinder Film Camera */}
            <group position={[0.44, 0.048, 0.05]}>
              <mesh castShadow>
                <boxGeometry args={[0.12, 0.075, 0.055]} />
                <meshStandardMaterial color="#27272a" />
              </mesh>
              <mesh position={[0, 0.028, 0]}>
                <boxGeometry args={[0.122, 0.022, 0.057]} />
                <meshStandardMaterial color="#fde68a" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.005, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.026, 0.026, 0.035, 12]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
              </mesh>
            </group>
            {/* Black Leather Camera Case */}
            <mesh position={[0.6, 0.055, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.09, 0.08]} />
              <meshStandardMaterial color="#1c1917" roughness={0.5} />
            </mesh>
            {/* Black 'PENTAX' Medium Format SLR Camera */}
            <group position={[0.76, 0.06, 0.05]}>
              <mesh castShadow>
                <boxGeometry args={[0.13, 0.095, 0.075]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.055, 0]}>
                <boxGeometry args={[0.065, 0.028, 0.06]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[0, -0.005, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.034, 0.034, 0.05, 14]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>
            </group>
          </group>

          {/* ============================================================
              ROW 6 (5TH PLANK, Y = 2.06): BINDERS, LEGO HEADS, TEA SET & LARGE HANDMADE LEATHER BAGS
              (KakaoTalk_261108_120004_231.jpeg, KakaoTalk_261106_114055_01.jpg)
             ============================================================ */}
          <group position={[0, 2.08, 0]}>
            {/* Left Bay: 5 Tall Binders/Albums + Stacked Yellow & Pumpkin LEGO Heads + Pink Art & Tea Cups */}
            {[-0.81, -0.76, -0.71, -0.66, -0.61].map((bx, bIdx) => (
              <mesh key={`binder-${bIdx}`} position={[bx, 0.16, 0]} castShadow>
                <boxGeometry args={[0.038, 0.31, 0.24]} />
                <meshStandardMaterial
                  color={bIdx % 2 === 0 ? '#1e293b' : '#334155'}
                  roughness={0.6}
                />
              </mesh>
            ))}
            {/* Stacked LEGO Heads: Classic Yellow Smiley on Bottom, Orange Pumpkin Jack-o'-Lantern on Top! */}
            <group position={[-0.46, 0, 0.04]}>
              {/* Bottom: Yellow LEGO Smiley Head */}
              <mesh position={[0, 0.085, 0]} castShadow>
                <cylinderGeometry args={[0.085, 0.08, 0.16, 16]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} />
              </mesh>
              {/* Top: Orange Pumpkin LEGO Head */}
              <mesh position={[0, 0.24, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.085, 0.16, 16]} />
                <meshStandardMaterial color="#ea580c" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.33, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.025, 12]} />
                <meshStandardMaterial color="#ea580c" roughness={0.35} />
              </mesh>
              {/* Black Jack-o'-Lantern Eyes on Pumpkin Head */}
              <mesh position={[-0.028, 0.25, 0.088]}>
                <boxGeometry args={[0.022, 0.022, 0.01]} />
                <meshBasicMaterial color="#09090b" />
              </mesh>
              <mesh position={[0.028, 0.25, 0.088]}>
                <boxGeometry args={[0.022, 0.022, 0.01]} />
                <meshBasicMaterial color="#09090b" />
              </mesh>
            </group>
            {/* Pink Hand Illustration Board & Ceramic Tea Set */}
            <mesh position={[-0.26, 0.12, -0.06]}>
              <boxGeometry args={[0.22, 0.22, 0.02]} />
              <meshStandardMaterial color="#fbcfe8" roughness={0.6} />
            </mesh>
            {[-0.32, -0.24, -0.16].map((tx, tIdx) => (
              <mesh key={`teacup-${tIdx}`} position={[tx, 0.035, 0.08]} castShadow>
                <cylinderGeometry args={[0.028, 0.022, 0.06, 10]} />
                <meshStandardMaterial
                  color={tIdx === 2 ? '#b45309' : '#e2e8f0'}
                  roughness={0.4}
                />
              </mesh>
            ))}

            {/* Right Bay: Large Tan Portfolio Bag, Black MEVIUS Box, Dark Brown Cutout-Handle Leather Tote,
                Coral-Orange Kelly Handbag with Fluffy Pink Fur Pom-Pom, Pink/Gold Board & Red JAPAN Tin */}
            {/* Back-Left Large Tan/Orange Leather Portfolio Bag */}
            <mesh position={[0.28, 0.17, -0.06]} castShadow>
              <boxGeometry args={[0.34, 0.32, 0.09]} />
              <meshStandardMaterial color="#d97706" roughness={0.45} />
            </mesh>
            {/* Tall Black 'MEVIUS' Box */}
            <mesh position={[0.18, 0.11, 0.06]} castShadow>
              <boxGeometry args={[0.095, 0.21, 0.06]} />
              <meshStandardMaterial color="#18181b" roughness={0.4} />
            </mesh>
            {/* Center Dark Brown Leather Tote Bag with Cutout Handle */}
            <group position={[0.42, 0.14, 0.02]}>
              <mesh castShadow>
                <boxGeometry args={[0.28, 0.26, 0.08]} />
                <meshStandardMaterial color="#451a03" roughness={0.38} />
              </mesh>
              {/* Oval Cutout Handle Detail */}
              <mesh position={[0, 0.095, 0.042]}>
                <planeGeometry args={[0.075, 0.028]} />
                <meshBasicMaterial color="#d6d3d1" />
              </mesh>
            </group>
            {/* Front Coral-Orange Kelly Leather Handbag + Gold Clasp + Pink Fur Pom-Pom Keychain! */}
            <group position={[0.54, 0.085, 0.1]}>
              <mesh castShadow>
                <boxGeometry args={[0.19, 0.15, 0.075]} />
                <meshStandardMaterial color="#ea580c" roughness={0.38} />
              </mesh>
              {/* Top Handle Arch */}
              <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.038, 0.008, 8, 12, Math.PI]} />
                <meshStandardMaterial color="#ea580c" />
              </mesh>
              {/* Gold Kelly Clasp */}
              <mesh position={[0, 0.02, 0.04]}>
                <boxGeometry args={[0.04, 0.014, 0.01]} />
                <meshStandardMaterial color="#facc15" metalness={0.85} />
              </mesh>
              {/* Fluffy Pink-Brown Fur Pom-Pom Keychain */}
              <mesh position={[-0.085, -0.02, 0.045]} castShadow>
                <sphereGeometry args={[0.042, 12, 12]} />
                <meshStandardMaterial color="#d6a29c" roughness={0.95} />
              </mesh>
            </group>
            {/* Back-Right Pink & Gold Textured Art Board + Red 'JAPAN' Tin */}
            <mesh position={[0.72, 0.15, -0.06]}>
              <boxGeometry args={[0.2, 0.28, 0.02]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.5} />
            </mesh>
            <mesh position={[0.75, 0.065, 0.06]} castShadow>
              <boxGeometry args={[0.085, 0.12, 0.055]} />
              <meshStandardMaterial color="#b91c1c" metalness={0.4} roughness={0.35} />
            </mesh>
          </group>

          {/* ============================================================
              ROW 5 (4TH PLANK, Y = 1.66): 4 FRAMED CERTIFICATES, LEGO LANDMARKS,
              'B K' LETTERS, '16:33' CLOCK + CITY MONITOR, LEATHER BAGS & PIRATE SHIP
              (KakaoTalk_261108_120004_231.jpeg, KakaoTalk_261106_114055_01.jpg)
             ============================================================ */}
          <group position={[0, 1.68, 0]}>
            {/* Left Bay: 4 Framed Certificates/Patents Lined Up Side-by-Side (`인증서/특허증 액자 4개`) */}
            {[-0.75, -0.58, -0.41, -0.24].map((fx, fIdx) => (
              <group
                key={`cert-top-${fIdx}`}
                position={[fx, 0.12, -0.04]}
                rotation={[-0.1, 0, 0]}
              >
                {/* Wooden Certificate Frame */}
                <mesh castShadow>
                  <boxGeometry args={[0.155, 0.22, 0.02]} />
                  <meshStandardMaterial color="#5c3a21" roughness={0.55} />
                </mesh>
                {/* Cream Certificate Paper */}
                <mesh position={[0, 0, 0.012]}>
                  <planeGeometry args={[0.125, 0.19]} />
                  <meshBasicMaterial color="#fefce8" />
                </mesh>
                {/* Certificate Title Bar & Gold Official Seal */}
                <mesh position={[0, 0.06, 0.014]}>
                  <planeGeometry args={[0.08, 0.018]} />
                  <meshBasicMaterial color="#334155" />
                </mesh>
                <mesh position={[0.032, -0.055, 0.014]}>
                  <circleGeometry args={[0.016, 10]} />
                  <meshBasicMaterial color="#eab308" />
                </mesh>
              </group>
            ))}
            {/* LEGO Architecture & Miniature Landmarks in Front of the 4 Certificates (Tokyo Tower, Namsan Tower, Eiffel Tower) */}
            {/* Red/White Tower */}
            <mesh position={[-0.78, 0.07, 0.09]} castShadow>
              <coneGeometry args={[0.025, 0.14, 6]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            {/* Tall Namsan Seoul Tower */}
            <mesh position={[-0.64, 0.11, 0.09]} castShadow>
              <cylinderGeometry args={[0.008, 0.018, 0.22, 8]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>
            {/* LEGO Architecture Skyline / Tower Bridge */}
            <mesh position={[-0.45, 0.055, 0.09]} castShadow>
              <boxGeometry args={[0.18, 0.09, 0.05]} />
              <meshStandardMaterial color="#d6d3d1" />
            </mesh>
            <mesh position={[-0.26, 0.08, 0.09]} castShadow>
              <coneGeometry args={[0.03, 0.16, 4]} />
              <meshStandardMaterial color="#a8a29e" />
            </mesh>

            {/* Right Bay: 3D Block Letters 'B' & 'K', '16:33' LED Clock on Cityscape Monitor,
                Dark Brown Flap Leather Bag with Fur Pom-Pom, Black Tote Bag with Tan Straps & Pirate Ship */}
            {/* Grey 3D Letter 'B' */}
            <mesh position={[0.17, 0.23, -0.06]} castShadow>
              <boxGeometry args={[0.075, 0.11, 0.025]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.7} />
            </mesh>
            {/* Grey 3D Letter 'K' */}
            <mesh position={[0.37, 0.23, -0.06]} castShadow>
              <boxGeometry args={[0.075, 0.11, 0.025]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.7} />
            </mesh>
            {/* Dark Framed Cityscape Monitor/Photo Frame + Glowing '16:33' LED Digital Clock on Top */}
            <group position={[0.26, 0.085, 0.02]}>
              {/* Cityscape Frame */}
              <mesh castShadow>
                <boxGeometry args={[0.26, 0.16, 0.035]} />
                <meshStandardMaterial color="#18181b" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0, 0.019]}>
                <planeGeometry args={[0.23, 0.13]} />
                <meshBasicMaterial color="#475569" />
              </mesh>
              {/* '16:33' White/Glowing Digital LED Clock on Top of Frame */}
              <mesh position={[-0.01, 0.11, 0]} castShadow>
                <boxGeometry args={[0.16, 0.06, 0.03]} />
                <meshStandardMaterial color="#18181b" />
              </mesh>
              <mesh position={[-0.01, 0.11, 0.016]}>
                <planeGeometry args={[0.135, 0.042]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
            </group>
            {/* Dark Brown Leather Flap Handbag with Gold Clasp & Fluffy Beige Pom-Pom */}
            <group position={[0.5, 0.08, 0.06]}>
              <mesh castShadow>
                <boxGeometry args={[0.17, 0.14, 0.08]} />
                <meshStandardMaterial color="#4a2511" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.015, 0.042]}>
                <boxGeometry args={[0.024, 0.014, 0.01]} />
                <meshStandardMaterial color="#facc15" metalness={0.85} />
              </mesh>
              {/* Fluffy Beige Fur Pom-Pom */}
              <mesh position={[0.08, 0.01, 0.045]} castShadow>
                <sphereGeometry args={[0.038, 12, 12]} />
                <meshStandardMaterial color="#d6b49c" roughness={0.95} />
              </mesh>
            </group>
            {/* Black Leather Tote Bag with Long Tan Leather Shoulder Straps + Pirate Ship Model */}
            <group position={[0.71, 0.09, 0.05]}>
              <mesh castShadow>
                <boxGeometry args={[0.18, 0.16, 0.085]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              {/* Long Tan Shoulder Straps */}
              <mesh position={[-0.045, 0.08, 0.044]}>
                <boxGeometry args={[0.018, 0.18, 0.01]} />
                <meshStandardMaterial color="#c27838" />
              </mesh>
              <mesh position={[0.045, 0.08, 0.044]}>
                <boxGeometry args={[0.018, 0.18, 0.01]} />
                <meshStandardMaterial color="#c27838" />
              </mesh>
              {/* Vintage Wooden Pirate Ship Masts rising behind/next to Bag */}
              <mesh position={[0.08, 0.14, -0.02]}>
                <cylinderGeometry args={[0.005, 0.005, 0.22, 6]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0.08, 0.16, -0.02]}>
                <boxGeometry args={[0.08, 0.06, 0.01]} />
                <meshStandardMaterial color="#fef3c7" />
              </mesh>
            </group>
          </group>

          {/* ============================================================
              ROW 4 (3RD PLANK, Y = 1.26): 3 CERTIFICATES, TUMBLERS, RED 'CUVEE BRUT' BOX,
              'LEATHER MASTER' CERTIFICATE, 'DIMPCHI' SIGN, 4 WALL CARDS & 18+ LEATHER WALLETS
              (KakaoTalk_261108_120004_231.jpeg, KakaoTalk_261106_114055_01.jpg)
             ============================================================ */}
          <group position={[0, 1.28, 0]}>
            {/* Left Bay: 3 Framed Certificates in Back + Tumblers, Bottles & Red 'CUVEE BRUT' Box in Front */}
            {[-0.72, -0.52, -0.32].map((fx, fIdx) => (
              <group
                key={`cert-mid-${fIdx}`}
                position={[fx, 0.11, -0.06]}
                rotation={[-0.1, 0, 0]}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.16, 0.21, 0.02]} />
                  <meshStandardMaterial color="#64748b" roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.012]}>
                  <planeGeometry args={[0.13, 0.18]} />
                  <meshBasicMaterial color="#f8fafc" />
                </mesh>
              </group>
            ))}
            {/* White Cloth Mat Hanging Slightly Over Front Edge */}
            <mesh position={[-0.55, -0.02, 0.18]}>
              <boxGeometry args={[0.18, 0.07, 0.02]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.85} />
            </mesh>
            {/* Dark Mug, Ceramic Jar with Red Label, Green Bottle, Tall Black Tumbler, Yellow Bottle */}
            <mesh position={[-0.56, 0.055, 0.08]} castShadow>
              <cylinderGeometry args={[0.032, 0.028, 0.11, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.35} />
            </mesh>
            <mesh position={[-0.45, 0.045, 0.08]} castShadow>
              <sphereGeometry args={[0.042, 10, 10]} />
              <meshStandardMaterial color="#dc2626" roughness={0.4} />
            </mesh>
            <mesh position={[-0.36, 0.06, 0.08]} castShadow>
              <cylinderGeometry args={[0.022, 0.022, 0.12, 10]} />
              <meshStandardMaterial color="#15803d" roughness={0.25} />
            </mesh>
            <mesh position={[-0.28, 0.095, 0.06]} castShadow>
              <cylinderGeometry args={[0.028, 0.028, 0.19, 12]} />
              <meshStandardMaterial color="#18181b" roughness={0.4} />
            </mesh>
            <mesh position={[-0.21, 0.09, 0.06]} castShadow>
              <cylinderGeometry args={[0.028, 0.028, 0.18, 12]} />
              <meshStandardMaterial color="#eab308" roughness={0.35} />
            </mesh>
            {/* Tall Bright Red 'CUVEE BRUT PIPER-HEIDSIECK' Champagne Box */}
            <mesh position={[-0.14, 0.135, 0.06]} castShadow>
              <boxGeometry args={[0.075, 0.27, 0.08]} />
              <meshStandardMaterial color="#dc2626" roughness={0.38} />
            </mesh>

            {/* Right Bay: 4 Wall Cards/Stamps on Back Wall + Gold 'LEATHER MASTER' Certificate +
                'DIMPCHI' Sign + 18 Vertical Handmade Leather Wallets in Clear Sleeves */}
            {/* 2 Stamp-Border Art Frames & 2 'The ANONYMOUS Project' Cards on Back Wall */}
            {[0.32, 0.42, 0.54, 0.63].map((wx, wIdx) => (
              <mesh key={`wall-card-${wIdx}`} position={[wx, 0.2, -0.16]}>
                <planeGeometry args={[0.08, 0.13]} />
                <meshBasicMaterial
                  color={wIdx < 2 ? '#7c2d12' : '#f8fafc'}
                />
              </mesh>
            ))}
            {/* Gold-Framed 'LEATHER MASTER' Certificate */}
            <group position={[0.24, 0.095, -0.04]} rotation={[-0.12, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.22, 0.17, 0.02]} />
                <meshStandardMaterial color="#d4af37" metalness={0.75} roughness={0.25} />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <planeGeometry args={[0.19, 0.14]} />
                <meshBasicMaterial color="#fef3c7" />
              </mesh>
            </group>
            {/* 'DIMPCHI / 사과할땐 사야됩니다' Acrylic Sign Stand */}
            <group position={[0.37, 0.06, 0.1]}>
              <mesh rotation={[-0.15, 0, 0]} castShadow>
                <boxGeometry args={[0.13, 0.11, 0.015]} />
                <meshStandardMaterial color="#c084fc" roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.045, 0.01]}>
                <boxGeometry args={[0.13, 0.02, 0.03]} />
                <meshStandardMaterial color="#f43f5e" />
              </mesh>
            </group>
            {/* 16 Packaged Handmade Leather Wallets & Cardholders Lined Up Side-by-Side! */}
            {Array.from({ length: 14 }).map((_, wIdx) => {
              const wx = 0.25 + wIdx * 0.04;
              const wColors = ['#451a03', '#7c2d12', '#1c1917', '#9a3412', '#3f3f46', '#78350f'];
              return (
                <mesh
                  key={`wallet-r4-${wIdx}`}
                  position={[wx, 0.05, 0.06]}
                  rotation={[0, 0.12, 0]}
                  castShadow
                >
                  <boxGeometry args={[0.026, 0.095, 0.09]} />
                  <meshStandardMaterial
                    color={wColors[wIdx % wColors.length]}
                    roughness={0.42}
                  />
                </mesh>
              );
            })}
          </group>

          {/* ============================================================
              ROW 3 (2ND PLANK, Y = 0.88): SPRAY CANS, 2-TIER STACKED 'FIDO' GLASS JARS (14 JARS),
              WOODEN BOX, LEATHER WALLETS & CORAL-RED WINDOW ILLUSTRATION CANVAS
              (KakaoTalk_261108_120004_231.jpeg)
             ============================================================ */}
          <group position={[0, 0.9, 0]}>
            {/* Left Bay: Red & Blue Spray Cans + 2-Tier Stacked 'Fido' Glass Hardware Jars */}
            <mesh position={[-0.81, 0.075, 0.06]} castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.15, 10]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            <mesh position={[-0.75, 0.075, 0.06]} castShadow>
              <cylinderGeometry args={[0.024, 0.024, 0.15, 10]} />
              <meshStandardMaterial color="#1d4ed8" />
            </mesh>
            {/* 7 Columns × 2 Tiers = 14 Stacked Glass Jars with Brass/Silver Hardware Inside */}
            {Array.from({ length: 7 }).map((_, jIdx) => {
              const jx = -0.66 + jIdx * 0.082;
              return (
                <group key={`jar-r3-${jIdx}`} position={[jx, 0, 0.05]}>
                  {/* Bottom Glass Jar */}
                  <mesh position={[0, 0.055, 0]} castShadow>
                    <cylinderGeometry args={[0.034, 0.034, 0.1, 10]} />
                    <meshStandardMaterial
                      color="#e0f2fe"
                      transparent
                      opacity={0.6}
                      roughness={0.15}
                    />
                  </mesh>
                  {/* Brass/Silver Hardware Fill inside Bottom Jar */}
                  <mesh position={[0, 0.038, 0]}>
                    <cylinderGeometry args={[0.028, 0.028, 0.055, 8]} />
                    <meshStandardMaterial color={jIdx % 2 === 0 ? '#d4af37' : '#94a3b8'} />
                  </mesh>
                  {/* Lid of Bottom Jar */}
                  <mesh position={[0, 0.11, 0]}>
                    <cylinderGeometry args={[0.032, 0.032, 0.015, 10]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
                  </mesh>
                  {/* Top Stacked Glass Jar (on top of the right 4 jars, matching photo!) */}
                  {jIdx >= 3 && (
                    <group position={[0, 0.12, 0]}>
                      <mesh position={[0, 0.05, 0]} castShadow>
                        <cylinderGeometry args={[0.032, 0.032, 0.095, 10]} />
                        <meshStandardMaterial
                          color="#e0f2fe"
                          transparent
                          opacity={0.6}
                          roughness={0.15}
                        />
                      </mesh>
                      <mesh position={[0, 0.035, 0]}>
                        <cylinderGeometry args={[0.026, 0.026, 0.05, 8]} />
                        <meshStandardMaterial color="#b45309" />
                      </mesh>
                      <mesh position={[0, 0.1, 0]}>
                        <cylinderGeometry args={[0.03, 0.03, 0.015, 10]} />
                        <meshStandardMaterial color="#f8fafc" />
                      </mesh>
                    </group>
                  )}
                </group>
              );
            })}

            {/* Right Bay: Wooden Box, Row of 12 Handmade Leather Wallets & Bright Coral-Red Window Illustration Canvas */}
            <mesh position={[0.24, 0.065, 0.04]} castShadow>
              <boxGeometry args={[0.2, 0.12, 0.14]} />
              <meshStandardMaterial color="#451a03" roughness={0.5} />
            </mesh>
            {Array.from({ length: 10 }).map((_, wIdx) => {
              const wx = 0.38 + wIdx * 0.032;
              return (
                <mesh
                  key={`wallet-r3-${wIdx}`}
                  position={[wx, 0.05, 0.05]}
                  rotation={[0, 0.15, 0]}
                  castShadow
                >
                  <boxGeometry args={[0.024, 0.09, 0.085]} />
                  <meshStandardMaterial
                    color={wIdx % 2 === 0 ? '#7c2d12' : '#27272a'}
                    roughness={0.45}
                  />
                </mesh>
              );
            })}
            {/* Bright Coral-Red Architectural Window Illustration Canvas Leaning on Right */}
            <group position={[0.76, 0.06, 0.12]} rotation={[-0.08, -0.08, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.22, 0.28, 0.024]} />
                <meshStandardMaterial color="#ef4444" roughness={0.45} />
              </mesh>
              {/* Recessed Dark Window Frame inside Coral Canvas */}
              <mesh position={[0, -0.01, 0.014]}>
                <planeGeometry args={[0.07, 0.13]} />
                <meshBasicMaterial color="#27272a" />
              </mesh>
            </group>
          </group>

          {/* ============================================================
              ROW 2 (1ST PLANK ABOVE FLOOR BLOCK, Y = 0.50): 2-TIER STACKED GLASS JARS & LEATHER STOCK
              + ROW 1 (BOTTOM PLANK, Y = 0.14)
             ============================================================ */}
          <group position={[0, 0.52, 0]}>
            {Array.from({ length: 5 }).map((_, jIdx) => {
              const jx = -0.52 + jIdx * 0.085;
              return (
                <group key={`jar-r2-${jIdx}`} position={[jx, 0, 0.04]}>
                  <mesh position={[0, 0.05, 0]}>
                    <cylinderGeometry args={[0.032, 0.032, 0.095, 10]} />
                    <meshStandardMaterial color="#cbd5e1" transparent opacity={0.6} />
                  </mesh>
                  <mesh position={[0, 0.14, 0]}>
                    <cylinderGeometry args={[0.032, 0.032, 0.095, 10]} />
                    <meshStandardMaterial color="#cbd5e1" transparent opacity={0.6} />
                  </mesh>
                </group>
              );
            })}
          </group>

          {/* ============================================================
              FLOOR ITEMS IN FRONT OF THE SHELF (Sized to Real Proportions below Y = 0.72 so Rows 2-7 are 100% Visible!)
              (KakaoTalk_261108_120004_231.jpeg)
             ============================================================ */}
          <group position={[0, 0, 0.38]}>
            {/* 1) White Rectangular 'MAGIKAN' Trash Bin on Left (Top at Y = 0.48) */}
            <mesh position={[-0.88, 0.24, 0]} castShadow>
              <boxGeometry args={[0.24, 0.48, 0.24]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
            {/* 2) Round Brushed Stainless Steel Pedal Trash Can + Cardboard on Top (Top at Y = 0.38) */}
            <group position={[-0.56, 0, 0.02]}>
              <mesh position={[0, 0.18, 0]} castShadow>
                <cylinderGeometry args={[0.13, 0.125, 0.36, 16]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
              </mesh>
              <mesh position={[0, 0.37, 0]}>
                <boxGeometry args={[0.24, 0.015, 0.22]} />
                <meshStandardMaterial color="#b4834e" />
              </mesh>
            </group>
            {/* 3) White & Sky-Blue Samsung Dehumidifier (Top at Y = 0.46) */}
            <group position={[-0.28, 0.23, 0.06]} rotation={[0, 0.35, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.2, 0.46, 0.28]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.35} />
              </mesh>
              <mesh position={[0.102, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.22, 0.34]} />
                <meshStandardMaterial color="#60a5fa" roughness={0.25} />
              </mesh>
            </group>
            {/* 4) Aluminum Wide Step Stool Bench (`알루미늄 발판 벤치`) with:
                - 2 White Jerrycans (`말통 2개`) & White Sneakers on Tray underneath
                - Folding Crate, Cute Rounded Cream Character Case (with eyes, arms & yellow feet!) & Orange 'UK' Bag on top */}
            <group position={[0.35, 0, 0.06]}>
              {/* Aluminum Step Stool Platform (Y = 0.42) & 4 Slanted Aluminum Legs */}
              <mesh position={[0, 0.42, 0]} castShadow>
                <boxGeometry args={[0.74, 0.035, 0.32]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.3} />
              </mesh>
              {[-0.34, 0.34].map((lx, lIdx) => (
                <React.Fragment key={`stool-leg-${lIdx}`}>
                  <mesh position={[lx, 0.21, 0.12]} rotation={[0, 0, lIdx === 0 ? 0.15 : -0.15]}>
                    <boxGeometry args={[0.03, 0.44, 0.03]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                  </mesh>
                  <mesh position={[lx, 0.21, -0.12]} rotation={[0, 0, lIdx === 0 ? 0.15 : -0.15]}>
                    <boxGeometry args={[0.03, 0.44, 0.03]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.8} />
                  </mesh>
                </React.Fragment>
              ))}
              {/* Underneath Step Stool: 2 White Jerrycans (`말통 2개`) + White Sneakers on Wooden Tray */}
              <mesh position={[-0.2, 0.16, 0]} castShadow>
                <boxGeometry args={[0.13, 0.32, 0.18]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
              </mesh>
              <mesh position={[-0.05, 0.16, 0]} castShadow>
                <boxGeometry args={[0.13, 0.32, 0.18]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
              </mesh>
              {/* Wooden Shoe Tray & Pair of White Sneakers */}
              <mesh position={[0.16, 0.03, 0.02]}>
                <boxGeometry args={[0.18, 0.04, 0.22]} />
                <meshStandardMaterial color="#78350f" />
              </mesh>
              <mesh position={[0.12, 0.07, 0.03]}>
                <boxGeometry args={[0.06, 0.05, 0.15]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
              <mesh position={[0.2, 0.07, 0.03]}>
                <boxGeometry args={[0.06, 0.05, 0.15]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
              {/* On Top of Step Stool Left: Dark Folding Crate */}
              <mesh position={[-0.22, 0.52, -0.02]} castShadow>
                <boxGeometry args={[0.22, 0.16, 0.24]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
              {/* On Top of Step Stool Center: Cute Cream Character Hard Case with Eyes, Arms & Yellow Feet! */}
              <group position={[-0.08, 0.56, 0.1]}>
                <mesh castShadow>
                  <boxGeometry args={[0.2, 0.24, 0.16]} />
                  <meshStandardMaterial color="#f5f5dc" roughness={0.35} />
                </mesh>
                {/* Cute Black Eyes & Nose on Character Case */}
                <mesh position={[-0.03, 0.01, 0.082]}>
                  <circleGeometry args={[0.01, 8]} />
                  <meshBasicMaterial color="#18181b" />
                </mesh>
                <mesh position={[0.03, 0.01, 0.082]}>
                  <circleGeometry args={[0.01, 8]} />
                  <meshBasicMaterial color="#18181b" />
                </mesh>
                <mesh position={[0, -0.01, 0.082]}>
                  <planeGeometry args={[0.018, 0.01]} />
                  <meshBasicMaterial color="#18181b" />
                </mesh>
                {/* Cute Yellow Dangling Feet */}
                <mesh position={[-0.04, -0.14, 0.04]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshStandardMaterial color="#facc15" />
                </mesh>
                <mesh position={[0.04, -0.14, 0.04]}>
                  <sphereGeometry args={[0.02, 8, 8]} />
                  <meshStandardMaterial color="#facc15" />
                </mesh>
              </group>
              {/* On Top of Step Stool Right: Folded Bright Orange 'UK' Shopping Bag */}
              <group position={[0.18, 0.46, 0.02]}>
                <mesh castShadow>
                  <boxGeometry args={[0.26, 0.05, 0.22]} />
                  <meshStandardMaterial color="#f97316" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.08, 0.03]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            </group>
          </group>

          {/* Top-of-Shelf Clickable Title & Expandable Description ('책방지기 진열장') */}
          <Html position={[0, 2.88, 0.25]} center zIndexRange={[18, 0]}>
            {ownerDisplayNoticeOpen ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setOwnerDisplayNoticeOpen(false);
                }}
                className="pointer-events-auto flex flex-col gap-1.5 rounded-[4px] bg-black/55 px-3.5 py-2.5 text-white/95 shadow-lg backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white whitespace-nowrap">
                    책방지기 진열장
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOwnerDisplayNoticeOpen(false);
                    }}
                    className="cursor-pointer rounded-[3px] bg-white/15 px-1.5 py-0.5 text-[11px] text-white hover:bg-white/25 transition-colors"
                  >
                    닫기
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-white/85 whitespace-nowrap">
                  가죽 제품과 인증서 아카이브, 그리고 책방지기의 또 다른 직업인
                  <br />
                  사진작가로 활동하며 사용한 카메라가 진열되어 있습니다.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOwnerDisplayNoticeOpen(true);
                }}
                className={`pointer-events-auto cursor-pointer whitespace-nowrap rounded-[4px] px-2.5 py-1 text-xs transition-all backdrop-blur-md ${
                  hoveredOwnerDisplay
                    ? 'bg-black/60 text-white shadow-md'
                    : 'bg-black/38 text-white/90 hover:bg-black/55 hover:text-white shadow-sm'
                }`}
              >
                책방지기 진열장
              </button>
            )}
          </Html>
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
                  <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                    노란 스툴에 앉기
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
            <mesh visible={false}>
              <boxGeometry args={[0.65, 0.22, 0.08]} />
            </mesh>
            <Html position={[0, 0, 0.02]} center zIndexRange={[5, 0]}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectGenreShelf(shelf);
                }}
                className={`pointer-events-auto cursor-pointer whitespace-nowrap rounded-[4px] px-2.5 py-1 text-xs transition-all backdrop-blur-md ${
                  isCurrentActive
                    ? 'bg-black/60 text-white shadow-md'
                    : 'bg-black/38 text-white/90 hover:bg-black/55 hover:text-white shadow-sm'
                }`}
              >
                {shelf.name}
              </button>
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
              <boxGeometry
                args={
                  book.id === 'book_tokyo_den'
                    ? [0.27, 0.27, 0.038]
                    : [0.21, 0.28, 0.042]
                }
              />
              <meshStandardMaterial
                color={book.coverColor}
                emissive={isHovered ? book.accentColor : '#000000'}
                emissiveIntensity={isHovered ? 0.25 : 0}
                roughness={0.45}
              />
            </mesh>
            {book.id === 'book_tokyo_den' ? (
              /* Authentic 『東京傳 (동경전)』 Photo-Book Cover: White Upper Margin + Street Photo Lower Area */
              <>
                <mesh position={[0, -0.032, isHovered ? 0.061 : 0.021]}>
                  <planeGeometry args={[0.246, 0.175]} />
                  <meshStandardMaterial color="#475569" roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.09, isHovered ? 0.061 : 0.021]}>
                  <planeGeometry args={[0.07, 0.016]} />
                  <meshBasicMaterial color="#18181b" />
                </mesh>
              </>
            ) : (
              <mesh position={[0, -0.05, isHovered ? 0.062 : 0.022]}>
                <boxGeometry args={[0.212, 0.055, 0.004]} />
                <meshStandardMaterial color={book.accentColor} />
              </mesh>
            )}
            {/* HIDDEN OBJECT #1 (`hidden_book_dokja`): Protruding Golden Bookmark Ribbon & Star Charm on 『작지만, 독자』 */}
            {book.id === 'book_small_dokja' && (
              <group
                position={[0, 0.175, 0.015]}
                onClick={(e) => {
                  e.stopPropagation();
                  onFindHiddenStamp('hidden_book_dokja');
                  onSelectBook(book);
                }}
              >
                {/* Red/Gold Bookmark Ribbon Sticking Out of Top */}
                <mesh position={[0, -0.015, 0]}>
                  <boxGeometry args={[0.028, 0.06, 0.008]} />
                  <meshBasicMaterial color="#dc2626" />
                </mesh>
                {/* Golden Star/Coin Charm on Top of Bookmark */}
                <mesh position={[0, 0.025, 0]}>
                  <octahedronGeometry args={[0.032, 0]} />
                  <meshStandardMaterial
                    color="#facc15"
                    emissive="#eab308"
                    emissiveIntensity={0.55}
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
              </group>
            )}
            {(isHovered || nearbyBookId === book.id) && (
              <Html position={[0, 0.25, 0.05]} center zIndexRange={[6, 0]}>
                <div className="pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm transition-all">
                  <span className="max-w-[140px] truncate">{book.title}</span>
                  {nearbyBookId === book.id && (
                    <span className="rounded-[2px] bg-white/15 px-1 text-[10px] text-white/85">
                      E
                    </span>
                  )}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Dedicated Hidden Golden-Star-Bookmark Book on the Right Main Bookcase 4th Shelf (`[4.12, 1.72, 2.72]`) */}
      <group
        position={[4.12, 1.72, 2.72]}
        rotation={[0, -Math.PI / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onFindHiddenStamp('hidden_book_dokja');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredHiddenId('hidden_book_dokja');
        }}
        onPointerOut={() => setHoveredHiddenId(null)}
      >
        <mesh visible={false}>
          <boxGeometry args={[0.36, 0.42, 0.25]} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[0.21, 0.28, 0.046]} />
          <meshStandardMaterial color="#c85a28" roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.04, 0.025]}>
          <boxGeometry args={[0.212, 0.055, 0.004]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
        {/* Protruding Red Ribbon & Gold Star Charm */}
        <mesh position={[0, 0.16, 0.01]}>
          <boxGeometry args={[0.028, 0.06, 0.008]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
        <mesh position={[0, 0.2, 0.01]}>
          <octahedronGeometry args={[0.034, 0]} />
          <meshStandardMaterial
            color="#facc15"
            emissive="#eab308"
            emissiveIntensity={0.6}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {(hoveredHiddenId === 'hidden_book_dokja' ||
          collectedStampIds.includes('hidden_book_dokja')) && (
          <Html position={[0, 0.3, 0.06]} center zIndexRange={[6, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
              {collectedStampIds.includes('hidden_book_dokja')
                ? '황금 별 책갈피 책 확인'
                : '황금 별 책갈피 책 발견'}
            </div>
          </Html>
        )}
      </group>

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
              <mesh position={[0, 0.745, 0]}>
                <boxGeometry args={[2.31, 0.03, 0.9]} />
                <meshStandardMaterial color="#18181b" roughness={0.5} />
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

              {/* ============================================================
                  UNDER-TABLE PROPS (center_table.jpg):
                  1) Vintage Military Wooden Crate ('주의: 이 포장은 방습포장이 아니므로...')
                  2) Round Wooden Serving Board & Tan Leather Mat resting on Crate
                  3) Stacked Grey & Bright Yellow Molded Stools on Right Side
                 ============================================================ */}
              <group position={[-0.25, 0.33, 0]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[1.48, 0.64, 0.76]} />
                  <meshStandardMaterial color="#c49a60" roughness={0.85} />
                </mesh>
                {/* White Shipping Label on Left Side of Crate */}
                <mesh position={[-0.48, 0.06, 0.382]}>
                  <planeGeometry args={[0.24, 0.22]} />
                  <meshBasicMaterial color="#f8fafc" />
                </mesh>
                {/* Stencil Warning Text Block on Center-Right of Crate */}
                <mesh position={[0.15, 0.04, 0.382]}>
                  <planeGeometry args={[0.52, 0.24]} />
                  <meshBasicMaterial color="#b0854b" />
                </mesh>
                {/* Vertical Wood Battens on Crate */}
                {[-0.7, 0, 0.7].map((bx, bIdx) => (
                  <mesh key={bIdx} position={[bx, 0, 0.382]}>
                    <boxGeometry args={[0.055, 0.64, 0.018]} />
                    <meshStandardMaterial color="#a67c46" />
                  </mesh>
                ))}
                {/* Round Wooden Cutting/Serving Board with Handle resting on Top of Crate */}
                <group position={[-0.22, 0.335, 0.08]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.2, 0.2, 0.025, 20]} />
                    <meshStandardMaterial color="#8c5828" roughness={0.65} />
                  </mesh>
                  <mesh position={[0.22, 0, 0.04]} rotation={[0, -0.2, 0]}>
                    <boxGeometry args={[0.12, 0.022, 0.05]} />
                    <meshStandardMaterial color="#8c5828" roughness={0.65} />
                  </mesh>
                </group>
                {/* Warm Tan Leather Mat resting on Top Right of Crate */}
                <mesh position={[0.3, 0.332, 0.06]} rotation={[0, 0.08, 0]}>
                  <boxGeometry args={[0.42, 0.015, 0.32]} />
                  <meshStandardMaterial color="#c87d32" roughness={0.55} />
                </mesh>
              </group>

              {/* Stacked Yellow & Charcoal-Grey Stools tucked under right side of table */}
              <group position={[0.78, 0, 0.02]}>
                {/* Bottom Bright Yellow Stool */}
                <mesh position={[0, 0.4, 0]} castShadow>
                  <boxGeometry args={[0.32, 0.038, 0.32]} />
                  <meshStandardMaterial color="#eab308" roughness={0.35} />
                </mesh>
                {[
                  [-0.13, 0.2, -0.13],
                  [0.13, 0.2, -0.13],
                  [-0.13, 0.2, 0.13],
                  [0.13, 0.2, 0.13],
                ].map(([sx, sy, sz], sIdx) => (
                  <mesh key={`ystool-${sIdx}`} position={[sx, sy, sz]} castShadow>
                    <boxGeometry args={[0.04, 0.4, 0.04]} />
                    <meshStandardMaterial color="#eab308" roughness={0.35} />
                  </mesh>
                ))}
                {/* Top Stacked Charcoal-Grey Stool */}
                <group position={[0, 0.12, 0]} rotation={[0, 0.18, 0]}>
                  <mesh position={[0, 0.42, 0]} castShadow>
                    <boxGeometry args={[0.33, 0.04, 0.33]} />
                    <meshStandardMaterial color="#57534e" roughness={0.45} />
                  </mesh>
                  {[
                    [-0.14, 0.21, -0.14],
                    [0.14, 0.21, -0.14],
                    [-0.14, 0.21, 0.14],
                    [0.14, 0.21, 0.14],
                  ].map(([sx, sy, sz], sIdx) => (
                    <mesh key={`gstool-${sIdx}`} position={[sx, sy, sz]} castShadow>
                      <boxGeometry args={[0.042, 0.42, 0.042]} />
                      <meshStandardMaterial color="#57534e" roughness={0.45} />
                    </mesh>
                  ))}
                </group>
              </group>

              {/* ============================================================
                  RICH TABLETOP CURATION & PROPS (center_table.jpg):
                  1) Front Row: 7 Multi-Book Curated Stacks with Belly Bands
                  2) Left-Back: Open Guestbook + Pen, 3 Round Leather Coasters,
                     2 Wooden Bookmark/Card Holders, Wooden Pen Cup
                  3) Center-Left: Clear Acrylic Book Stand with Open Illustrated Book
                  4) Center: Glass Vase with 3 Red Roses + Vintage Silver/Black Camera
                  5) Center-Right: Silver 'READ MORE BOOKS' Mirror + 'Postcard' Tag
                     & 3 Upright Framed Art Postcards
                  6) Right Side: Walnut Organizer Tray with Brass Handles,
                     2 White Duck Figurines (one with Yellow Hat!), Aroma Bottle,
                     Magazine/Zine Rack & Brass Goods Tray
                 ============================================================ */}

              {/* 1) Front Row: 7 Multi-Book Stacks lined along the front edge (Z = +0.26) */}
              {[
                {
                  bx: -0.94,
                  books: [
                    { col: '#d6d3cd', h: 0.032, band: '#3f3f46' },
                    { col: '#f5efe6', h: 0.03, band: '#1e293b' },
                    { col: '#ffffff', h: 0.028, band: '#0f172a' }, // 東京傳
                  ],
                },
                {
                  bx: -0.65,
                  books: [
                    { col: '#c29b61', h: 0.026, band: '#78350f' },
                    { col: '#e7d5b8', h: 0.028, band: '#ea580c' }, // 작지만, 독자
                  ],
                },
                {
                  bx: -0.38,
                  books: [
                    { col: '#27272a', h: 0.024, band: '#dc2626' },
                    { col: '#dc2626', h: 0.026, band: '#fef08a' }, // Coral/Red Essay
                  ],
                },
                {
                  bx: -0.11,
                  books: [
                    { col: '#e2e8f0', h: 0.024, band: '#475569' },
                    { col: '#f8fafc', h: 0.028, band: '#dc2626' }, // W O R K
                  ],
                },
                {
                  bx: 0.16,
                  books: [
                    { col: '#451a03', h: 0.026, band: '#d97706' },
                    { col: '#7c2d12', h: 0.028, band: '#fde68a' },
                  ],
                },
                {
                  bx: 0.43,
                  books: [
                    { col: '#d6d3cd', h: 0.025, band: '#15803d' },
                    { col: '#fef3c7', h: 0.028, band: '#b45309' },
                    { col: '#fffbeb', h: 0.024, band: '#c2410c' },
                  ],
                },
                {
                  bx: 0.7,
                  books: [
                    { col: '#9a3412', h: 0.025, band: '#fef3c7' },
                    { col: '#ea580c', h: 0.028, band: '#18181b' },
                  ],
                },
              ].map((stack, sIdx) => {
                let currentY = 0.805;
                return (
                  <group key={`front-stack-${sIdx}`} position={[stack.bx, 0, 0.25]}>
                    {stack.books.map((bk, bIdx) => {
                      const yPos = currentY + bk.h / 2;
                      currentY += bk.h + 0.002;
                      const rotY = (bIdx % 2 === 0 ? 1 : -1) * 0.035;
                      return (
                        <group
                          key={bIdx}
                          position={[0, yPos, 0]}
                          rotation={[0, rotY, 0]}
                        >
                          <mesh castShadow>
                            <boxGeometry args={[0.205, bk.h, 0.265]} />
                            <meshStandardMaterial color={bk.col} roughness={0.55} />
                          </mesh>
                          {/* Book Belly Band (띠지) / Cover Graphic */}
                          <mesh position={[0, bk.h / 2 + 0.001, 0.04]}>
                            <boxGeometry args={[0.207, 0.003, 0.065]} />
                            <meshBasicMaterial color={bk.band} />
                          </mesh>
                        </group>
                      );
                    })}
                  </group>
                );
              })}

              {/* 2) Left-Back Props: Open Guestbook + Pen, 3 Round Leather Coasters, Card Holders & Pen Cup */}
              {/* Open Guestbook Notebook & Silver Fountain Pen */}
              <group position={[-0.95, 0.815, -0.08]} rotation={[0, 0.08, 0]}>
                {/* Dark Leather Notebook Cover */}
                <mesh>
                  <boxGeometry args={[0.29, 0.012, 0.21]} />
                  <meshStandardMaterial color="#292524" roughness={0.7} />
                </mesh>
                {/* Left & Right Cream Pages */}
                <mesh position={[-0.068, 0.009, 0]} rotation={[0, 0, -0.03]}>
                  <boxGeometry args={[0.13, 0.008, 0.195]} />
                  <meshStandardMaterial color="#fffbeb" roughness={0.8} />
                </mesh>
                <mesh position={[0.068, 0.009, 0]} rotation={[0, 0, 0.03]}>
                  <boxGeometry args={[0.13, 0.008, 0.195]} />
                  <meshStandardMaterial color="#fffbeb" roughness={0.8} />
                </mesh>
                {/* Red Ribbon Bookmark */}
                <mesh position={[0, 0.014, 0.02]}>
                  <boxGeometry args={[0.008, 0.003, 0.21]} />
                  <meshBasicMaterial color="#dc2626" />
                </mesh>
                {/* Silver Pen resting diagonally */}
                <mesh
                  position={[0.04, 0.018, 0.02]}
                  rotation={[Math.PI / 2, 0.45, 0]}
                >
                  <cylinderGeometry args={[0.005, 0.004, 0.14, 8]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    metalness={0.85}
                    roughness={0.2}
                  />
                </mesh>
              </group>

              {/* 3 Round Handcrafted Leather Coasters (Red, Tan, Cream) */}
              {[
                [-0.72, 0.812, -0.02, '#b91c1c'],
                [-0.64, 0.814, -0.08, '#c26a27'],
                [-0.74, 0.816, -0.14, '#e5d3b3'],
              ].map(([cx, cy, cz, cCol], cIdx) => (
                <mesh
                  key={`coaster-${cIdx}`}
                  position={[Number(cx), Number(cy), Number(cz)]}
                  castShadow
                >
                  <cylinderGeometry args={[0.052, 0.052, 0.008, 18]} />
                  <meshStandardMaterial color={String(cCol)} roughness={0.6} />
                </mesh>
              ))}

              {/* 2 Wooden Bookmark / Business Card Stands & Wooden Pen Cup */}
              <group position={[-0.86, 0.805, -0.28]}>
                {/* Wooden Card Holder 1 */}
                <mesh position={[0, 0.015, 0]} castShadow>
                  <boxGeometry args={[0.11, 0.03, 0.045]} />
                  <meshStandardMaterial color="#784721" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.055, 0]} rotation={[-0.12, 0, 0]}>
                  <boxGeometry args={[0.09, 0.075, 0.004]} />
                  <meshBasicMaterial color="#fef3c7" />
                </mesh>
                {/* Wooden Card Holder 2 (Tall Bookmarks) */}
                <mesh position={[0.15, 0.015, 0.02]} castShadow>
                  <boxGeometry args={[0.1, 0.03, 0.045]} />
                  <meshStandardMaterial color="#5c3417" roughness={0.7} />
                </mesh>
                <mesh position={[0.13, 0.075, 0.02]} rotation={[-0.1, 0, 0.04]}>
                  <boxGeometry args={[0.038, 0.12, 0.004]} />
                  <meshBasicMaterial color="#ea580c" />
                </mesh>
                <mesh position={[0.17, 0.07, 0.02]} rotation={[-0.1, 0, -0.05]}>
                  <boxGeometry args={[0.038, 0.11, 0.004]} />
                  <meshBasicMaterial color="#1d4ed8" />
                </mesh>
                {/* Wooden Pen/Pencil Cup */}
                <group position={[-0.14, 0, -0.02]}>
                  <mesh position={[0, 0.05, 0]} castShadow>
                    <cylinderGeometry args={[0.034, 0.032, 0.1, 12]} />
                    <meshStandardMaterial color="#854d27" roughness={0.65} />
                  </mesh>
                  <mesh position={[-0.01, 0.11, 0]} rotation={[0.1, 0, 0.15]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.09, 6]} />
                    <meshBasicMaterial color="#eab308" />
                  </mesh>
                  <mesh position={[0.012, 0.115, 0.008]} rotation={[-0.1, 0, -0.12]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.1, 6]} />
                    <meshBasicMaterial color="#dc2626" />
                  </mesh>
                </group>
              </group>

              {/* 3) Center-Left: Slanted Clear Acrylic Book Stand with Open Illustrated Book Spread */}
              <group position={[-0.44, 0.805, -0.09]}>
                {/* Acrylic Stand Base & Backplate */}
                <mesh position={[0, 0.01, 0.03]}>
                  <boxGeometry args={[0.28, 0.01, 0.16]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    transparent
                    opacity={0.55}
                    roughness={0.15}
                  />
                </mesh>
                <mesh position={[0, 0.095, -0.01]} rotation={[-0.42, 0, 0]}>
                  <boxGeometry args={[0.3, 0.19, 0.01]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    transparent
                    opacity={0.5}
                    roughness={0.15}
                  />
                </mesh>
                {/* Open Book Spread resting on Acrylic Stand */}
                <group position={[0, 0.098, 0.005]} rotation={[-0.42, 0, 0]}>
                  {/* Book Cover Backing */}
                  <mesh castShadow>
                    <boxGeometry args={[0.33, 0.21, 0.016]} />
                    <meshStandardMaterial color="#3b2818" roughness={0.6} />
                  </mesh>
                  {/* Left & Right Open Pages */}
                  <mesh position={[-0.078, 0, 0.01]} rotation={[0, 0.08, 0]}>
                    <boxGeometry args={[0.15, 0.195, 0.008]} />
                    <meshStandardMaterial color="#fffbeb" roughness={0.7} />
                  </mesh>
                  <mesh position={[0.078, 0, 0.01]} rotation={[0, -0.08, 0]}>
                    <boxGeometry args={[0.15, 0.195, 0.008]} />
                    <meshStandardMaterial color="#fffbeb" roughness={0.7} />
                  </mesh>
                  {/* Photo Illustration Block on Left Page */}
                  <mesh position={[-0.078, 0.02, 0.015]} rotation={[0, 0.08, 0]}>
                    <planeGeometry args={[0.11, 0.09]} />
                    <meshBasicMaterial color="#0284c7" />
                  </mesh>
                </group>
              </group>

              {/* 4) Center: Clear Glass Vase with 3 Red Roses + Vintage Silver/Black Film Camera */}
              {/* Clear Glass Bottle Vase with Green Stems & 3 Blooming Red Roses */}
              <group position={[-0.16, 0.805, -0.18]}>
                <mesh position={[0, 0.075, 0]} castShadow>
                  <cylinderGeometry args={[0.024, 0.038, 0.15, 14]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    transparent
                    opacity={0.65}
                    roughness={0.15}
                  />
                </mesh>
                {/* Green Flower Stems */}
                <mesh position={[0, 0.14, 0]} rotation={[0.08, 0, 0.08]}>
                  <cylinderGeometry args={[0.004, 0.004, 0.18, 6]} />
                  <meshStandardMaterial color="#15803d" />
                </mesh>
                <mesh position={[-0.01, 0.13, 0.01]} rotation={[-0.1, 0, -0.15]}>
                  <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
                  <meshStandardMaterial color="#15803d" />
                </mesh>
                {/* 3 Red Rose Blooms & Green Leaves */}
                <mesh position={[0.01, 0.22, 0.01]} castShadow>
                  <sphereGeometry args={[0.042, 12, 12]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.55} />
                </mesh>
                <mesh position={[-0.032, 0.195, 0.015]} castShadow>
                  <sphereGeometry args={[0.034, 10, 10]} />
                  <meshStandardMaterial color="#b91c1c" roughness={0.55} />
                </mesh>
                <mesh position={[0.032, 0.19, -0.015]} castShadow>
                  <sphereGeometry args={[0.032, 10, 10]} />
                  <meshStandardMaterial color="#ef4444" roughness={0.55} />
                </mesh>
                <mesh position={[-0.03, 0.16, 0]} rotation={[0.4, 0, 0.5]}>
                  <boxGeometry args={[0.04, 0.006, 0.022]} />
                  <meshStandardMaterial color="#166534" />
                </mesh>
              </group>

              {/* Vintage Silver & Black Rangefinder Film Camera (Yashica / Leica style) */}
              <group position={[-0.14, 0.805, -0.01]} rotation={[0, -0.15, 0]}>
                {/* Black Leatherette Body */}
                <mesh position={[0, 0.038, 0]} castShadow>
                  <boxGeometry args={[0.135, 0.072, 0.056]} />
                  <meshStandardMaterial color="#18181b" roughness={0.55} />
                </mesh>
                {/* Brushed Silver Top Plate */}
                <mesh position={[0, 0.08, 0]} castShadow>
                  <boxGeometry args={[0.136, 0.022, 0.057]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    metalness={0.82}
                    roughness={0.22}
                  />
                </mesh>
                {/* Silver & Black Protruding Lens Barrel */}
                <mesh
                  position={[0.008, 0.042, 0.042]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <cylinderGeometry args={[0.028, 0.03, 0.036, 16]} />
                  <meshStandardMaterial
                    color="#cbd5e1"
                    metalness={0.8}
                    roughness={0.25}
                  />
                </mesh>
                {/* Dark Glass Lens Element */}
                <mesh
                  position={[0.008, 0.042, 0.061]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.021, 0.021, 0.004, 16]} />
                  <meshStandardMaterial
                    color="#0f172a"
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
                {/* Shutter Dial & Rewind Knob */}
                <mesh position={[-0.042, 0.096, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.012, 10]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
                </mesh>
                <mesh position={[0.045, 0.095, 0]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.01, 10]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
                </mesh>
              </group>

              {/* 5) Center-Right: Angled 'READ MORE BOOKS' Mirror + 'Postcard' Tag & 3 Framed Postcard Stands */}
              <group position={[0.2, 0.805, -0.18]} rotation={[0, -0.06, 0]}>
                {/* Silver Metallic Mirror Frame */}
                <mesh
                  position={[0, 0.135, 0]}
                  rotation={[-0.24, 0, 0]}
                  castShadow
                >
                  <boxGeometry args={[0.35, 0.27, 0.022]} />
                  <meshStandardMaterial
                    color="#e2e8f0"
                    metalness={0.78}
                    roughness={0.2}
                  />
                </mesh>
                {/* Reflective Inner Mirror Surface */}
                <mesh position={[0, 0.135, 0.013]} rotation={[-0.24, 0, 0]}>
                  <planeGeometry args={[0.31, 0.23]} />
                  <meshStandardMaterial
                    color="#cbd5e1"
                    metalness={0.92}
                    roughness={0.08}
                  />
                </mesh>
                {/* Top 'READ MORE BOOKS' Header Bar on Mirror */}
                <mesh position={[0, 0.215, 0.033]} rotation={[-0.24, 0, 0]}>
                  <planeGeometry args={[0.22, 0.028]} />
                  <meshBasicMaterial color="#1e293b" />
                </mesh>
                {/* Yellow 'Postcard' Sticker Tag on Bottom-Right of Mirror */}
                <mesh position={[0.11, 0.055, 0.048]} rotation={[-0.24, 0, 0.05]}>
                  <planeGeometry args={[0.085, 0.036]} />
                  <meshBasicMaterial color="#facc15" />
                </mesh>
              </group>

              {/* 3 Upright Framed Art Postcards / Mini Photo Stands in front of Mirror */}
              {[
                [0.06, 0.855, -0.02, '#7c2d12', '#fde68a', 0.08],
                [0.2, 0.85, 0.0, '#1e293b', '#38bdf8', -0.04],
                [0.34, 0.855, -0.02, '#784721', '#fb7185', -0.12],
              ].map(([px, py, pz, frameCol, artCol, rotY], pIdx) => (
                <group
                  key={`postcard-frame-${pIdx}`}
                  position={[Number(px), Number(py), Number(pz)]}
                  rotation={[-0.18, Number(rotY), 0]}
                >
                  <mesh castShadow>
                    <boxGeometry args={[0.105, 0.11, 0.014]} />
                    <meshStandardMaterial color={String(frameCol)} roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 0, 0.008]}>
                    <planeGeometry args={[0.082, 0.088]} />
                    <meshBasicMaterial color={String(artCol)} />
                  </mesh>
                </group>
              ))}

              {/* 6) Right Side: Walnut Organizer Tray with Brass Handles, 2 White Duck Figurines, Magazines & Goods */}
              {/* Dark Walnut Wooden Organizer Tray with Brass Side Handles */}
              <group position={[0.58, 0.805, -0.05]} rotation={[0, -0.05, 0]}>
                {/* Tray Base & 4 Raised Wooden Walls */}
                <mesh position={[0, 0.012, 0]} castShadow>
                  <boxGeometry args={[0.32, 0.024, 0.28]} />
                  <meshStandardMaterial color="#4a2a14" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.036, 0.13]}>
                  <boxGeometry args={[0.32, 0.032, 0.018]} />
                  <meshStandardMaterial color="#3b2110" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.036, -0.13]}>
                  <boxGeometry args={[0.32, 0.032, 0.018]} />
                  <meshStandardMaterial color="#3b2110" roughness={0.7} />
                </mesh>
                <mesh position={[-0.15, 0.036, 0]}>
                  <boxGeometry args={[0.018, 0.032, 0.28]} />
                  <meshStandardMaterial color="#3b2110" roughness={0.7} />
                </mesh>
                <mesh position={[0.15, 0.036, 0]}>
                  <boxGeometry args={[0.018, 0.032, 0.28]} />
                  <meshStandardMaterial color="#3b2110" roughness={0.7} />
                </mesh>
                {/* Brass Handles on Left & Right of Tray */}
                <mesh position={[-0.165, 0.042, 0]}>
                  <boxGeometry args={[0.012, 0.014, 0.08]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
                </mesh>
                <mesh position={[0.165, 0.042, 0]}>
                  <boxGeometry args={[0.012, 0.014, 0.08]} />
                  <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
                </mesh>

                {/* HIDDEN OBJECT #4 (`hidden_hat_duck`): Cute White Duck Figurine #1 (Wearing a Yellow Hat!) inside Tray */}
                <group
                  position={[-0.06, 0.025, 0.04]}
                  rotation={[0, 0.25, 0]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFindHiddenStamp('hidden_hat_duck');
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredHiddenId('hidden_hat_duck');
                  }}
                  onPointerOut={() => setHoveredHiddenId(null)}
                >
                  {/* Generous invisible touch/click collider */}
                  <mesh position={[0, 0.06, 0]} visible={false}>
                    <boxGeometry args={[0.24, 0.24, 0.24]} />
                  </mesh>
                  {/* Plump White Body & Head */}
                  <mesh position={[0, 0.038, 0]} castShadow>
                    <sphereGeometry args={[0.042, 12, 12]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.082, 0.012]} castShadow>
                    <sphereGeometry args={[0.03, 12, 12]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.6} />
                  </mesh>
                  {/* Orange Beak */}
                  <mesh
                    position={[0, 0.08, 0.044]}
                    rotation={[Math.PI / 2, 0, 0]}
                  >
                    <coneGeometry args={[0.012, 0.026, 8]} />
                    <meshStandardMaterial color="#ea580c" />
                  </mesh>
                  {/* Bright Yellow Sun-Hat with Red Band on Duck's Head! */}
                  <mesh position={[0, 0.106, 0.01]}>
                    <cylinderGeometry args={[0.036, 0.036, 0.006, 14]} />
                    <meshStandardMaterial color="#facc15" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.118, 0.01]}>
                    <cylinderGeometry args={[0.022, 0.025, 0.02, 12]} />
                    <meshStandardMaterial color="#facc15" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.11, 0.01]}>
                    <cylinderGeometry args={[0.025, 0.026, 0.005, 12]} />
                    <meshBasicMaterial color="#dc2626" />
                  </mesh>
                  {(hoveredHiddenId === 'hidden_hat_duck' ||
                    collectedStampIds.includes('hidden_hat_duck')) && (
                    <Html position={[0, 0.22, 0]} center zIndexRange={[6, 0]}>
                      <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/50 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                        {collectedStampIds.includes('hidden_hat_duck')
                          ? '노란 모자 오리 확인'
                          : '노란 모자 오리 발견'}
                      </div>
                    </Html>
                  )}
                </group>

                {/* Cute White Duck Figurine #2 inside Tray */}
                <group position={[0.05, 0.025, 0.05]} rotation={[0, -0.3, 0]}>
                  <mesh position={[0, 0.032, 0]} castShadow>
                    <sphereGeometry args={[0.035, 12, 12]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.068, 0.01]} castShadow>
                    <sphereGeometry args={[0.024, 10, 10]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.6} />
                  </mesh>
                  <mesh
                    position={[0, 0.066, 0.036]}
                    rotation={[Math.PI / 2, 0, 0]}
                  >
                    <coneGeometry args={[0.01, 0.022, 8]} />
                    <meshStandardMaterial color="#ea580c" />
                  </mesh>
                </group>

                {/* Amber Diffuser Bottle & Small Goods Boxes in Back of Tray */}
                <mesh position={[-0.07, 0.055, -0.06]} castShadow>
                  <cylinderGeometry args={[0.022, 0.024, 0.065, 10]} />
                  <meshStandardMaterial color="#92400e" roughness={0.25} />
                </mesh>
                <mesh position={[0.06, 0.045, -0.05]} castShadow>
                  <boxGeometry args={[0.09, 0.045, 0.08]} />
                  <meshStandardMaterial color="#fef3c7" roughness={0.6} />
                </mesh>
              </group>

              {/* Tall Slanted Magazine, Zine & Kraft Envelope Rack leaning against Right Wood Pillar */}
              <group position={[0.92, 0.805, -0.1]} rotation={[0, -0.22, 0]}>
                {/* Wooden Rack Backing */}
                <mesh position={[0, 0.14, -0.06]} castShadow>
                  <boxGeometry args={[0.3, 0.28, 0.04]} />
                  <meshStandardMaterial color="#784721" roughness={0.7} />
                </mesh>
                {/* Tall Kraft Envelope & Art Magazine */}
                <mesh position={[-0.02, 0.15, -0.02]} rotation={[-0.12, 0, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.28, 0.022]} />
                  <meshStandardMaterial color="#d6b88e" roughness={0.75} />
                </mesh>
                {/* Colorful Indie Zine 1 */}
                <mesh position={[0.02, 0.12, 0.01]} rotation={[-0.15, 0, -0.04]} castShadow>
                  <boxGeometry args={[0.22, 0.23, 0.018]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.6} />
                </mesh>
                {/* Colorful Indie Zine 2 (Teal/Blue) */}
                <mesh position={[-0.03, 0.095, 0.035]} rotation={[-0.18, 0, 0.03]} castShadow>
                  <boxGeometry args={[0.19, 0.18, 0.016]} />
                  <meshStandardMaterial color="#0284c7" roughness={0.55} />
                </mesh>
                {/* Front Illustrated Postcard Pack */}
                <mesh position={[0.03, 0.065, 0.055]} rotation={[-0.2, 0, 0]} castShadow>
                  <boxGeometry args={[0.14, 0.12, 0.015]} />
                  <meshStandardMaterial color="#f97316" roughness={0.55} />
                </mesh>
              </group>

              {/* Small Round Brass Tray with Badges & Stickers on Front-Right Corner */}
              <group position={[0.94, 0.812, 0.22]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.085, 0.075, 0.014, 18]} />
                  <meshStandardMaterial
                    color="#d4af37"
                    metalness={0.78}
                    roughness={0.25}
                  />
                </mesh>
                <mesh position={[-0.02, 0.01, 0.01]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.006, 12]} />
                  <meshBasicMaterial color="#dc2626" />
                </mesh>
                <mesh position={[0.025, 0.01, -0.015]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.006, 12]} />
                  <meshBasicMaterial color="#2563eb" />
                </mesh>
                <mesh position={[0.01, 0.01, 0.028]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.006, 12]} />
                  <meshBasicMaterial color="#facc15" />
                </mesh>
              </group>

              {hoveredTableId === centerTable.id && (
                <Html position={[0, 1.24, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                    추천 도서 테이블
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

            {/* Folded Grey Camping Cot Frame leaning under Left Side of Recommendation Table (120000_01.jpeg) */}
            <group position={[-1.18, 0.36, -0.05]} rotation={[0, 0.08, 0.14]}>
              <mesh castShadow>
                <boxGeometry args={[0.09, 0.68, 0.78]} />
                <meshStandardMaterial color="#64748b" roughness={0.6} />
              </mesh>
              <mesh position={[0.05, 0, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 0.72, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.7} />
              </mesh>
            </group>

            {/* Detailed Grey Industrial Leather Clicking / Skiving Machine Cabinet behind Recommendation Table
                (KakaoTalk_261108_120001_41.jpeg, 120000_01.jpeg) */}
            <group position={[-0.12, 0, -0.95]}>
              {/* Heavy Grey Steel Machine Cabinet Base */}
              <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.28, 0.88, 0.72]} />
                <meshStandardMaterial color="#64748b" roughness={0.48} metalness={0.25} />
              </mesh>
              {/* Louvered Ventilation Slits on Left Side of Cabinet */}
              {[0.28, 0.36, 0.44, 0.52, 0.6].map((vy, vIdx) => (
                <mesh key={`vent-${vIdx}`} position={[-0.642, vy, 0]}>
                  <boxGeometry args={[0.008, 0.025, 0.36]} />
                  <meshBasicMaterial color="#334155" />
                </mesh>
              ))}
              {/* Top Work Surface & Wooden Tool Tray */}
              <mesh position={[0, 0.9, 0]} castShadow>
                <boxGeometry args={[1.32, 0.04, 0.76]} />
                <meshStandardMaterial color="#475569" roughness={0.5} />
              </mesh>
              {/* Left Black Control Box with Red Emergency Button & Purple/Yellow KB QR Stand (120001_41.jpeg) */}
              <group position={[-0.42, 0.92, -0.06]}>
                <mesh position={[0, 0.12, 0]} castShadow>
                  <boxGeometry args={[0.28, 0.24, 0.28]} />
                  <meshStandardMaterial color="#18181b" roughness={0.4} />
                </mesh>
                {/* Red Push Button on Front */}
                <mesh position={[-0.142, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.015, 12]} />
                  <meshBasicMaterial color="#dc2626" />
                </mesh>
                {/* Purple & Yellow KB QR Payment Stand on Top of Control Box */}
                <mesh position={[0, 0.31, 0]} rotation={[0, -0.35, 0]} castShadow>
                  <boxGeometry args={[0.11, 0.15, 0.02]} />
                  <meshStandardMaterial color="#6b21a8" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.32, 0.012]} rotation={[0, -0.35, 0]}>
                  <planeGeometry args={[0.08, 0.09]} />
                  <meshBasicMaterial color="#facc15" />
                </mesh>
              </group>
              {/* Center Silver Clicking Press Head with Brown BAPE Sticker */}
              <group position={[0.06, 0.92, -0.04]}>
                <mesh position={[0, 0.16, 0]} castShadow>
                  <boxGeometry args={[0.38, 0.32, 0.34]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.75} roughness={0.25} />
                </mesh>
                {/* Brown BAPE Logo Sticker on Silver Plate */}
                <mesh position={[0, 0.18, -0.172]} rotation={[0, Math.PI, 0]}>
                  <circleGeometry args={[0.048, 14]} />
                  <meshBasicMaterial color="#78350f" />
                </mesh>
              </group>
              {/* Yellow Oil Bottle & Leather Offcuts Tray on Right */}
              <mesh position={[0.42, 1.0, 0.08]} castShadow>
                <cylinderGeometry args={[0.032, 0.036, 0.16, 10]} />
                <meshStandardMaterial color="#eab308" roughness={0.35} />
              </mesh>
              {/* Cute White Character Cushion Hanging on Back of Machine */}
              <mesh position={[0.05, 0.62, -0.38]} castShadow>
                <boxGeometry args={[0.32, 0.3, 0.08]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.7} />
              </mesh>
            </group>
          </group>
        );
      })()}

      {/* ============================================================
          12. BACK-LEFT & CENTER-BACK:
              - DIMPCHI LEATHER WORKBENCH & WHEELED SEWING MACHINE TABLE
              - WEST GALLERY WALL (COWHIDE, CHERRY BLOSSOM, SUNFLOWERS,
                3x3 VAN GOGH PARODY TAPESTRY & APPLIANCES)
              - PERSONAL STUDY & LARGE WALNUT TABLE WITH 4 GREEN-SOCKED CHAIRS
              - NORTH-WEST SINK, WATER HEATER, 2-TIER MUG SHELVES & COFFEE BAR
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

            {/* ------------------------------------------------------------
                A. WEST WALL ARTWORKS & ORGANIC WHOLE COWHIDE PELT (`통가죽`)
                   (KakaoTalk_261106_114055_11.jpg, 114055_21.jpg, 261108_120000_01.jpeg)
               ------------------------------------------------------------ */}
            {/* 1) Iconic Hanging Natural Tan Whole Cowhide Leather Pelt (`통가죽 쉐이프`, `Z = -1.78`)
                   Traced directly from KakaoTalk_261106_114055_11.jpg & 261108_120000_01.jpeg:
                   - Gently sagging catenary top curve suspended by 2 thin wires from ceiling picture rail
                   - Organic curved left flank, rounded bottom belly, right-side vertical strap slits & hanging outer strips */}
            <group
              position={[-4.38, 2.04, -1.78]}
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
              {/* 2 Thin Ceiling Picture-Rail Hanging Wires + Metal Clamps at Top Corners */}
              {[-0.64, 0.72].map((wz, wIdx) => (
                <group key={`hide-wire-${wIdx}`} position={[0.015, 0, wz]}>
                  <mesh position={[0, 0.96, 0]}>
                    <cylinderGeometry args={[0.003, 0.003, 0.88, 6]} />
                    <meshBasicMaterial color="#94a3b8" />
                  </mesh>
                  <mesh position={[0.012, 0.53, 0]}>
                    <boxGeometry args={[0.025, 0.045, 0.035]} />
                    <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
                  </mesh>
                </group>
              ))}

              {/* Extruded Organic Whole Cowhide Silhouette (`THREE.Shape` in Z-Y plane rotated to face +X) */}
              {(() => {
                const hideShape = new THREE.Shape();
                // Start at top-left clamp (x = +0.66 corresponds to Z = -1.12, y = +0.54)
                hideShape.moveTo(0.66, 0.54);
                // Gently sagging catenary top edge across to top-right clamp (x = -0.74, y = +0.54)
                hideShape.bezierCurveTo(0.22, 0.44, -0.26, 0.43, -0.74, 0.54);
                // Top-right shoulder & neck edge
                hideShape.bezierCurveTo(-0.82, 0.46, -0.84, 0.22, -0.81, -0.02);
                // Right-most hanging outer leather strip #1 (dangles down to y = -0.74)
                hideShape.lineTo(-0.82, -0.74);
                hideShape.bezierCurveTo(-0.80, -0.78, -0.76, -0.78, -0.75, -0.73);
                // Deep vertical strap-cutout slit #1 going up to y = +0.18
                hideShape.lineTo(-0.74, 0.18);
                hideShape.lineTo(-0.71, 0.18);
                // Second hanging leather strip #2 (dangles down to y = -0.68)
                hideShape.lineTo(-0.72, -0.68);
                hideShape.bezierCurveTo(-0.70, -0.72, -0.66, -0.71, -0.65, -0.66);
                // Deep vertical strap-cutout slit #2 going up to y = +0.20
                hideShape.lineTo(-0.64, 0.20);
                hideShape.lineTo(-0.60, 0.20);
                // Inner right edge of main cowhide body stepping down with natural hide contour
                hideShape.bezierCurveTo(-0.58, -0.05, -0.57, -0.32, -0.55, -0.56);
                // Small square-ish notch near lower-right flank
                hideShape.lineTo(-0.46, -0.56);
                hideShape.bezierCurveTo(-0.42, -0.64, -0.24, -0.69, 0.04, -0.67);
                // Rounded bottom belly & lower-left leg tab
                hideShape.bezierCurveTo(0.32, -0.65, 0.56, -0.59, 0.72, -0.49);
                // Lower-left leg protrusion & concave flank curve up to top-left clamp
                hideShape.bezierCurveTo(0.79, -0.44, 0.77, -0.28, 0.69, -0.14);
                hideShape.bezierCurveTo(0.61, 0.02, 0.62, 0.28, 0.66, 0.54);

                return (
                  <group rotation={[0, Math.PI / 2, 0]}>
                    {/* Soft Dark-Brown Cast Shadow Behind Hide on Wall */}
                    <mesh position={[-0.015, -0.02, -0.005]}>
                      <shapeGeometry args={[hideShape]} />
                      <meshBasicMaterial color="#78350f" transparent opacity={0.32} />
                    </mesh>

                    {/* Main Extruded Natural Vegetable-Tanned Cowhide Pelt (`통가죽`) */}
                    <mesh castShadow receiveShadow>
                      <extrudeGeometry
                        args={[
                          hideShape,
                          {
                            depth: 0.018,
                            bevelEnabled: true,
                            bevelThickness: 0.006,
                            bevelSize: 0.006,
                            bevelSegments: 2,
                          },
                        ]}
                      />
                      <meshStandardMaterial
                        color="#c85a1e"
                        roughness={0.58}
                        metalness={0.05}
                      />
                    </mesh>

                    {/* Subtle Warm Center Hide Highlight (Simulating Track-Light Glow on Smooth Grain Leather) */}
                    <mesh position={[0.04, -0.04, 0.025]} scale={[0.78, 0.76, 1]}>
                      <shapeGeometry args={[hideShape]} />
                      <meshStandardMaterial
                        color="#d96b27"
                        roughness={0.52}
                        transparent
                        opacity={0.55}
                      />
                    </mesh>
                  </group>
                );
              })()}

              {hoveredStoryId === 'story_leather_workshop' && (
                <Html position={[0.2, 0, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-md bg-[#c85a28] px-2.5 py-1 text-xs font-medium text-white shadow-md">
                    🧵 [클릭 / E] 책방 속 가죽공방 ‘딤프치’ 이야기 (통가죽 & 작업대)
                  </div>
                </Html>
              )}
            </group>

            {/* 2) White-Framed Aerial Cherry-Blossom City Photograph (`Z = -3.45`) */}
            <group position={[-4.38, 1.92, -3.45]}>
              <mesh castShadow>
                <boxGeometry args={[0.04, 0.98, 1.22]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.4} />
              </mesh>
              <mesh position={[0.024, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[1.06, 0.82]} />
                <meshStandardMaterial color="#d8b4c8" roughness={0.5} />
              </mesh>
            </group>

            {/* 3) Vibrant Sunflower Oil Painting Canvas (`해바라기 유화`, `Z = -4.52`, 120002_91.jpeg) */}
            <group position={[-4.38, 1.88, -4.52]}>
              <mesh castShadow>
                <boxGeometry args={[0.04, 0.72, 0.62]} />
                <meshStandardMaterial color="#d97706" roughness={0.55} />
              </mesh>
              <mesh position={[0.023, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.54, 0.64]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
              {/* Golden Sunflower Blooms in Center */}
              {[-0.12, 0, 0.12].map((sz, sIdx) => (
                <mesh
                  key={`sunflower-${sIdx}`}
                  position={[0.025, (sIdx % 2) * 0.08, sz]}
                  rotation={[0, Math.PI / 2, 0]}
                >
                  <circleGeometry args={[0.095, 14]} />
                  <meshBasicMaterial color="#f59e0b" />
                </mesh>
              ))}
            </group>

            {/* 4) Iconic 3x3 Van Gogh Parody Character Fabric Tapestry (`9칸 패러디 캐릭터 패브릭 포스터`, `Z = -5.42`, 120002_101.jpeg)
                   (Naruto, Mickey, Matilda, AstroBoy, VanGogh, Trump, HarryPotter, Mario, Ultraman with bandaged ears!) */}
            <group
              position={[-4.38, 1.86, -5.42]}
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
              {/* Cream Fabric Backing */}
              <mesh castShadow>
                <boxGeometry args={[0.025, 0.92, 0.82]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.85} />
              </mesh>
              {/* 3x3 Colorful Character Portrait Grid with White Ear Bandages */}
              {[
                [0.28, 0.24, '#38bdf8', '#facc15'],
                [0.28, 0, '#fde047', '#dc2626'],
                [0.28, -0.24, '#2dd4bf', '#7f1d1d'],
                [0, 0.24, '#4ade80', '#18181b'],
                [0, 0, '#60a5fa', '#ea580c'],
                [0, -0.24, '#1e3a8a', '#fde047'],
                [-0.28, 0.24, '#facc15', '#7f1d1d'],
                [-0.28, 0, '#38bdf8', '#dc2626'],
                [-0.28, -0.24, '#f472b6', '#e2e8f0'],
              ].map(([gy, gz, bgCol, charCol], gIdx) => (
                <group key={`vg-cell-${gIdx}`} position={[0.015, Number(gy), Number(gz)]}>
                  <mesh rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[0.22, 0.25]} />
                    <meshBasicMaterial color={String(bgCol)} />
                  </mesh>
                  <mesh position={[0.002, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <circleGeometry args={[0.068, 12]} />
                    <meshBasicMaterial color={String(charCol)} />
                  </mesh>
                  <mesh position={[0.004, -0.01, -0.042]} rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[0.028, 0.055]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                </group>
              ))}
            </group>

            {/* ------------------------------------------------------------
                B. WEST WALL CREDENZA LEDGE, LEANING FRAMES & APPLIANCES
                   (KakaoTalk_261106_114055_11.jpg, 114055_21.jpg, 261108_120000_01.jpeg)
               ------------------------------------------------------------ */}
            <group position={[-4.05, 0, 0]}>
              {/* Long Wooden Back Credenza / Storage Cabinet Running Behind Leather Workbench (`Z = -0.35 .. -3.85`) */}
              <mesh position={[-0.08, 0.37, -2.1]} castShadow receiveShadow>
                <boxGeometry args={[0.48, 0.74, 3.5]} />
                <meshStandardMaterial color="#5c3a1e" roughness={0.72} />
              </mesh>

              {/* 1) Yellow & Black DEWALT Shop Vacuum + Tall Brown Box right behind Middle Bookcase (`Z = -0.48`, 114055_11.jpg) */}
              <group position={[0.02, 0.74, -0.48]}>
                <mesh position={[0, 0.21, 0]} castShadow>
                  <cylinderGeometry args={[0.14, 0.14, 0.38, 14]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.42, 0]}>
                  <cylinderGeometry args={[0.145, 0.145, 0.09, 14]} />
                  <meshStandardMaterial color="#18181b" roughness={0.5} />
                </mesh>
                {/* Tall Cardboard Box behind Vacuum */}
                <mesh position={[-0.14, 0.38, 0.06]} castShadow>
                  <boxGeometry args={[0.22, 0.76, 0.26]} />
                  <meshStandardMaterial color="#b48a5a" roughness={0.78} />
                </mesh>
              </group>

              {/* 2) Leaning Black-Framed Monochrome Winter Tree Illustration (`Z = -0.75`, 114055_11.jpg) */}
              <group position={[-0.12, 1.02, -0.75]} rotation={[0, 0.08, -0.08]}>
                <mesh castShadow>
                  <boxGeometry args={[0.03, 0.56, 0.44]} />
                  <meshStandardMaterial color="#18181b" roughness={0.4} />
                </mesh>
                <mesh position={[0.018, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.38, 0.5]} />
                  <meshBasicMaterial color="#e2e8f0" />
                </mesh>
              </group>

              {/* 3) Cream-Framed Art Poster + Brown Leather Briefcase Leaning Below Whole Cowhide (`Z = -1.28`, 114055_21.jpg) */}
              <group position={[-0.1, 0.98, -1.28]} rotation={[0, 0.04, -0.07]}>
                <mesh castShadow>
                  <boxGeometry args={[0.03, 0.48, 0.56]} />
                  <meshStandardMaterial color="#d6c7b2" roughness={0.5} />
                </mesh>
                <mesh position={[0.018, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.46, 0.38]} />
                  <meshBasicMaterial color="#f8fafc" />
                </mesh>
                {/* Brown Leather Portfolio / Briefcase in front of frame */}
                <mesh position={[0.06, -0.06, -0.05]} castShadow>
                  <boxGeometry args={[0.06, 0.34, 0.42]} />
                  <meshStandardMaterial color="#6b3410" roughness={0.55} />
                </mesh>
              </group>

              {/* 4) Large Dark-Framed Bookstore Night Reflection Photo Leaning on Back Ledge (`Z = -1.88`, 114055_21.jpg) */}
              <group position={[-0.1, 1.05, -1.88]} rotation={[0, 0, -0.08]}>
                <mesh castShadow>
                  <boxGeometry args={[0.035, 0.62, 0.78]} />
                  <meshStandardMaterial color="#27272a" roughness={0.45} />
                </mesh>
                <mesh position={[0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.68, 0.52]} />
                  <meshStandardMaterial color="#334155" roughness={0.35} />
                </mesh>
                {/* Warm Interior Reflection Accent inside Frame */}
                <mesh position={[0.022, 0.02, -0.06]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.42, 0.32]} />
                  <meshBasicMaterial color="#b45309" />
                </mesh>
              </group>

              {/* 5) 2 Thick Multi-Layer Stacks of Silver-Foil Insulation / Leather Backing Mats (`은박 단열/보강재 매트 묶음`, `Z = -2.72 & -3.48`, 120000_01.jpeg) */}
              {[-2.72, -3.48].map((sz, sIdx) => (
                <group key={`foil-stack-${sIdx}`} position={[-0.04, 0.94, sz]}>
                  {Array.from({ length: 8 }).map((_, lIdx) => (
                    <mesh
                      key={`foil-layer-${lIdx}`}
                      position={[0, lIdx * 0.045, (lIdx % 2) * 0.015]}
                      castShadow
                    >
                      <boxGeometry args={[0.38, 0.038, 0.68]} />
                      <meshStandardMaterial
                        color={lIdx % 2 === 0 ? '#cbd5e1' : '#94a3b8'}
                        metalness={0.65}
                        roughness={0.35}
                      />
                    </mesh>
                  ))}
                </group>
              ))}
              {/* White Paper Roll Tube resting on top of Second Silver Mat Stack (`120000_01.jpeg`) */}
              <mesh position={[0.02, 1.34, -3.42]} rotation={[0.12, 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.045, 0.72, 12]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.4} />
              </mesh>

              {/* Black Wine Cooler with Oval Mirror on Top (`Z = -4.08`, 120004_201.jpeg) */}
              <group position={[0.02, 0, -4.08]}>
                <mesh position={[0, 0.42, 0]} castShadow>
                  <boxGeometry args={[0.46, 0.84, 0.42]} />
                  <meshStandardMaterial color="#18181b" roughness={0.3} metalness={0.4} />
                </mesh>
                {/* Oval Wood-Framed Mirror on Wine Cooler */}
                <mesh position={[-0.05, 1.04, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <circleGeometry args={[0.18, 20]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
                </mesh>
              </group>

              {/* Retro Bright-Red 'cooing' Mini Fridge (`Z = -4.56`, 120002_91.jpeg) */}
              <group position={[0.04, 0, -4.56]}>
                <mesh position={[0, 0.44, 0]} castShadow>
                  <boxGeometry args={[0.48, 0.88, 0.46]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.28} metalness={0.2} />
                </mesh>
                <mesh position={[0.245, 0.62, 0.14]}>
                  <boxGeometry args={[0.02, 0.03, 0.12]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.85} />
                </mesh>
              </group>

              {/* White Brother Printer & Black Drawer Unit on Yellow DEWALT Box (`Z = -5.02`, 120004_211.jpeg) */}
              <group position={[0.05, 0, -5.02]}>
                <mesh position={[0, 0.16, 0]} castShadow>
                  <boxGeometry args={[0.42, 0.32, 0.38]} />
                  <meshStandardMaterial color="#eab308" roughness={0.45} />
                </mesh>
                <mesh position={[0, 0.48, 0]} castShadow>
                  <boxGeometry args={[0.4, 0.32, 0.36]} />
                  <meshStandardMaterial color="#18181b" roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.72, 0]} castShadow>
                  <boxGeometry args={[0.38, 0.16, 0.34]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.35} />
                </mesh>
              </group>

              {/* 2-Column Wooden Shelf under Van Gogh Tapestry (`Z = -5.52`, 120002_101.jpeg) */}
              <group position={[0.04, 0, -5.52]}>
                <mesh position={[0, 0.56, 0]} castShadow>
                  <boxGeometry args={[0.42, 1.12, 0.54]} />
                  <meshStandardMaterial color="#7c4a21" roughness={0.7} />
                </mesh>
                <mesh position={[0.04, 1.2, 0.12]} castShadow>
                  <cylinderGeometry args={[0.065, 0.08, 0.16, 14]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                <mesh position={[0.04, 1.22, -0.12]} castShadow>
                  <cylinderGeometry args={[0.055, 0.06, 0.2, 12]} />
                  <meshStandardMaterial color="#18181b" roughness={0.4} />
                </mesh>
                <group position={[0.12, 0.88, 0.1]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.14, 0.09, 0.15]} />
                    <meshStandardMaterial color="#09090b" roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 0.065, 0]}>
                    <boxGeometry args={[0.06, 0.035, 0.18]} />
                    <meshStandardMaterial color="#09090b" roughness={0.3} />
                  </mesh>
                </group>
              </group>
            </group>

            {/* ------------------------------------------------------------
                C. BACK-LEFT: DIMPCHI LEATHER CRAFT WORKBENCH EXTENDED TO
                   MIDDLE ROOM-DIVIDER BOOKCASE (`Z = -0.35 .. -3.08`)
                   (KakaoTalk_261106_114055_11.jpg, 114055_21.jpg, 261108_120000_01.jpeg)
               ------------------------------------------------------------ */}
            <group
              position={[-3.02, 0, -1.72]}
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
              {/* Extended Leather Craft Workbench Wooden Tabletop (`Z = -0.35 .. -3.08`, length 2.74m, flush with middle bookcase!) */}
              <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.56, 0.055, 2.74]} />
                <meshStandardMaterial color="#5c3818" roughness={0.68} />
              </mesh>
              {/* Tempered Glass Worktop Surface with Vintage Banknotes/Prints Underneath (`114055_11.jpg`) */}
              <mesh position={[0.04, 0.811, 0]} receiveShadow>
                <boxGeometry args={[1.44, 0.008, 2.62]} />
                <meshStandardMaterial
                  color="#cbd5e1"
                  transparent
                  opacity={0.28}
                  roughness={0.15}
                  metalness={0.2}
                />
              </mesh>
              {/* Vintage Banknotes & Collectible Prints Tucked Under Front Glass Edge */}
              {Array.from({ length: 12 }).map((_, bIdx) => (
                <mesh
                  key={`glass-note-${bIdx}`}
                  position={[0.56 - (bIdx % 2) * 0.09, 0.809, 1.12 - bIdx * 0.19]}
                  rotation={[-Math.PI / 2, 0, ((bIdx % 3) - 1) * 0.06]}
                >
                  <planeGeometry args={[0.075, 0.14]} />
                  <meshBasicMaterial
                    color={
                      bIdx % 3 === 0
                        ? '#dcfce7'
                        : bIdx % 3 === 1
                        ? '#fef3c7'
                        : '#e0e7ff'
                    }
                  />
                </mesh>
              ))}

              {/* Under-Table Storage Carcass (2 Large Cubby Bays Facing East `+X`) */}
              <mesh position={[-0.04, 0.38, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.44, 0.72, 2.64]} />
                <meshStandardMaterial color="#3b2314" roughness={0.82} />
              </mesh>
              {/* Dark Interior Cavity on East Side (`+X`) so Rolled Hides & Silver-Cap Tubes Stand Out */}
              <mesh position={[0.69, 0.38, 0]}>
                <boxGeometry args={[0.04, 0.64, 2.52]} />
                <meshBasicMaterial color="#140c06" />
              </mesh>
              {/* Center Vertical Divider Between Left Bay (Rolled Leather Hides) & Right Bay (Cylindrical Tubes) */}
              <mesh position={[0.45, 0.38, 0.02]}>
                <boxGeometry args={[0.52, 0.68, 0.045]} />
                <meshStandardMaterial color="#4a2c18" roughness={0.75} />
              </mesh>

              {/* Left Under-Shelf Bay (`Z_world = -0.45 .. -1.65`, right against middle bookcase):
                  Dense Rack of 28 Rolled Leather Hides (`돌돌 말린 통가죽/가죽 원단 롤들`, 114055_21.jpg) */}
              {[1.14, 0.98, 0.82, 0.66, 0.5, 0.34, 0.18].map((tz, rIdx) =>
                [0.14, 0.28, 0.43, 0.58].map((ty, cIdx) => {
                  const rollColors = [
                    '#d97706',
                    '#7c2d12',
                    '#b45309',
                    '#1e3a8a',
                    '#991b1b',
                    '#d6c4a8',
                    '#451a03',
                    '#ca8a04',
                  ];
                  const col = rollColors[(rIdx * 4 + cIdx) % rollColors.length];
                  return (
                    <group
                      key={`leather-roll-${rIdx}-${cIdx}`}
                      position={[0.46, ty + ((rIdx + cIdx) % 2) * 0.015, tz]}
                      rotation={[0, ((rIdx - cIdx) % 3) * 0.04, Math.PI / 2]}
                    >
                      <mesh castShadow>
                        <cylinderGeometry args={[0.062, 0.062, 0.56, 12]} />
                        <meshStandardMaterial color={col} roughness={0.6} />
                      </mesh>
                      {/* Dark Inner Core of Rolled Hide */}
                      <mesh position={[0, -0.282, 0]}>
                        <cylinderGeometry args={[0.028, 0.028, 0.01, 10]} />
                        <meshBasicMaterial color="#1c1917" />
                      </mesh>
                    </group>
                  );
                })
              )}

              {/* Right Under-Shelf Bay (`Z_world = -1.80 .. -2.98`):
                  28 Round Leather Storage Tubes with Shiny Silver Metal Lids & Labels (`원통형 지관통`, 120000_01.jpeg) */}
              {[-0.14, -0.3, -0.46, -0.62, -0.78, -0.94, -1.1].map((tz, rIdx) =>
                [0.14, 0.28, 0.43, 0.58].map((ty, cIdx) => (
                  <group
                    key={`silver-tube-${rIdx}-${cIdx}`}
                    position={[0.48, ty, tz]}
                    rotation={[0, 0, Math.PI / 2]}
                  >
                    <mesh castShadow>
                      <cylinderGeometry args={[0.064, 0.064, 0.52, 14]} />
                      <meshStandardMaterial color="#44403c" roughness={0.6} />
                    </mesh>
                    {/* Shiny Silver Metal End Cap Facing Outward (`+X`) */}
                    <mesh position={[0, -0.262, 0]}>
                      <cylinderGeometry args={[0.066, 0.066, 0.018, 14]} />
                      <meshStandardMaterial
                        color="#e2e8f0"
                        metalness={0.85}
                        roughness={0.2}
                      />
                    </mesh>
                    {/* Small Yellow / Red Index Sticker on Silver Lid */}
                    <mesh position={[0, -0.272, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                      <planeGeometry args={[0.045, 0.028]} />
                      <meshBasicMaterial
                        color={(rIdx + cIdx) % 3 === 0 ? '#facc15' : '#f8fafc'}
                      />
                    </mesh>
                  </group>
                ))
              )}

              {/* 'TRIPLE 82' Cardboard Box on Floor in Front of Workbench (`120000_01.jpeg`) */}
              <group position={[0.92, 0.21, -0.42]} rotation={[0, 0.08, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.38, 0.42, 0.48]} />
                  <meshStandardMaterial color="#c29b61" roughness={0.78} />
                </mesh>
                {/* 'TRIPLE' Dark Label Strip */}
                <mesh position={[0.192, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[0.28, 0.07]} />
                  <meshBasicMaterial color="#27272a" />
                </mesh>
              </group>

              {/* ============================================================
                  DETAILED LEATHER CRAFT TOOLS, SWATCHES & PROPS ON WORKBENCH
                  (KakaoTalk_261106_114055_11.jpg, 114055_21.jpg, 261108_120000_01.jpeg)
                 ============================================================ */}

              {/* 1) SOUTH END (Near Middle Bookcase, local z = +0.55 .. +1.22):
                  Open Pattern Books, Leather Wallet Templates, Pink-Handled Scissors, Mallet & Steel Ruler */}
              {/* Stack of Leather Craft Pattern Books & Magazines */}
              <mesh position={[-0.32, 0.835, 1.02]} rotation={[0, 0.12, 0]} castShadow>
                <boxGeometry args={[0.34, 0.045, 0.26]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
              </mesh>
              <mesh position={[-0.28, 0.87, 0.98]} rotation={[0, -0.08, 0]} castShadow>
                <boxGeometry args={[0.28, 0.03, 0.22]} />
                <meshStandardMaterial color="#1e293b" roughness={0.5} />
              </mesh>
              {/* Long Silver Stainless Steel Ruler (`60cm 철자`) + Black L-Square Ruler (`직각자`) */}
              <mesh position={[0.22, 0.818, 0.88]} rotation={[0, 0.35, 0]}>
                <boxGeometry args={[0.58, 0.004, 0.045]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
              </mesh>
              <mesh position={[0.38, 0.819, 0.56]} rotation={[0, -0.2, 0]}>
                <boxGeometry args={[0.32, 0.005, 0.038]} />
                <meshStandardMaterial color="#18181b" roughness={0.4} />
              </mesh>
              {/* Pink-Handled Leather Craft Shears / Scissors (`분홍 손잡이 가죽 가위`, 114055_11.jpg) */}
              <group position={[0.12, 0.822, 0.72]} rotation={[0, 0.65, 0]}>
                <mesh position={[-0.04, 0, 0]}>
                  <boxGeometry args={[0.09, 0.01, 0.055]} />
                  <meshStandardMaterial color="#ec4899" roughness={0.4} />
                </mesh>
                <mesh position={[0.05, 0, 0]}>
                  <boxGeometry args={[0.1, 0.005, 0.025]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
                </mesh>
              </group>
              {/* Wooden & Brass Leather Carving Mallet (`가죽 타공 망치`) */}
              <group position={[-0.08, 0.835, 0.64]} rotation={[0, -0.4, Math.PI / 2]}>
                <mesh>
                  <cylinderGeometry args={[0.014, 0.012, 0.22, 10]} />
                  <meshStandardMaterial color="#8c5828" />
                </mesh>
                <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.034, 0.034, 0.075, 14]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
              </group>

              {/* 2) CENTER WORK ZONE (local z = -0.35 .. +0.50):
                  Rich Layered Spread of Cut Leather Swatches, Straps, Pricking Irons, Rotary Cutter & Tool Cups */}
              {[
                // [lx, lz, w, d, rotY, color]
                [0.08, 0.28, 0.46, 0.34, 0.18, '#b45309'], // Warm Caramel Hide Piece
                [-0.18, 0.14, 0.38, 0.28, -0.24, '#7c2d12'], // Deep Chestnut Cut Piece
                [0.26, 0.02, 0.42, 0.26, 0.42, '#ea580c'], // Bright Orange-Tan Swatch
                [-0.06, -0.14, 0.52, 0.32, -0.12, '#d97706'], // Natural Vegetable Tan Sheet
                [0.18, -0.28, 0.34, 0.22, 0.3, '#991b1b'], // Oxblood Red Leather Piece
                [-0.32, -0.04, 0.28, 0.38, 0.08, '#f5f5f4'], // White Paper Pattern Template
                [0.36, 0.34, 0.22, 0.16, -0.35, '#1e3a8a'], // Navy Pocket Pattern Swatch
                [-0.22, 0.42, 0.32, 0.22, 0.28, '#a16207'], // Mustard Tan Leather Cutout
              ].map(([lx, lz, w, d, rotY, col], swIdx) => (
                <mesh
                  key={`workbench-swatch-${swIdx}`}
                  position={[Number(lx), 0.818 + swIdx * 0.003, Number(lz)]}
                  rotation={[0, Number(rotY), 0]}
                  castShadow
                >
                  <boxGeometry args={[Number(w), 0.008, Number(d)]} />
                  <meshStandardMaterial color={String(col)} roughness={0.62} />
                </mesh>
              ))}

              {/* Long Cut Leather Belt Straps draped across Center of Workbench */}
              {[-0.05, 0.04, 0.12].map((sz, stIdx) => (
                <mesh
                  key={`belt-strap-${stIdx}`}
                  position={[0.14, 0.845, sz]}
                  rotation={[0, 0.22 - stIdx * 0.14, 0]}
                >
                  <boxGeometry args={[0.68, 0.006, 0.032]} />
                  <meshStandardMaterial
                    color={stIdx === 1 ? '#78350f' : '#c2410c'}
                    roughness={0.55}
                  />
                </mesh>
              ))}

              {/* Blue Plastic Crate with Leather Strips & Tools + Sky-Blue Spray Bottle (`114055_21.jpg`) */}
              <group position={[-0.34, 0.88, 0.22]}>
                <mesh castShadow>
                  <boxGeometry args={[0.34, 0.13, 0.28]} />
                  <meshStandardMaterial color="#2563eb" roughness={0.45} />
                </mesh>
                {/* Rolled Tan Leather Strips inside Blue Crate */}
                {[-0.06, 0.04].map((rx, rIdx) => (
                  <mesh key={rIdx} position={[rx, 0.08, 0]} rotation={[0.2, 0, 0]}>
                    <cylinderGeometry args={[0.045, 0.045, 0.18, 10]} />
                    <meshStandardMaterial color="#b45309" />
                  </mesh>
                ))}
              </group>
              {/* Sky-Blue Trigger Spray Bottle (`분무기`) */}
              <group position={[-0.08, 0.91, 0.08]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.036, 0.042, 0.19, 12]} />
                  <meshStandardMaterial color="#38bdf8" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.11, 0.015]}>
                  <boxGeometry args={[0.03, 0.045, 0.07]} />
                  <meshStandardMaterial color="#f8fafc" />
                </mesh>
              </group>

              {/* Tall Cylindrical Tan Leather Tool Holders + Tokonole Jars + Yellow/Black Cordless Tool (`114055_21.jpg`) */}
              <mesh position={[-0.38, 0.93, -0.28]} castShadow>
                <cylinderGeometry args={[0.055, 0.055, 0.24, 14]} />
                <meshStandardMaterial color="#b47b44" roughness={0.55} />
              </mesh>
              <mesh position={[-0.24, 0.9, -0.34]} castShadow>
                <cylinderGeometry args={[0.048, 0.048, 0.18, 14]} />
                <meshStandardMaterial color="#9a5b25" roughness={0.55} />
              </mesh>
              {/* Glass Jars of Tokonole / Leather Dye */}
              {[-0.08, 0.04].map((jz, jIdx) => (
                <group key={`dye-jar-${jIdx}`} position={[-0.36, 0.86, jz]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.038, 0.038, 0.09, 12]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.25} />
                  </mesh>
                  <mesh position={[0, 0.05, 0]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
                    <meshStandardMaterial color="#18181b" />
                  </mesh>
                </group>
              ))}
              {/* Yellow & Black DEWALT Cordless Drill / Burnisher Standing on Workbench */}
              <group position={[0.02, 0.9, -0.42]} rotation={[0, 0.4, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.07, 0.16, 0.09]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
                <mesh position={[0, -0.06, 0]}>
                  <boxGeometry args={[0.075, 0.05, 0.1]} />
                  <meshStandardMaterial color="#18181b" />
                </mesh>
              </group>

              {/* 3) NORTH END (local z = -0.55 .. -1.25):
                  LEGO 10214 Tower Bridge Box, Framed Winter Card, Red/Green Christmas Cards,
                  Black Vintage Lantern, Awls/Skiving Knives, and 'UK' Wooden Stitching Pony Clamp */}
              {/* LEGO 10214 Tower Bridge Box */}
              <mesh position={[-0.42, 1.01, -0.88]} rotation={[0, 0.12, 0]} castShadow>
                <boxGeometry args={[0.46, 0.38, 0.18]} />
                <meshStandardMaterial color="#0284c7" roughness={0.45} />
              </mesh>
              {/* Framed Winter Scene & Red/Green Christmas Cards */}
              <mesh position={[-0.14, 0.93, -0.96]} rotation={[0, 0.22, 0]} castShadow>
                <boxGeometry args={[0.26, 0.24, 0.03]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
              <mesh position={[0.12, 0.87, -0.92]} rotation={[0, -0.2, 0]}>
                <boxGeometry args={[0.14, 0.12, 0.02]} />
                <meshBasicMaterial color="#dc2626" />
              </mesh>
              <mesh position={[0.26, 0.87, -0.86]} rotation={[0, -0.3, 0]}>
                <boxGeometry args={[0.14, 0.12, 0.02]} />
                <meshBasicMaterial color="#15803d" />
              </mesh>
              {/* Black Vintage Lantern */}
              <mesh position={[0.28, 0.92, -0.58]} castShadow>
                <cylinderGeometry args={[0.055, 0.065, 0.22, 10]} />
                <meshStandardMaterial color="#18181b" metalness={0.5} />
              </mesh>
              {/* Yellow Rotary Cutter & Wooden-Handled Skiving Knives on Cutting Mat */}
              <mesh position={[0.34, 0.822, -0.22]} rotation={[0, 0.5, 0]}>
                <boxGeometry args={[0.16, 0.012, 0.035]} />
                <meshStandardMaterial color="#facc15" />
              </mesh>
              <mesh position={[0.42, 0.822, -0.36]} rotation={[0, -0.35, 0]}>
                <boxGeometry args={[0.15, 0.014, 0.028]} />
                <meshStandardMaterial color="#9a3412" />
              </mesh>

              {/* Wooden Stitching Pony Clamp ('UK' Sticker) Clamped to Front-Right Edge + Hanging Orange Umbrella (`120000_01.jpeg`) */}
              <group position={[0.68, 0.82, -1.02]}>
                {/* Curved Twin Wooden Jaws of Stitching Pony */}
                <mesh position={[0, 0.19, 0]} rotation={[0, 0, -0.14]} castShadow>
                  <boxGeometry args={[0.12, 0.4, 0.16]} />
                  <meshStandardMaterial color="#b48456" roughness={0.62} />
                </mesh>
                {/* 'UK' Oval Sticker on Stitching Pony */}
                <mesh position={[0.062, 0.22, 0]} rotation={[0, Math.PI / 2, -0.14]}>
                  <circleGeometry args={[0.038, 12]} />
                  <meshBasicMaterial color="#fef08a" />
                </mesh>
                {/* Hanging Orange Umbrella Hooked Below Clamp */}
                <mesh position={[0.12, -0.28, -0.05]} rotation={[0, 0, 0.08]}>
                  <cylinderGeometry args={[0.024, 0.015, 0.68, 10]} />
                  <meshStandardMaterial color="#ea580c" roughness={0.48} />
                </mesh>
              </group>
            </group>

            {/* Wheeled Industrial Leather Skiving / Sewing Machine Table Right Next to Workbench (`[-2.52, 0, -3.52]`, 120002_81.jpeg) */}
            <group position={[-2.52, 0, -3.52]}>
              {/* Wooden Tabletop */}
              <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.92, 0.045, 0.68]} />
                <meshStandardMaterial color="#8c5828" roughness={0.65} />
              </mesh>
              {/* White Steel H-Frame Legs & Foot Pedal */}
              {[-0.38, 0.38].map((lx, lIdx) => (
                <mesh key={`sew-leg-${lIdx}`} position={[lx, 0.37, 0]} castShadow>
                  <boxGeometry args={[0.045, 0.74, 0.58]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
                </mesh>
              ))}
              <mesh position={[0.08, 0.12, 0]} rotation={[0.25, 0, 0]}>
                <boxGeometry args={[0.32, 0.025, 0.24]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              {/* Industrial Grey/Black Leather Sewing & Skiving Machine Head */}
              <group position={[0.08, 0.76, 0]}>
                <mesh position={[0, 0.14, 0]} castShadow>
                  <boxGeometry args={[0.42, 0.28, 0.24]} />
                  <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.4} />
                </mesh>
                <mesh position={[-0.18, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.05, 14]} />
                  <meshStandardMaterial color="#18181b" />
                </mesh>
              </group>
              {/* 2 Handcrafted Beige Leather Bags Hanging on Side Stool (120002_81.jpeg) */}
              <group position={[-0.62, 0, 0.05]}>
                <mesh position={[0, 0.32, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.32, 0.34]} />
                  <meshStandardMaterial color="#d6c4a8" roughness={0.55} />
                </mesh>
                <mesh position={[0.06, 0.28, 0.22]} castShadow>
                  <boxGeometry args={[0.22, 0.26, 0.28]} />
                  <meshStandardMaterial color="#cbb28c" roughness={0.55} />
                </mesh>
              </group>
            </group>

            {/* ------------------------------------------------------------
                D. CENTER-BACK: PERSONAL STUDY & LARGE WALNUT TABLE
                   WITH 4 GREEN-SOCKED WINDSOR CHAIRS & OVERHEAD BAR LIGHT
                   (KakaoTalk_261108_120002_101.jpeg, 120003_111.jpeg, 120005_251.jpeg)
               ------------------------------------------------------------ */}
            <group position={[-0.85, 0, -3.55]}>
              {/* Overhead Linear Black Bar Pendant Light + Vintage Yellow-Glow Dome Pendant */}
              <group position={[0, 2.55, 0]}>
                {/* Linear Black Bar Light */}
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.06, 0.05, 1.35]} />
                  <meshStandardMaterial color="#18181b" roughness={0.4} />
                </mesh>
                <mesh position={[0, -0.028, 0]}>
                  <boxGeometry args={[0.04, 0.01, 1.28]} />
                  <meshBasicMaterial color="#fef08a" />
                </mesh>
                {[-0.48, 0.48].map((cz, cIdx) => (
                  <mesh key={`cord-${cIdx}`} position={[0, 0.45, cz]}>
                    <cylinderGeometry args={[0.004, 0.004, 0.9, 6]} />
                    <meshBasicMaterial color="#27272a" />
                  </mesh>
                ))}
                {/* Warm Vintage Dome Pendant Light beside Bar Light */}
                <group position={[-0.85, 0.12, 0.45]}>
                  <mesh position={[0, 0.38, 0]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.76, 6]} />
                    <meshBasicMaterial color="#27272a" />
                  </mesh>
                  <mesh>
                    <coneGeometry args={[0.19, 0.14, 16]} />
                    <meshStandardMaterial color="#b45309" metalness={0.5} roughness={0.35} />
                  </mesh>
                  <mesh position={[0, -0.06, 0]}>
                    <sphereGeometry args={[0.05, 10, 10]} />
                    <meshBasicMaterial color="#fde047" />
                  </mesh>
                </group>
              </group>

              {/* Large Dark Walnut Study Tabletop & Black Steel Legs */}
              <group
                onClick={(e) => {
                  e.stopPropagation();
                  const st = SPACE_STORIES.find(
                    (s) => s.id === 'story_personal_study'
                  );
                  if (st) onSelectStory(st);
                  else onSelectTable(workbench);
                }}
                onPointerOver={() => {
                  setHoveredTableId(workbench.id);
                  setHoveredStoryId('story_personal_study');
                }}
                onPointerOut={() => {
                  setHoveredTableId(null);
                  setHoveredStoryId(null);
                }}
              >
                <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.48, 0.055, 2.25]} />
                  <meshStandardMaterial color="#5c3818" roughness={0.62} />
                </mesh>
                {[
                  [-0.66, 0.38, -1.02],
                  [0.66, 0.38, -1.02],
                  [-0.66, 0.38, 1.02],
                  [0.66, 0.38, 1.02],
                ].map(([lx, ly, lz], idx) => (
                  <mesh key={`study-leg-${idx}`} position={[lx, ly, lz]} castShadow>
                    <boxGeometry args={[0.055, 0.76, 0.055]} />
                    <meshStandardMaterial color="#18181b" />
                  </mesh>
                ))}

                {/* Personal Study Tabletop Items (120003_111.jpeg, 120005_251.jpeg):
                    1) Large Black Samsung Monitor (North-West side) + Laptop on Stand
                    2) Burgundy Leather Desk Mat + Blue Pad + Retro Calculator
                    3) 3 Black Zippo Fuel Cans + Orange Phone Stand + Snack Bowl
                    4) Sticker-Covered Black ThinkPad Laptop + White Wet-Wipes Pack + Korean Snacks ('전병') */}
                {/* 1) Large Black Samsung Monitor & Stand */}
                <group position={[-0.22, 0.79, -0.68]} rotation={[0, 0.12, 0]}>
                  <mesh position={[0, 0.24, 0]} castShadow>
                    <boxGeometry args={[0.68, 0.4, 0.035]} />
                    <meshStandardMaterial color="#18181b" roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 0.24, 0.02]}>
                    <planeGeometry args={[0.63, 0.35]} />
                    <meshStandardMaterial
                      color="#1e293b"
                      emissive="#0f172a"
                      emissiveIntensity={0.4}
                    />
                  </mesh>
                  <mesh position={[0, 0.06, -0.04]}>
                    <boxGeometry args={[0.06, 0.12, 0.06]} />
                    <meshStandardMaterial color="#27272a" />
                  </mesh>
                </group>

                {/* Primary Laptop on Angled Stand next to Monitor */}
                <group position={[0.32, 0.82, -0.62]} rotation={[0, -0.25, 0]}>
                  <mesh position={[0, 0.04, 0]} rotation={[0.25, 0, 0]} castShadow>
                    <boxGeometry args={[0.32, 0.015, 0.22]} />
                    <meshStandardMaterial color="#334155" />
                  </mesh>
                  <mesh position={[0, 0.16, -0.09]} rotation={[-0.2, 0, 0]} castShadow>
                    <boxGeometry args={[0.32, 0.21, 0.012]} />
                    <meshStandardMaterial color="#18181b" />
                  </mesh>
                </group>

                {/* 2) Burgundy Leather Desk Mat & Blue Pad in Center */}
                <mesh position={[-0.08, 0.79, -0.18]}>
                  <boxGeometry args={[0.68, 0.006, 0.42]} />
                  <meshStandardMaterial color="#6b1d2f" roughness={0.65} />
                </mesh>
                <mesh position={[0.28, 0.792, -0.12]}>
                  <boxGeometry args={[0.28, 0.006, 0.24]} />
                  <meshStandardMaterial color="#2563eb" roughness={0.6} />
                </mesh>

                {/* Retro Mechanical Calculator & Orange Phone Stand */}
                <mesh position={[-0.36, 0.81, -0.12]} rotation={[0, 0.2, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.035, 0.2]} />
                  <meshStandardMaterial color="#d6d3cd" roughness={0.5} />
                </mesh>
                <mesh position={[0.12, 0.83, -0.22]} rotation={[0, -0.3, 0]}>
                  <boxGeometry args={[0.07, 0.08, 0.07]} />
                  <meshStandardMaterial color="#ea580c" />
                </mesh>

                {/* 3 Black Zippo Fuel Cans (`지포 캔 3개`, 120003_111.jpeg) */}
                {[-0.48, -0.4, -0.32].map((zx, zIdx) => (
                  <mesh
                    key={`zippo-${zIdx}`}
                    position={[zx, 0.85, -0.38]}
                    castShadow
                  >
                    <boxGeometry args={[0.055, 0.12, 0.035]} />
                    <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.3} />
                  </mesh>
                ))}

                {/* 4) Sticker-Covered Black ThinkPad Laptop (`120005_251.jpeg`) */}
                <group position={[-0.26, 0.79, 0.34]} rotation={[0, 0.38, 0]}>
                  <mesh position={[0, 0.01, 0]} castShadow>
                    <boxGeometry args={[0.32, 0.016, 0.22]} />
                    <meshStandardMaterial color="#18181b" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.11, -0.1]} rotation={[-0.25, 0, 0]} castShadow>
                    <boxGeometry args={[0.32, 0.21, 0.012]} />
                    <meshStandardMaterial color="#18181b" roughness={0.4} />
                  </mesh>
                  {/* Colorful Stickers on Back of ThinkPad Lid */}
                  <mesh position={[-0.06, 0.12, -0.108]} rotation={[-0.25, Math.PI, 0]}>
                    <planeGeometry args={[0.06, 0.04]} />
                    <meshBasicMaterial color="#facc15" />
                  </mesh>
                  <mesh position={[0.05, 0.09, -0.108]} rotation={[-0.25, Math.PI, 0]}>
                    <planeGeometry args={[0.05, 0.05]} />
                    <meshBasicMaterial color="#38bdf8" />
                  </mesh>
                </group>

                {/* White Wet-Wipes Pack (`물티슈`), Snack Bowl & Korean Senbei Snacks (`전병 과자`) */}
                <mesh position={[0.24, 0.82, 0.25]} rotation={[0, -0.15, 0]} castShadow>
                  <boxGeometry args={[0.18, 0.06, 0.12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
                <mesh position={[0.02, 0.81, 0.12]} castShadow>
                  <cylinderGeometry args={[0.08, 0.06, 0.045, 14]} />
                  <meshStandardMaterial color="#f59e0b" />
                </mesh>
                <mesh position={[0.18, 0.81, 0.68]} rotation={[0, 0.22, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.045, 0.2]} />
                  <meshStandardMaterial color="#d97706" roughness={0.6} />
                </mesh>

                {hoveredStoryId === 'story_personal_study' && (
                  <Html position={[0, 1.38, 0]} center zIndexRange={[5, 0]}>
                    <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                      책방지기 작업공간 · 편하게 앉아서 책을 보세요
                    </div>
                  </Html>
                )}
              </group>

              {/* 3 Companion Wooden Windsor Spindle-Back Chairs with Cute Green Leg Socks (`초록색 의자 발커버`) */}
              {[
                [-0.86, -0.45, Math.PI / 2],
                [-0.86, 0.45, Math.PI / 2],
                [0.86, -0.52, -Math.PI / 2],
              ].map(([cx, cz, cRot], cIdx) => {
                const isOccupiedByOwner = isOwnerPresent && cIdx === 1;
                return (
                  <group
                    key={`windsor-chair-${cIdx}`}
                    position={[Number(cx), 0, Number(cz)]}
                    rotation={[0, Number(cRot), 0]}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOccupiedByOwner) {
                        onOpenOwnerTalk();
                      } else {
                        onSelectSeat(workshopChair);
                      }
                    }}
                    onPointerOver={() => {
                      if (!isOccupiedByOwner) {
                        setHoveredSeatId(workshopChair.id);
                      }
                    }}
                    onPointerOut={() => setHoveredSeatId(null)}
                  >
                    {/* Contoured Wooden Seat */}
                    <mesh position={[0, 0.44, 0]} castShadow>
                      <boxGeometry args={[0.46, 0.045, 0.46]} />
                      <meshStandardMaterial color="#784721" roughness={0.65} />
                    </mesh>
                    {/* Curved Windsor Top Rail & 5 Spindles */}
                    <mesh position={[0, 0.82, -0.2]} castShadow>
                      <boxGeometry args={[0.48, 0.05, 0.045]} />
                      <meshStandardMaterial color="#6e411c" roughness={0.65} />
                    </mesh>
                    {[-0.16, -0.08, 0, 0.08, 0.16].map((sx, sIdx) => (
                      <mesh key={sIdx} position={[sx, 0.63, -0.2]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.36, 6]} />
                        <meshStandardMaterial color="#784721" />
                      </mesh>
                    ))}
                    {/* 4 Wooden Legs + Signature Bright-Green Knitted Chair Leg Socks (`초록 양말 발커버`)! */}
                    {[
                      [-0.18, -0.18],
                      [0.18, -0.18],
                      [-0.18, 0.18],
                      [0.18, 0.18],
                    ].map(([lx, lz], lIdx) => (
                      <group key={lIdx} position={[lx, 0, lz]}>
                        <mesh position={[0, 0.22, 0]} castShadow>
                          <cylinderGeometry args={[0.018, 0.015, 0.44, 8]} />
                          <meshStandardMaterial color="#6e411c" />
                        </mesh>
                        {/* Cute Green Knitted Leg Sock at Bottom of Each Leg */}
                        <mesh position={[0, 0.055, 0]}>
                          <cylinderGeometry args={[0.024, 0.024, 0.11, 10]} />
                          <meshStandardMaterial color="#16a34a" roughness={0.85} />
                        </mesh>
                      </group>
                    ))}
                  </group>
                );
              })}

              {/* Bookshop Owner (`책방지기`) — Appears on a 5-Minute Cycle for ~30 Seconds */}
              {isOwnerPresent && (
                <BookshopOwner3D
                  position={[-0.85, 0, 0.45]}
                  rotationY={Math.PI / 2}
                  isTalking={isOwnerTalking}
                  selectedQuestionIdx={selectedOwnerQuestionIdx}
                  onTalkClick={onOpenOwnerTalk}
                />
              )}
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

            {/* Interactive 4th Windsor Chair (`seat_workshop_chair`) — Also Wearing Green Leg Socks! */}
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
                <boxGeometry args={[0.48, 0.05, 0.48]} />
                <meshStandardMaterial
                  color={
                    hoveredSeatId === workshopChair.id || isChairActive
                      ? '#9c6334'
                      : '#784721'
                  }
                />
              </mesh>
              <mesh position={[0.21, 0.82, 0]} castShadow>
                <boxGeometry args={[0.045, 0.055, 0.48]} />
                <meshStandardMaterial color="#5c3818" />
              </mesh>
              {[-0.16, -0.08, 0, 0.08, 0.16].map((sz, sIdx) => (
                <mesh key={sIdx} position={[0.21, 0.63, sz]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.36, 6]} />
                  <meshStandardMaterial color="#784721" />
                </mesh>
              ))}
              {[
                [-0.18, -0.18],
                [0.18, -0.18],
                [-0.18, 0.18],
                [0.18, 0.18],
              ].map(([lx, lz], lIdx) => (
                <group key={lIdx} position={[lx, 0, lz]}>
                  <mesh position={[0, 0.22, 0]} castShadow>
                    <cylinderGeometry args={[0.018, 0.015, 0.44, 8]} />
                    <meshStandardMaterial color="#6e411c" />
                  </mesh>
                  <mesh position={[0, 0.055, 0]}>
                    <cylinderGeometry args={[0.024, 0.024, 0.11, 10]} />
                    <meshStandardMaterial color="#16a34a" roughness={0.85} />
                  </mesh>
                </group>
              ))}
              {hoveredSeatId === workshopChair.id && (
                <Html position={[0, 1.05, 0]} center zIndexRange={[5, 0]}>
                  <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                    편하게 앉아서 책 읽기
                  </div>
                </Html>
              )}
            </group>

            {/* ------------------------------------------------------------
                E. NORTH-WEST SINK, WATER HEATER, 2-TIER MUG CUP SHELVES,
                   COFFEE ISLAND COUNTER & CLOVER WATER DISPENSER
                   (KakaoTalk_261108_120003_121.jpeg .. 120004_161.jpeg)
               ------------------------------------------------------------ */}
            <group
              onClick={(e) => {
                e.stopPropagation();
                const st = SPACE_STORIES.find(
                  (s) => s.id === 'story_sink_and_mugs'
                );
                if (st) onSelectStory(st);
              }}
              onPointerOver={() => setHoveredStoryId('story_sink_and_mugs')}
              onPointerOut={() => setHoveredStoryId(null)}
            >
              {/* 1) Overhead White Cylindrical Electric Water Heater (`대성쎌틱 온수기`) & Silver Pipes (120003_121.jpeg) */}
              <group position={[-3.38, 2.52, -6.28]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.24, 0.24, 0.62, 20]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Red/Blue Temperature Dial & Pressure Gauge on Front */}
                <mesh position={[0, -0.08, 0.242]}>
                  <circleGeometry args={[0.045, 14]} />
                  <meshBasicMaterial color="#dc2626" />
                </mesh>
                {/* 2 Silver Flexible Water Pipes Leading Down to Sink */}
                <mesh position={[-0.08, -0.68, 0.05]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.85, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
                </mesh>
                <mesh position={[0.08, -0.68, 0.05]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.85, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
                </mesh>
              </group>

              {/* 2) Small 2-Tier Wood Shelf Left of Sink with 8 Mugs & 2 Wood Cutting Boards (`120003_121.jpeg`) */}
              <group position={[-3.88, 1.18, -6.32]}>
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.52, 0.03, 0.24]} />
                  <meshStandardMaterial color="#854d27" />
                </mesh>
                <mesh position={[0, 0.26, 0]} castShadow>
                  <boxGeometry args={[0.52, 0.03, 0.24]} />
                  <meshStandardMaterial color="#854d27" />
                </mesh>
                {/* 4 Upright Mugs on Top Tier + 4 Upside-Down White Mugs on Bottom Tier */}
                {[-0.18, -0.06, 0.06, 0.18].map((mx, mIdx) => (
                  <React.Fragment key={`left-mug-${mIdx}`}>
                    <mesh position={[mx, 0.32, 0]} castShadow>
                      <cylinderGeometry args={[0.036, 0.034, 0.085, 12]} />
                      <meshStandardMaterial
                        color={mIdx === 1 ? '#eab308' : mIdx === 2 ? '#3b82f6' : '#ffffff'}
                      />
                    </mesh>
                    <mesh position={[mx, 0.055, 0]} castShadow>
                      <cylinderGeometry args={[0.034, 0.036, 0.085, 12]} />
                      <meshStandardMaterial color="#f8fafc" />
                    </mesh>
                  </React.Fragment>
                ))}
                {/* 2 Wooden Cutting Boards Leaning Below */}
                <mesh position={[-0.12, -0.18, 0.04]} rotation={[0, 0, 0.12]}>
                  <boxGeometry args={[0.24, 0.32, 0.025]} />
                  <meshStandardMaterial color="#a67c52" />
                </mesh>
              </group>

              {/* 3) Stainless Steel Sink Cabinet, Gooseneck Faucet, Yellow Towel, Grey Oven Mitt & Steam Pitchers (`120003_121.jpeg`) */}
              <group position={[-2.75, 0, -6.18]}>
                {/* Sink Lower Cabinet & Stainless Top */}
                <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.65, 0.84, 0.64]} />
                  <meshStandardMaterial color="#d6d3cd" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.85, 0]} castShadow>
                  <boxGeometry args={[1.68, 0.04, 0.66]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.75} roughness={0.25} />
                </mesh>
                {/* Dark Recessed Sink Basin */}
                <mesh position={[-0.15, 0.865, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.68, 0.44]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
                </mesh>
                {/* Chrome Gooseneck Faucet (`구스넥 수전`) */}
                <group position={[-0.15, 0.87, -0.22]}>
                  <mesh position={[0, 0.16, 0]}>
                    <cylinderGeometry args={[0.014, 0.018, 0.32, 10]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
                  </mesh>
                  <mesh position={[0, 0.31, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.08, 0.012, 8, 16, Math.PI]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
                  </mesh>
                </group>
                {/* Bright Yellow Hand Towel & Grey Quilted Oven Mitt Hanging on Front of Sink (`노란 손수건 & 회색 오븐장갑`) */}
                <mesh position={[-0.28, 0.58, 0.335]} castShadow>
                  <boxGeometry args={[0.24, 0.34, 0.025]} />
                  <meshStandardMaterial color="#facc15" roughness={0.85} />
                </mesh>
                <mesh position={[0.08, 0.56, 0.335]} rotation={[0, 0, -0.15]} castShadow>
                  <boxGeometry args={[0.16, 0.24, 0.035]} />
                  <meshStandardMaterial color="#64748b" roughness={0.8} />
                </mesh>
                {/* Green Monstera Leaf Mat & Blue 'SWISS MISS' Cocoa Box on Left of Sink */}
                <mesh position={[-0.64, 0.875, 0.08]} rotation={[-Math.PI / 2, 0, 0.2]}>
                  <circleGeometry args={[0.14, 12]} />
                  <meshBasicMaterial color="#15803d" />
                </mesh>
                <mesh position={[-0.68, 0.96, -0.14]} castShadow>
                  <boxGeometry args={[0.18, 0.16, 0.12]} />
                  <meshStandardMaterial color="#0284c7" roughness={0.45} />
                </mesh>
                {/* Right Side Wood Board with 2 Stainless Milk Steaming Pitchers (`스팀 피처`) & Glass Carafe */}
                <mesh position={[0.52, 0.88, 0]} castShadow>
                  <boxGeometry args={[0.48, 0.03, 0.42]} />
                  <meshStandardMaterial color="#8c5828" roughness={0.65} />
                </mesh>
                {[0.38, 0.54].map((px, pIdx) => (
                  <mesh key={`pitcher-${pIdx}`} position={[px, 0.96, 0.04]} castShadow>
                    <cylinderGeometry args={[0.045, 0.052, 0.13, 14]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.88} roughness={0.18} />
                  </mesh>
                ))}
                <mesh position={[0.66, 0.97, -0.05]} castShadow>
                  <cylinderGeometry args={[0.048, 0.055, 0.15, 14]} />
                  <meshStandardMaterial color="#bae6fd" transparent opacity={0.6} />
                </mesh>
              </group>

              {/* 4) Iconic 2-Tier Wooden Mug Cup Wall Shelves (`2단 원목 머그컵 컬렉션 선반`, 120003_131.jpeg, 120003_141.jpeg) */}
              <group position={[-1.85, 1.72, -6.38]}>
                {/* Upper & Lower Wooden Floating Shelves */}
                <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.95, 0.035, 0.26]} />
                  <meshStandardMaterial color="#854d27" roughness={0.68} />
                </mesh>
                <mesh position={[0, 0, 0]} castShadow receiveShadow>
                  <boxGeometry args={[1.95, 0.035, 0.26]} />
                  <meshStandardMaterial color="#854d27" roughness={0.68} />
                </mesh>

                {/* Top Shelf Mugs (Left to Right):
                    White 'JAPAN' Mug, 2 Stacked Red Christmas Mugs, White/Green Patterned Mugs,
                    2 Clear Glass Cups, Yellow 'LEGOLAND' Mug, Red Mug & Upside-Down Teacups on Saucers */}
                {[
                  [-0.82, 0.41, '#ffffff', 0.095], // 'JAPAN' Tall Mug
                  [-0.64, 0.4, '#dc2626', 0.08], // Red Christmas Mug Bottom
                  [-0.64, 0.485, '#b91c1c', 0.08], // Red Christmas Mug Stacked Top
                  [-0.46, 0.4, '#fef3c7', 0.085], // Cream Patterned Mug
                  [-0.3, 0.4, '#dcfce7', 0.085], // Mint/Green Mug
                  [-0.14, 0.4, '#e0f2fe', 0.09], // Clear Glass Mug 1
                  [0.02, 0.4, '#e0f2fe', 0.09], // Clear Glass Mug 2
                  [0.2, 0.41, '#facc15', 0.092], // Yellow 'LEGOLAND' Mug
                  [0.38, 0.4, '#ef4444', 0.085], // Bright Red Mug
                  [0.56, 0.39, '#f8fafc', 0.07], // Teacup & Saucer 1
                  [0.76, 0.39, '#fffbeb', 0.07], // Teacup & Saucer 2
                ].map(([mx, my, mCol, mh], mIdx) => (
                  <group key={`top-mug-${mIdx}`} position={[Number(mx), Number(my), 0.02]}>
                    <mesh castShadow>
                      <cylinderGeometry args={[0.042, 0.038, Number(mh), 14]} />
                      <meshStandardMaterial color={String(mCol)} roughness={0.3} />
                    </mesh>
                    {/* Mug Handle */}
                    <mesh position={[0.044, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                      <torusGeometry args={[0.022, 0.006, 6, 12, Math.PI]} />
                      <meshStandardMaterial color={String(mCol)} roughness={0.3} />
                    </mesh>
                  </group>
                ))}

                {/* Bottom Shelf Mugs (Left to Right):
                    Stacked Ceramic Bowls, Mint Mug, Pastel Pink Mug, Orange Mug, Sky-Blue Mug,
                    Navy Mug, Floral Teacups & Saucers */}
                {[
                  [-0.8, 0.06, '#e2e8f0', 0.08],
                  [-0.62, 0.06, '#6ee7b7', 0.088], // Mint Mug
                  [-0.45, 0.06, '#f9a8d4', 0.088], // Pastel Pink Mug
                  [-0.28, 0.06, '#fb923c', 0.088], // Warm Orange Mug
                  [-0.11, 0.06, '#38bdf8', 0.088], // Sky-Blue Mug
                  [0.06, 0.06, '#ffffff', 0.09], // White Mug
                  [0.23, 0.06, '#1e3a8a', 0.088], // Deep Navy Mug
                  [0.42, 0.055, '#fef3c7', 0.075], // Floral Teacup 1
                  [0.6, 0.055, '#fce7f3', 0.075], // Floral Teacup 2
                  [0.78, 0.055, '#f8fafc', 0.075], // White Teacup 3
                ].map(([mx, my, mCol, mh], mIdx) => (
                  <group key={`bot-mug-${mIdx}`} position={[Number(mx), Number(my), 0.02]}>
                    <mesh castShadow>
                      <cylinderGeometry args={[0.042, 0.038, Number(mh), 14]} />
                      <meshStandardMaterial color={String(mCol)} roughness={0.3} />
                    </mesh>
                    <mesh position={[0.044, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                      <torusGeometry args={[0.022, 0.006, 6, 12, Math.PI]} />
                      <meshStandardMaterial color={String(mCol)} roughness={0.3} />
                    </mesh>
                  </group>
                ))}
              </group>

              {/* 5) Wall-Mounted White Samsung Air Conditioner & Electrical Panel Box (`120003_131.jpeg`, `120003_181.jpeg`) */}
              <group position={[-1.05, 2.58, -6.42]}>
                <mesh castShadow>
                  <boxGeometry args={[0.88, 0.28, 0.22]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.1, 0.112]}>
                  <planeGeometry args={[0.82, 0.04]} />
                  <meshBasicMaterial color="#cbd5e1" />
                </mesh>
              </group>
              {/* Grey Electrical Panel Box with Purple Sticker (Right of AC, above Sunset Photo) */}
              <group position={[0.15, 2.38, -6.48]}>
                <mesh>
                  <boxGeometry args={[0.52, 0.58, 0.06]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.5} />
                </mesh>
                <mesh position={[0.08, 0.06, 0.032]}>
                  <planeGeometry args={[0.22, 0.16]} />
                  <meshBasicMaterial color="#7e22ce" />
                </mesh>
              </group>

              {/* 6) Continuous Coffee Bar & Storage Counter Shelf Extending All the Way from Sink to Clover Water Dispenser
                     (`X = -1.92 .. +1.18`, width `3.10m`, ZERO empty gap next to water dispenser!
                      KakaoTalk_261108_120003_131.jpeg, 120003_141.jpeg, 120004_191.jpeg) */}
              <group position={[-0.37, 0, -5.78]}>
                {/* Continuous Wooden Counter Carcass & Dark Walnut Top (`width = 3.10m`, flush from Sink to Water Dispenser) */}
                <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
                  <boxGeometry args={[3.1, 0.86, 0.88]} />
                  <meshStandardMaterial color="#4a2a14" roughness={0.7} />
                </mesh>
                <mesh position={[0, 0.87, 0]} castShadow receiveShadow>
                  <boxGeometry args={[3.14, 0.035, 0.91]} />
                  <meshStandardMaterial color="#3b200e" roughness={0.62} />
                </mesh>

                {/* Continuous Mustard-Yellow Pleated Fabric Curtain Skirt Covering the Entire Front (`노란 패브릭 커튼`, 22 pleats) */}
                {Array.from({ length: 22 }).map((_, cIdx) => {
                  const cx = -1.47 + cIdx * 0.14;
                  return (
                    <mesh
                      key={`mustard-curtain-${cIdx}`}
                      position={[cx, 0.42, 0.445 + (cIdx % 2 === 0 ? 0.006 : -0.006)]}
                      castShadow
                    >
                      <boxGeometry args={[0.138, 0.81, 0.018]} />
                      <meshStandardMaterial
                        color={cIdx % 2 === 0 ? '#eab308' : '#ca8a04'}
                        roughness={0.88}
                      />
                    </mesh>
                  );
                })}

                {/* ============================================================
                    LEFT COUNTER ZONE (Next to Sink, local x = -1.45 .. -0.72):
                    4-Tier Cup Dispenser, 2-Tier White Wire Coffee Rack, KANU,
                    Hanging Measuring Spoons, Coffee Bean Jar & Red 'Baoshan' Box
                    (KakaoTalk_261108_120003_131.jpeg, 120003_141.jpeg)
                   ============================================================ */}
                {/* 4-Tier Vertical Cup Dispenser (`4단 원통 컵 디스펜서`) */}
                <group position={[-1.4, 0.89, -0.18]}>
                  {[0.06, 0.16, 0.26, 0.36].map((cy, cupIdx) => (
                    <mesh
                      key={`cup-disp-${cupIdx}`}
                      position={[0, cy, 0]}
                      rotation={[Math.PI / 2, 0, 0]}
                      castShadow
                    >
                      <cylinderGeometry args={[0.044, 0.044, 0.18, 12]} />
                      <meshStandardMaterial
                        color={
                          cupIdx === 0
                            ? '#0f766e'
                            : cupIdx === 1
                            ? '#f8fafc'
                            : cupIdx === 2
                            ? '#18181b'
                            : '#94a3b8'
                        }
                        roughness={0.35}
                      />
                    </mesh>
                  ))}
                </group>

                {/* 2-Tier White Wire Coffee & Filter Rack (`2단 흰색 철제 선반`, 120003_141.jpeg) */}
                <group position={[-1.06, 0.89, -0.14]}>
                  {/* Wire Frame Side Posts & 2 White Basket Shelves */}
                  {[-0.22, 0.22].map((wx, wIdx) => (
                    <mesh key={`wire-post-${wIdx}`} position={[wx, 0.22, 0]} castShadow>
                      <boxGeometry args={[0.015, 0.44, 0.26]} />
                      <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                    </mesh>
                  ))}
                  {[0.12, 0.32].map((wy, wIdx) => (
                    <mesh key={`wire-tray-${wIdx}`} position={[0, wy, 0]} castShadow>
                      <boxGeometry args={[0.44, 0.05, 0.26]} />
                      <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                    </mesh>
                  ))}
                  {/* Black 'KANU' Coffee Box & Paper Drip Filter Pack on Top Tier */}
                  <mesh position={[-0.12, 0.42, -0.04]} castShadow>
                    <boxGeometry args={[0.08, 0.18, 0.08]} />
                    <meshStandardMaterial color="#0f172a" />
                  </mesh>
                  <mesh position={[-0.02, 0.39, 0.02]} castShadow>
                    <boxGeometry args={[0.16, 0.12, 0.1]} />
                    <meshStandardMaterial color="#e2e8f0" />
                  </mesh>
                  {/* 2 Hanging Coffee Measuring Spoons (`구리/검은색 계량 스푼 2개`) on Front Rail */}
                  <mesh position={[0.06, 0.29, 0.14]} rotation={[0, 0, -0.05]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.16, 8]} />
                    <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.2} />
                  </mesh>
                  <mesh position={[0.06, 0.21, 0.145]}>
                    <sphereGeometry args={[0.022, 10, 10]} />
                    <meshStandardMaterial color="#b45309" metalness={0.8} roughness={0.2} />
                  </mesh>
                  <mesh position={[0.14, 0.29, 0.14]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.15, 8]} />
                    <meshStandardMaterial color="#18181b" />
                  </mesh>
                  <mesh position={[0.14, 0.21, 0.145]}>
                    <sphereGeometry args={[0.02, 10, 10]} />
                    <meshStandardMaterial color="#18181b" />
                  </mesh>
                </group>

                {/* In Front of Wire Rack: Large Coffee Bean Jar, Red 'Baoshan China' Box & Orange Cup */}
                <group position={[-1.02, 0.89, 0.18]}>
                  {/* Clear Jar Filled with Dark Roasted Coffee Beans & White Lid */}
                  <mesh position={[0, 0.09, -0.02]} castShadow>
                    <cylinderGeometry args={[0.085, 0.085, 0.17, 14]} />
                    <meshStandardMaterial color="#451a03" roughness={0.45} />
                  </mesh>
                  <mesh position={[0, 0.18, -0.02]}>
                    <cylinderGeometry args={[0.075, 0.075, 0.025, 14]} />
                    <meshStandardMaterial color="#f8fafc" />
                  </mesh>
                  {/* Red 'Baoshan China' Box in Front */}
                  <mesh position={[-0.04, 0.06, 0.12]} castShadow>
                    <boxGeometry args={[0.14, 0.12, 0.08]} />
                    <meshStandardMaterial color="#dc2626" roughness={0.4} />
                  </mesh>
                  {/* Orange Cup & White Drip Bag Packets on Left */}
                  <mesh position={[-0.34, 0.07, 0.02]} castShadow>
                    <cylinderGeometry args={[0.052, 0.042, 0.13, 12]} />
                    <meshStandardMaterial color="#ea580c" roughness={0.35} />
                  </mesh>
                  <mesh position={[-0.2, 0.06, 0.06]} castShadow>
                    <boxGeometry args={[0.1, 0.12, 0.06]} />
                    <meshStandardMaterial color="#f8fafc" />
                  </mesh>
                </group>

                {/* ============================================================
                    CENTER COUNTER ZONE (local x = -0.68 .. +0.35):
                    White Microwave Oven, Wooden Tea Organizer Box on Top
                    (TWININGS, TWG, Banana Card, Ampoules, Figurines), and
                    2 Pink '커피삼사 (COFFEE COMPANY)' 1kg Bean Bags in Front
                    (KakaoTalk_261108_120003_141.jpeg)
                   ============================================================ */}
                {/* White Microwave Oven */}
                <group position={[-0.24, 1.04, -0.08]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.58, 0.31, 0.38]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.28} />
                  </mesh>
                  {/* Dark Microwave Door Window */}
                  <mesh position={[-0.06, -0.01, 0.192]}>
                    <planeGeometry args={[0.32, 0.2]} />
                    <meshBasicMaterial color="#0f172a" />
                  </mesh>
                  {/* Wooden Tea & Coffee Organizer Box on Top of Microwave (`120003_141.jpeg`) */}
                  <group position={[0, 0.19, 0.02]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.48, 0.07, 0.26]} />
                      <meshStandardMaterial color="#784721" roughness={0.68} />
                    </mesh>
                    {/* Orange TWININGS Tea Box */}
                    <mesh position={[-0.16, 0.06, 0.02]} castShadow>
                      <boxGeometry args={[0.09, 0.08, 0.07]} />
                      <meshStandardMaterial color="#ea580c" />
                    </mesh>
                    {/* Yellow Banana Postcard */}
                    <mesh position={[-0.04, 0.07, 0.01]}>
                      <boxGeometry args={[0.11, 0.1, 0.015]} />
                      <meshBasicMaterial color="#fef08a" />
                    </mesh>
                    {/* Silver & Red TWG Tea Tins at Back */}
                    <mesh position={[-0.02, 0.09, -0.07]} castShadow>
                      <cylinderGeometry args={[0.032, 0.032, 0.13, 12]} />
                      <meshStandardMaterial color="#94a3b8" metalness={0.6} />
                    </mesh>
                    <mesh position={[0.06, 0.09, -0.07]} castShadow>
                      <cylinderGeometry args={[0.032, 0.032, 0.13, 12]} />
                      <meshStandardMaterial color="#b91c1c" roughness={0.35} />
                    </mesh>
                    {/* Sky-Blue '코앤텍' Box & 3 Red Ampoule Bottles */}
                    <mesh position={[0.09, 0.07, 0.04]} castShadow>
                      <boxGeometry args={[0.075, 0.11, 0.06]} />
                      <meshStandardMaterial color="#bae6fd" />
                    </mesh>
                    {[-0.02, 0.01, 0.04].map((ax, aIdx) => (
                      <mesh key={`ampoule-${aIdx}`} position={[ax, 0.06, 0.08]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.07, 8]} />
                        <meshStandardMaterial color="#dc2626" />
                      </mesh>
                    ))}
                    {/* Orange Round Tin & Cute White/Black Cat Figurines on Right */}
                    <mesh position={[0.18, 0.06, 0.01]} castShadow>
                      <cylinderGeometry args={[0.038, 0.038, 0.08, 12]} />
                      <meshStandardMaterial color="#f97316" />
                    </mesh>
                    <mesh position={[0.19, 0.05, 0.09]}>
                      <capsuleGeometry args={[0.014, 0.025, 6, 8]} />
                      <meshStandardMaterial color="#ffffff" />
                    </mesh>
                  </group>
                </group>

                {/* Honey/Jam Jars & 2 Standing Pastel-Pink '커피삼사 (COFFEE COMPANY)' 1kg Bean Bags (`120003_141.jpeg`) */}
                {/* Glass Jam Jar with Blue Cloth Cover */}
                <group position={[-0.58, 0.96, 0.18]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.048, 0.048, 0.12, 12]} />
                    <meshStandardMaterial color="#451a03" roughness={0.3} />
                  </mesh>
                  <mesh position={[0, 0.065, 0]}>
                    <boxGeometry args={[0.11, 0.02, 0.11]} />
                    <meshStandardMaterial color="#1d4ed8" roughness={0.8} />
                  </mesh>
                </group>
                {/* 2 Pink '커피삼사' 1kg Coffee Bean Bags (Front & Slightly Behind) */}
                {[
                  [-0.22, 1.03, 0.16, 0.04],
                  [-0.14, 1.02, 0.24, -0.05],
                ].map(([bx, by, bz, bRot], bIdx) => (
                  <group
                    key={`coffee-bag-${bIdx}`}
                    position={[Number(bx), Number(by), Number(bz)]}
                    rotation={[0, Number(bRot), 0]}
                  >
                    <mesh castShadow>
                      <boxGeometry args={[0.19, 0.28, 0.1]} />
                      <meshStandardMaterial color="#f9a8d4" roughness={0.42} />
                    </mesh>
                    {/* Blue Side Gusset Trim */}
                    <mesh position={[0.096, 0, 0]}>
                      <boxGeometry args={[0.006, 0.27, 0.095]} />
                      <meshBasicMaterial color="#1d4ed8" />
                    </mesh>
                    {/* White Barista Illustration & '커피삼사' Label */}
                    <mesh position={[0, 0.01, 0.052]}>
                      <planeGeometry args={[0.13, 0.14]} />
                      <meshBasicMaterial color="#fdf2f8" />
                    </mesh>
                    <mesh position={[0, -0.09, 0.053]}>
                      <planeGeometry args={[0.11, 0.03]} />
                      <meshBasicMaterial color="#ffffff" />
                    </mesh>
                  </group>
                ))}

                {/* ============================================================
                    RIGHT COUNTER ZONE (local x = +0.15 .. +1.48, ALL THE WAY TO WATER DISPENSER):
                    White Circulator Fan, Pink Kleenex Box, Mint Tissue Cylinder,
                    Bag of Orange Tangerines/Persimmons, Tea & Storage Boxes
                    (KakaoTalk_261108_120003_141.jpeg, 120004_191.jpeg)
                   ============================================================ */}
                {/* White Round Air Circulator Fan (`흰색 서큘레이터`) & White Appliance Box at Back */}
                <group position={[0.38, 1.01, -0.12]} rotation={[0, -0.25, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.13, 0.11, 0.16, 16]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.35} />
                  </mesh>
                  <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.11, 16]} />
                    <meshBasicMaterial color="#cbd5e1" />
                  </mesh>
                </group>
                {/* Pastel-Pink Kleenex Tissue Box (`핑크색 각티슈`) */}
                <mesh position={[0.16, 0.94, 0.14]} rotation={[0, -0.15, 0]} castShadow>
                  <boxGeometry args={[0.14, 0.09, 0.22]} />
                  <meshStandardMaterial color="#fbcfe8" roughness={0.5} />
                </mesh>
                {/* Tall Mint-Green Cylindrical Tissue Case (`민트색 원통 티슈통`) + Small Jar on Top */}
                <group position={[0.32, 0.99, 0.2]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.058, 0.058, 0.2, 14]} />
                    <meshStandardMaterial color="#6ee7b7" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0.125, 0]} castShadow>
                    <cylinderGeometry args={[0.036, 0.036, 0.055, 12]} />
                    <meshStandardMaterial color="#fef3c7" roughness={0.3} />
                  </mesh>
                </group>

                {/* White Basket & Clear Bag Packed with Bright Orange Tangerines / Persimmons (`귤·단감 바구니`, 120004_191.jpeg) */}
                <group position={[0.68, 0.93, 0.08]}>
                  {/* White Tray / Bowl Under Fruit Bag */}
                  <mesh position={[0, 0.01, 0]} castShadow>
                    <cylinderGeometry args={[0.18, 0.14, 0.07, 16]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.4} />
                  </mesh>
                  {/* Cluster of 9 Bright Orange Tangerines / Persimmons */}
                  {[
                    [-0.07, 0.05, -0.04],
                    [0.01, 0.05, -0.05],
                    [0.08, 0.05, -0.02],
                    [-0.08, 0.05, 0.04],
                    [0, 0.06, 0.03],
                    [0.07, 0.05, 0.05],
                    [-0.03, 0.09, -0.01],
                    [0.04, 0.09, 0.01],
                    [0, 0.05, 0.09],
                  ].map(([ox, oy, oz], oIdx) => (
                    <mesh key={`persimmon-${oIdx}`} position={[ox, oy, oz]} castShadow>
                      <sphereGeometry args={[0.044, 10, 10]} />
                      <meshStandardMaterial
                        color={oIdx % 2 === 0 ? '#ea580c' : '#f97316'}
                        roughness={0.38}
                      />
                    </mesh>
                  ))}
                </group>

                {/* Right-Most Shelf Corner Items (Right up against the Clover Water Dispenser, local x = +1.05 .. +1.42):
                    White Ceramic Pitcher/Kettle, Paper Cup Sleeve Stack, Tea Caddy & Organizer Box */}
                <group position={[1.18, 0.89, 0.04]}>
                  {/* Beige/Brown Storage Organizer Box at Back-Right Corner */}
                  <mesh position={[0.04, 0.09, -0.14]} castShadow>
                    <boxGeometry args={[0.36, 0.18, 0.26]} />
                    <meshStandardMaterial color="#d6c7b2" roughness={0.6} />
                  </mesh>
                  {/* White Ceramic Dispenser / Tea Caddy & Stacked Paper Cups */}
                  <mesh position={[-0.08, 0.11, 0.08]} castShadow>
                    <cylinderGeometry args={[0.065, 0.065, 0.22, 14]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                  </mesh>
                  <mesh position={[0.1, 0.08, 0.1]} castShadow>
                    <cylinderGeometry args={[0.042, 0.036, 0.16, 12]} />
                    <meshStandardMaterial color="#fde68a" roughness={0.5} />
                  </mesh>
                  <mesh position={[0.21, 0.07, 0.06]} castShadow>
                    <boxGeometry args={[0.12, 0.14, 0.16]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
                  </mesh>
                </group>

                {/* Wall-Mounted Multi-Tap Power Strip & Black Power Cords Above Right Side of Counter (`120004_191.jpeg`) */}
                <group position={[0.88, 1.38, -0.41]} rotation={[0, 0, -0.35]}>
                  <mesh>
                    <boxGeometry args={[0.28, 0.055, 0.035]} />
                    <meshStandardMaterial color="#f8fafc" />
                  </mesh>
                  <mesh position={[-0.12, -0.22, 0.01]} rotation={[0, 0, 0.45]}>
                    <cylinderGeometry args={[0.008, 0.008, 0.42, 6]} />
                    <meshBasicMaterial color="#18181b" />
                  </mesh>
                </group>
              </group>

              {/* 7) White 'clover' Water Dispenser with Blue Water Jug & Glowing Yellow Duck Lamp on Top
                     (`position={[1.35, 0, -5.72]}`, flush right against the right end of the counter shelf with ZERO gap!
                      KakaoTalk_261108_120004_191.jpeg) */}
              <group position={[1.35, 0, -5.72]}>
                {/* White Clover Water Dispenser Body (Left face X = 1.18 touches Counter right face X = 1.18!) */}
                <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.34, 0.96, 0.36]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Recessed Dispensing Niche + Red & Blue Hot/Cold Taps */}
                <mesh position={[0, 0.68, 0.181]}>
                  <planeGeometry args={[0.22, 0.22]} />
                  <meshBasicMaterial color="#e2e8f0" />
                </mesh>
                <mesh position={[-0.05, 0.73, 0.185]}>
                  <boxGeometry args={[0.025, 0.04, 0.02]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0.05, 0.73, 0.185]}>
                  <boxGeometry args={[0.025, 0.04, 0.02]} />
                  <meshBasicMaterial color="#3b82f6" />
                </mesh>
                {/* Inverted Sky-Blue 18.9L Water Carboy Jug on Top */}
                <mesh position={[0, 1.16, 0]} castShadow>
                  <cylinderGeometry args={[0.135, 0.135, 0.38, 16]} />
                  <meshStandardMaterial
                    color="#38bdf8"
                    transparent
                    opacity={0.68}
                    roughness={0.15}
                  />
                </mesh>
                {/* Cute Glowing Yellow Mini Duck Lamp Sitting right on Top of the Water Jug! (`120004_191.jpeg`) */}
                <mesh position={[0, 1.4, 0]} castShadow>
                  <sphereGeometry args={[0.055, 12, 12]} />
                  <meshStandardMaterial
                    color="#fde047"
                    emissive="#facc15"
                    emissiveIntensity={0.65}
                  />
                </mesh>
                {/* Yellow Box Stacked on Clear Spare Water Jug Right in Front of Dispenser & Counter Corner (`120004_191.jpeg`) */}
                <mesh position={[-0.06, 0.54, 0.34]} castShadow>
                  <boxGeometry args={[0.21, 0.3, 0.21]} />
                  <meshStandardMaterial color="#eab308" roughness={0.5} />
                </mesh>
                <mesh position={[-0.06, 0.19, 0.36]} castShadow>
                  <cylinderGeometry args={[0.135, 0.135, 0.38, 14]} />
                  <meshStandardMaterial
                    color="#bae6fd"
                    transparent
                    opacity={0.55}
                    roughness={0.2}
                  />
                </mesh>
              </group>

              {/* Framed Sunset Cloud Photograph & Wall Remotes Directly Above Water Dispenser (`120004_191.jpeg`) */}
              <group position={[1.28, 1.82, -6.48]}>
                <mesh>
                  <boxGeometry args={[0.48, 0.34, 0.03]} />
                  <meshStandardMaterial color="#f8fafc" />
                </mesh>
                <mesh position={[0, 0, 0.018]}>
                  <planeGeometry args={[0.42, 0.28]} />
                  <meshBasicMaterial color="#fb923c" />
                </mesh>
                {/* AC Remote Holder & Light Switch to the Right of Water Jug */}
                <mesh position={[0.28, -0.48, 0.01]}>
                  <boxGeometry args={[0.05, 0.12, 0.02]} />
                  <meshStandardMaterial color="#f8fafc" />
                </mesh>
                <mesh position={[0.36, -0.48, 0.01]}>
                  <boxGeometry args={[0.05, 0.12, 0.02]} />
                  <meshStandardMaterial color="#f8fafc" />
                </mesh>
              </group>
              {/* Open Dark Storage Room Doorway at the FAR RIGHT of the Back Wall (`X = 2.65, Z = -6.52`, right next to the East-Wall Concrete-Block Shelf!) */}
              <group position={[2.65, 1.15, -6.52]}>
                <mesh>
                  <boxGeometry args={[0.96, 2.3, 0.08]} />
                  <meshStandardMaterial color="#4a2a14" />
                </mesh>
                <mesh position={[0, -0.04, 0.042]}>
                  <planeGeometry args={[0.84, 2.18]} />
                  <meshBasicMaterial color="#09090b" />
                </mesh>
              </group>

              {hoveredStoryId === 'story_sink_and_mugs' && (
                <>
                  <Html position={[-1.85, 2.25, -5.85]} center zIndexRange={[5, 0]}>
                    <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                      싱크대와 컵은 책방지기 외 사용 불가 · 정수기는 사용 가능
                    </div>
                  </Html>
                  <Html position={[1.35, 1.65, -5.72]} center zIndexRange={[5, 0]}>
                    <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                      정수기 사용 가능
                    </div>
                  </Html>
                </>
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
                <div className="pointer-events-none whitespace-nowrap rounded-[4px] bg-black/45 px-2.5 py-1 text-xs text-white/95 backdrop-blur-md shadow-sm">
                  {wp.label}
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
