import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GENRE_SHELVES,
  REPRESENTATIVE_BOOKS,
  SEAT_OBJECTS,
  SPACE_STORIES,
  TABLE_OBJECTS,
} from '../data/bookstoreData';
import {
  ActivePromptType,
  BookItem,
  CharacterActionState,
  GenreShelfData,
} from '../types';
import {
  computeSafeCameraPosition,
  resolveCharacterMovement,
} from '../systems/collisionAndNav';

function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngleShortest(current: number, target: number, t: number): number {
  const diff = normalizeAngle(target - current);
  return normalizeAngle(current + diff * t);
}

// Smooth angle step with a strict maximum angular speed (rad/s) so large turns never whip or jerk the camera
function stepAngleSmoothCapped(
  current: number,
  target: number,
  Responsiveness: number,
  maxSpeedRadPerSec: number,
  dt: number
): number {
  const diff = normalizeAngle(target - current);
  const desiredDelta = diff * Math.min(1, dt * Responsiveness);
  const maxStep = maxSpeedRadPerSec * dt;
  const clampedDelta = Math.max(-maxStep, Math.min(maxStep, desiredDelta));
  return normalizeAngle(current + clampedDelta);
}

interface SceneControllerProps {
  positionRef: React.MutableRefObject<[number, number, number]>;
  rotationYRef: React.MutableRefObject<number>;
  cameraYawRef: React.MutableRefObject<number>;
  cameraPitchRef: React.MutableRefObject<number>;
  cameraDistanceRef: React.MutableRefObject<number>;
  joystickVectorRef: React.MutableRefObject<{ x: number; y: number }>;
  navPathRef: React.MutableRefObject<Array<[number, number]>>;
  pendingArrivalRef: React.MutableRefObject<(() => void) | null>;
  interactionProgressRef: React.MutableRefObject<number>;
  actionState: CharacterActionState;
  isSeated: boolean;
  heldBook: BookItem | null;
  onSyncCharacterPos: (pos: [number, number, number]) => void;
  onSyncCameraDistance: (dist: number) => void;
  onEnteredStore: () => void;
  onActionStateChange: (next: CharacterActionState) => void;
  onStandUp: () => void;
  onClearNavVisuals: () => void;
  onUpdateActiveShelf: (shelf: GenreShelfData | null) => void;
  onUpdateNearbyBookId: (bookId: string | null) => void;
  onUpdateActivePrompt: (prompt: ActivePromptType | null) => void;
}

export const SceneController: React.FC<SceneControllerProps> = ({
  positionRef,
  rotationYRef,
  cameraYawRef,
  cameraPitchRef,
  cameraDistanceRef,
  joystickVectorRef,
  navPathRef,
  pendingArrivalRef,
  interactionProgressRef,
  actionState,
  isSeated,
  heldBook,
  onSyncCharacterPos,
  onSyncCameraDistance,
  onEnteredStore,
  onActionStateChange,
  onStandUp,
  onClearNavVisuals,
  onUpdateActiveShelf,
  onUpdateNearbyBookId,
  onUpdateActivePrompt,
}) => {
  const { camera, gl } = useThree();

  const keysPressedRef = useRef<Set<string>>(new Set());
  const lastKeyComboRef = useRef<string>('');
  const movementBaseYawRef = useRef<number>(0);

  // Pointer drag state with 6px deadzone so normal clicks never jerk the camera
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const pointerDownStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const manualLookHoldTimerRef = useRef<number>(0);

  // Damped yaw/pitch targets for gentle mouse look
  const targetCameraYawRef = useRef<number>(cameraYawRef.current);
  const targetCameraPitchRef = useRef<number>(cameraPitchRef.current);

  const smoothLookAtRef = useRef(new THREE.Vector3(0.15, 1.15, 7.8));
  const smoothCamPosRef = useRef(new THREE.Vector3(0.15, 2.35, 11.6));
  const proximityTimerRef = useRef(0);
  const posSyncTimerRef = useRef(0);
  const wasOutsideRef = useRef<boolean>(true);

  // Keyboard listeners for WASD & Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const code = e.code;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(code)
      ) {
        keysPressedRef.current.add(code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    const handleBlur = () => {
      keysPressedRef.current.clear();
      lastKeyComboRef.current = '';
      isPointerDownRef.current = false;
      isDraggingRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Mouse drag & wheel with reduced, gentle sensitivity and deadzone
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      pointerDownStartRef.current = { x: e.clientX, y: e.clientY };
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      targetCameraYawRef.current = cameraYawRef.current;
      targetCameraPitchRef.current = cameraPitchRef.current;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current) return;

      const totalDx = e.clientX - pointerDownStartRef.current.x;
      const totalDy = e.clientY - pointerDownStartRef.current.y;

      // Require at least 6px movement before treating as a camera drag
      if (!isDraggingRef.current) {
        if (Math.hypot(totalDx, totalDy) < 6) return;
        isDraggingRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      // Reduced mouse sensitivity (~3.2x gentler than before) so the user can calmly inspect the room
      const MOUSE_YAW_SENSITIVITY = 0.002;
      const MOUSE_PITCH_SENSITIVITY = 0.0016;

      targetCameraYawRef.current = normalizeAngle(
        targetCameraYawRef.current - dx * MOUSE_YAW_SENSITIVITY
      );
      targetCameraPitchRef.current = Math.max(
        0.1,
        Math.min(1.05, targetCameraPitchRef.current + dy * MOUSE_PITCH_SENSITIVITY)
      );

      // Pause automatic camera-behind-character snap for a moment after manual look
      manualLookHoldTimerRef.current = 1.6;
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Gentler wheel zoom speed, strictly capped at 4.2m so zoom-out stays inside the bookstore
      const nextDist = Math.max(
        0.9,
        Math.min(4.2, cameraDistanceRef.current + e.deltaY * 0.0014)
      );
      cameraDistanceRef.current = nextDist;
      onSyncCameraDistance(nextDist);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, cameraYawRef, cameraPitchRef, cameraDistanceRef, onSyncCameraDistance]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    if (manualLookHoldTimerRef.current > 0 && !isDraggingRef.current) {
      manualLookHoldTimerRef.current = Math.max(
        0,
        manualLookHoldTimerRef.current - dt
      );
    }

    // 1. Handle INTERACTING lock state (book pull/return animation)
    if (actionState === 'INTERACTING') {
      interactionProgressRef.current = Math.min(
        1,
        interactionProgressRef.current + dt * 1.85
      );
    } else {
      interactionProgressRef.current = 0;

      // 2. Check Keyboard or Mobile Joystick input
      const keys = keysPressedRef.current;
      let inputForward = 0;
      let inputRight = 0;

      if (keys.has('KeyW') || keys.has('ArrowUp')) inputForward += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) inputForward -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) inputRight += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) inputRight -= 1;

      if (
        Math.abs(joystickVectorRef.current.x) > 0.08 ||
        Math.abs(joystickVectorRef.current.y) > 0.08
      ) {
        inputRight += joystickVectorRef.current.x;
        inputForward += joystickVectorRef.current.y;
      }

      const hasManualInput =
        Math.abs(inputForward) > 0.05 || Math.abs(inputRight) > 0.05;

      if (hasManualInput) {
        if (navPathRef.current.length > 0) {
          navPathRef.current = [];
          pendingArrivalRef.current = null;
          onClearNavVisuals();
        }

        if (isSeated || actionState === 'SITTING' || actionState === 'READING') {
          onStandUp();
        }

        // Latch base camera yaw whenever the directional key combination changes
        const comboKey = `${Math.sign(inputForward)},${Math.sign(inputRight)}`;
        if (comboKey !== lastKeyComboRef.current) {
          lastKeyComboRef.current = comboKey;
          movementBaseYawRef.current = cameraYawRef.current;
        }

        const baseYaw = movementBaseYawRef.current;
        const fwdX = -Math.sin(baseYaw);
        const fwdZ = -Math.cos(baseYaw);
        const rightX = Math.cos(baseYaw);
        const rightZ = -Math.sin(baseYaw);

        let moveX = fwdX * inputForward + rightX * inputRight;
        let moveZ = fwdZ * inputForward + rightZ * inputRight;
        const len = Math.hypot(moveX, moveZ);
        if (len > 0.001) {
          moveX /= len;
          moveZ /= len;
        }

        // Comfortable browsing walk speed (2.2m/s)
        const speed = 2.2;
        const [curX, , curZ] = positionRef.current;
        const desiredX = curX + moveX * speed * dt;
        const desiredZ = curZ + moveZ * speed * dt;

        const [resolvedX, resolvedZ] = resolveCharacterMovement(
          curX,
          curZ,
          desiredX,
          desiredZ
        );

        const stepElevation =
          resolvedZ > 7.45 ? -0.18 : resolvedZ > 7.05 ? -0.09 : 0;

        positionRef.current = [resolvedX, stepElevation, resolvedZ];
        const targetRot = Math.atan2(moveX, moveZ);
        // Smooth, unhurried character body rotation (max 3.2 rad/s)
        rotationYRef.current = stepAngleSmoothCapped(
          rotationYRef.current,
          targetRot,
          5.0,
          3.2,
          dt
        );

        if (actionState !== 'WALKING') {
          onActionStateChange('WALKING');
        }
      } else {
        lastKeyComboRef.current = '';

        if (navPathRef.current.length > 0) {
          if (
            isSeated ||
            actionState === 'SITTING' ||
            actionState === 'READING'
          ) {
            onStandUp();
          }

          const [curX, , curZ] = positionRef.current;
          const [targetX, targetZ] = navPathRef.current[0];
          const dx = targetX - curX;
          const dz = targetZ - curZ;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.14) {
            navPathRef.current.shift();
            const stepElevation =
              targetZ > 7.45 ? -0.18 : targetZ > 7.05 ? -0.09 : 0;
            if (navPathRef.current.length === 0) {
              positionRef.current = [targetX, stepElevation, targetZ];
              onClearNavVisuals();
              if (pendingArrivalRef.current) {
                const fn = pendingArrivalRef.current;
                pendingArrivalRef.current = null;
                fn();
              } else {
                onActionStateChange('IDLE');
              }
            }
          } else {
            // Relaxed click-navigation walking speed (2.4m/s)
            const speed = 2.4;
            const step = Math.min(dist, speed * dt);
            const dirX = dx / dist;
            const dirZ = dz / dist;

            const [resolvedX, resolvedZ, hitWall] = resolveCharacterMovement(
              curX,
              curZ,
              curX + dirX * step,
              curZ + dirZ * step
            );

            const stepElevation =
              resolvedZ > 7.45 ? -0.18 : resolvedZ > 7.05 ? -0.09 : 0;
            positionRef.current = [resolvedX, stepElevation, resolvedZ];
            const targetRot = Math.atan2(dirX, dirZ);
            // Smooth character rotation along path (max 2.8 rad/s)
            rotationYRef.current = stepAngleSmoothCapped(
              rotationYRef.current,
              targetRot,
              4.5,
              2.8,
              dt
            );

            if (actionState !== 'WALKING') {
              onActionStateChange('WALKING');
            }

            if (
              hitWall &&
              Math.hypot(resolvedX - curX, resolvedZ - curZ) < 0.001
            ) {
              navPathRef.current.shift();
              if (navPathRef.current.length === 0) {
                onClearNavVisuals();
                if (pendingArrivalRef.current) {
                  const fn = pendingArrivalRef.current;
                  pendingArrivalRef.current = null;
                  fn();
                } else {
                  onActionStateChange('IDLE');
                }
              }
            }
          }
        } else {
          if (actionState === 'WALKING') {
            onActionStateChange('IDLE');
          }
        }
      }
    }

    // 3. Detect crossing from outside road (Z > 6.55) into the bookstore interior (Z <= 6.2)
    const [charX, charY, charZ] = positionRef.current;
    if (wasOutsideRef.current && charZ <= 6.15) {
      wasOutsideRef.current = false;
      onEnteredStore();
    } else if (!wasOutsideRef.current && charZ > 6.85) {
      wasOutsideRef.current = true;
    }

    // 4. Gentle, Velocity-Capped Camera Gaze Alignment
    if (isDraggingRef.current) {
      // Smoothly interpolate toward the user's mouse drag target
      cameraYawRef.current = lerpAngleShortest(
        cameraYawRef.current,
        targetCameraYawRef.current,
        Math.min(1, dt * 8.0)
      );
      cameraPitchRef.current +=
        (targetCameraPitchRef.current - cameraPitchRef.current) *
        Math.min(1, dt * 8.0);

      if (!isSeated && navPathRef.current.length === 0) {
        rotationYRef.current = stepAngleSmoothCapped(
          rotationYRef.current,
          normalizeAngle(cameraYawRef.current + Math.PI),
          4.0,
          2.4,
          dt
        );
      }
    } else if (manualLookHoldTimerRef.current <= 0) {
      // Gently align camera behind character with a strict speed cap (~55 deg/s max)
      // so changing direction never whips the room across the screen
      const desiredCameraYaw = normalizeAngle(rotationYRef.current - Math.PI);
      const responsiveness = actionState === 'WALKING' ? 2.1 : 1.6;
      const maxYawSpeed = actionState === 'WALKING' ? 1.05 : 0.85;

      cameraYawRef.current = stepAngleSmoothCapped(
        cameraYawRef.current,
        desiredCameraYaw,
        responsiveness,
        maxYawSpeed,
        dt
      );
      targetCameraYawRef.current = cameraYawRef.current;
    }

    const lookTargetY = charY + (isSeated ? 0.96 : 1.24);
    const camDist = Math.max(0.9, Math.min(4.2, cameraDistanceRef.current));
    const pitch = cameraPitchRef.current;
    const yaw = cameraYawRef.current;

    const horizDist = camDist * Math.cos(pitch);
    const vertOffset = camDist * Math.sin(pitch);

    const desiredCamX = charX + Math.sin(yaw) * horizDist;
    const desiredCamY = lookTargetY + vertOffset;
    const desiredCamZ = charZ + Math.cos(yaw) * horizDist;

    const [safeCamX, safeCamY, safeCamZ] = computeSafeCameraPosition(
      charX,
      lookTargetY,
      charZ,
      desiredCamX,
      desiredCamY,
      desiredCamZ,
      camDist
    );

    // Smoothly widen indoor FOV (50 deg -> 72 deg) as user zooms out up to 4.2m inside the store
    // so zooming out shows the entire interior without the camera ever leaving the room walls
    if (camera instanceof THREE.PerspectiveCamera) {
      const zoomRatio = (camDist - 0.9) / (4.2 - 0.9);
      const targetFov = charZ <= 6.35 ? 50 + zoomRatio * 22 : 56;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6.0);
        camera.updateProjectionMatrix();
      }
    }

    // Soft, cushioned camera position damping
    const camLerp = Math.min(1, dt * 4.8);
    smoothCamPosRef.current.lerp(
      new THREE.Vector3(safeCamX, safeCamY, safeCamZ),
      camLerp
    );

    // Use the camera's own smooth viewing direction for a subtle forward look-ahead
    const viewFwdX = -Math.sin(yaw);
    const viewFwdZ = -Math.cos(yaw);
    const lookAheadDist =
      charZ > 3.2 && charZ <= 6.35 && Math.abs(yaw) < 0.7 ? 0.95 : 0.45;

    const lookTargetX = charX + viewFwdX * lookAheadDist;
    const lookTargetZ = charZ + viewFwdZ * lookAheadDist;

    smoothLookAtRef.current.lerp(
      new THREE.Vector3(lookTargetX, lookTargetY, lookTargetZ),
      Math.min(1, dt * 5.2)
    );

    camera.position.copy(smoothCamPosRef.current);
    camera.lookAt(smoothLookAtRef.current);

    // 5. Periodic Proximity Detection & State Sync
    posSyncTimerRef.current += dt;
    if (posSyncTimerRef.current > 0.1) {
      posSyncTimerRef.current = 0;
      onSyncCharacterPos([
        positionRef.current[0],
        positionRef.current[1],
        positionRef.current[2],
      ]);
    }

    proximityTimerRef.current += dt;
    if (proximityTimerRef.current > 0.12) {
      proximityTimerRef.current = 0;

      let closestShelf: GenreShelfData | null = null;
      let closestShelfDist = Infinity;
      for (const shelf of GENRE_SHELVES) {
        const d = Math.hypot(
          charX - shelf.interactionPoint[0],
          charZ - shelf.interactionPoint[2]
        );
        if (d < shelf.triggerRadius && d < closestShelfDist) {
          closestShelfDist = d;
          closestShelf = shelf;
        }
      }
      onUpdateActiveShelf(closestShelf);

      let closestBook: BookItem | null = null;
      let closestBookDist = Infinity;
      for (const book of REPRESENTATIVE_BOOKS) {
        if (heldBook?.id === book.id) continue;
        const d = Math.hypot(
          charX - book.interactionPoint[0],
          charZ - book.interactionPoint[2]
        );
        if (d < 1.55 && d < closestBookDist) {
          closestBookDist = d;
          closestBook = book;
        }
      }
      onUpdateNearbyBookId(closestBook ? closestBook.id : null);

      let closestSeat = null;
      let closestSeatDist = Infinity;
      for (const seat of SEAT_OBJECTS) {
        const d = Math.hypot(
          charX - seat.seatPosition[0],
          charZ - seat.seatPosition[2]
        );
        if (d < seat.triggerRadius && d < closestSeatDist) {
          closestSeatDist = d;
          closestSeat = seat;
        }
      }

      let closestTable = null;
      let closestTableDist = Infinity;
      for (const table of TABLE_OBJECTS) {
        const d = Math.hypot(
          charX - table.approachPoint[0],
          charZ - table.approachPoint[2]
        );
        if (d < table.triggerRadius && d < closestTableDist) {
          closestTableDist = d;
          closestTable = table;
        }
      }

      let closestStory = null;
      let closestStoryDist = Infinity;
      for (const story of SPACE_STORIES) {
        const d = Math.hypot(
          charX - story.approachPoint[0],
          charZ - story.approachPoint[2]
        );
        if (d < story.triggerRadius && d < closestStoryDist) {
          closestStoryDist = d;
          closestStory = story;
        }
      }

      if (closestSeat && closestSeatDist < 1.25 && !isSeated) {
        onUpdateActivePrompt({
          kind: 'seat',
          id: closestSeat.id,
          label: `[E] ${closestSeat.name}에 앉기`,
          sublabel: closestSeat.description,
          keyHint: 'E',
          seat: closestSeat,
        });
      } else if (closestBook && closestBookDist < 1.45) {
        onUpdateActivePrompt({
          kind: 'book',
          id: closestBook.id,
          label: `[E] 책 꺼내기 — 『${closestBook.title}』`,
          sublabel: `${closestBook.genreName} · ${closestBook.author}`,
          keyHint: 'E',
          book: closestBook,
        });
      } else if (closestTable && closestTableDist < 1.45) {
        onUpdateActivePrompt({
          kind: 'table',
          id: closestTable.id,
          label: heldBook
            ? `[E] ${closestTable.name}에 책 내려놓기 / 살펴보기`
            : `[E] ${closestTable.name} 이용하기`,
          sublabel: closestTable.description,
          keyHint: 'E',
          table: closestTable,
        });
      } else if (closestShelf) {
        onUpdateActivePrompt({
          kind: 'shelf',
          id: closestShelf.id,
          label: `[E] ${closestShelf.name} 서가 도서 목록 보기`,
          sublabel: closestShelf.subtitle,
          keyHint: 'E',
          shelf: closestShelf,
        });
      } else if (closestStory) {
        onUpdateActivePrompt({
          kind: 'story',
          id: closestStory.id,
          label: `[E] ${closestStory.title} 살펴보기`,
          sublabel: closestStory.subtitle,
          keyHint: 'E',
          story: closestStory,
        });
      } else {
        onUpdateActivePrompt(null);
      }
    }
  });

  return null;
};
