import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GENRE_SHELVES,
  REPRESENTATIVE_BOOKS,
  SEAT_OBJECTS,
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
  responsiveness: number,
  maxSpeedRadPerSec: number,
  dt: number
): number {
  const diff = normalizeAngle(target - current);
  const desiredDelta = diff * Math.min(1, dt * responsiveness);
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
  const { camera, gl, size } = useThree();

  const keysPressedRef = useRef<Set<string>>(new Set());
  const lastKeyComboRef = useRef<string>('');
  const movementBaseYawRef = useRef<number>(0);

  // Pointer drag state with deadzone + two-finger pinch-to-zoom support
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const isPinchingRef = useRef(false);
  const pinchLastDistRef = useRef<number>(0);
  const pointerDownStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const manualLookHoldTimerRef = useRef<number>(0);

  // Damped yaw/pitch targets & last-synced orientation refs so manual gaze NEVER snaps back
  const targetCameraYawRef = useRef<number>(cameraYawRef.current);
  const targetCameraPitchRef = useRef<number>(cameraPitchRef.current);
  const lastSyncedRotationYRef = useRef<number>(rotationYRef.current);
  const lastSyncedCameraYawRef = useRef<number>(cameraYawRef.current);
  const lastSyncedCameraPitchRef = useRef<number>(cameraPitchRef.current);

  const smoothLookAtRef = useRef(new THREE.Vector3(0.15, 1.32, 7.8));
  const smoothCamPosRef = useRef(new THREE.Vector3(0.15, 2.55, 11.8));
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
      isPinchingRef.current = false;
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

  // Mouse drag, wheel zoom, and mobile 2-finger pinch-to-zoom
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (isPinchingRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      didDragRef.current = false;
      pointerDownStartRef.current = { x: e.clientX, y: e.clientY };
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      targetCameraYawRef.current = cameraYawRef.current;
      targetCameraPitchRef.current = cameraPitchRef.current;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current || isPinchingRef.current) return;

      const totalDx = e.clientX - pointerDownStartRef.current.x;
      const totalDy = e.clientY - pointerDownStartRef.current.y;

      // Require only 4px movement before treating as a smooth camera gaze drag
      if (!isDraggingRef.current) {
        if (Math.hypot(totalDx, totalDy) < 4) return;
        isDraggingRef.current = true;
        didDragRef.current = true;
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }

      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      // Smooth, natural sensitivity so rotating gaze 90~180 deg in place feels effortless
      const isTouch = e.pointerType === 'touch' || window.innerWidth < 768;
      const yawSensitivity = isTouch ? 0.0058 : 0.0052;
      const pitchSensitivity = isTouch ? 0.0038 : 0.0034;

      targetCameraYawRef.current = normalizeAngle(
        targetCameraYawRef.current - dx * yawSensitivity
      );
      targetCameraPitchRef.current = Math.max(
        -0.22,
        Math.min(1.08, targetCameraPitchRef.current + dy * pitchSensitivity)
      );

      // Keep character facing aligned with the new in-place gaze so the camera never snaps back!
      if (navPathRef.current.length === 0) {
        rotationYRef.current = normalizeAngle(
          targetCameraYawRef.current + Math.PI
        );
        lastSyncedRotationYRef.current = rotationYRef.current;
      }

      manualLookHoldTimerRef.current = 0.6;
    };

    const onPointerUp = () => {
      isPointerDownRef.current = false;
      isDraggingRef.current = false;
    };

    // Suppress R3F 3D object clicks when the user was dragging the mouse to rotate their gaze in place!
    const onClickCapture = (e: MouseEvent) => {
      if (didDragRef.current) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        didDragRef.current = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Two-finger pinch-to-zoom for mobile / touch screens
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isPinchingRef.current = true;
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        pinchLastDistRef.current = Math.hypot(
          t0.clientX - t1.clientX,
          t0.clientY - t1.clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(
          t0.clientX - t1.clientX,
          t0.clientY - t1.clientY
        );
        const deltaDist = dist - pinchLastDistRef.current;
        pinchLastDistRef.current = dist;

        const nextDist = Math.max(
          0.9,
          Math.min(4.2, cameraDistanceRef.current - deltaDist * 0.011)
        );
        cameraDistanceRef.current = nextDist;
        onSyncCameraDistance(nextDist);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
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
    window.addEventListener('click', onClickCapture, { capture: true });
    dom.addEventListener('contextmenu', onContextMenu);
    dom.addEventListener('touchstart', onTouchStart, { passive: false });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('click', onClickCapture, { capture: true });
      dom.removeEventListener('contextmenu', onContextMenu);
      dom.removeEventListener('touchstart', onTouchStart);
      dom.removeEventListener('touchmove', onTouchMove);
      dom.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [
    gl,
    cameraYawRef,
    cameraPitchRef,
    cameraDistanceRef,
    rotationYRef,
    navPathRef,
    onSyncCameraDistance,
  ]);

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

    // 4. Smooth In-Place Gaze Rotation & Permanent Gaze Retention (Never snaps back when stationary!)
    // Detect if external code (e.g. reset camera button or entering store) explicitly set cameraYawRef / cameraPitchRef
    if (
      Math.abs(
        normalizeAngle(cameraYawRef.current - lastSyncedCameraYawRef.current)
      ) > 0.001
    ) {
      targetCameraYawRef.current = cameraYawRef.current;
    }
    if (
      Math.abs(cameraPitchRef.current - lastSyncedCameraPitchRef.current) >
      0.001
    ) {
      targetCameraPitchRef.current = cameraPitchRef.current;
    }

    // Detect if character rotationYRef was changed by walking or arriving at a shelf/table/seat
    if (
      !isDraggingRef.current &&
      manualLookHoldTimerRef.current <= 0 &&
      Math.abs(
        normalizeAngle(rotationYRef.current - lastSyncedRotationYRef.current)
      ) > 0.001
    ) {
      targetCameraYawRef.current = normalizeAngle(
        rotationYRef.current - Math.PI
      );
      lastSyncedRotationYRef.current = rotationYRef.current;
    } else {
      lastSyncedRotationYRef.current = rotationYRef.current;
    }

    const isManualLooking =
      isDraggingRef.current || manualLookHoldTimerRef.current > 0;
    const lookLerpRate = isManualLooking ? 18.0 : 8.5;

    cameraYawRef.current = lerpAngleShortest(
      cameraYawRef.current,
      targetCameraYawRef.current,
      Math.min(1, dt * lookLerpRate)
    );
    cameraPitchRef.current +=
      (targetCameraPitchRef.current - cameraPitchRef.current) *
      Math.min(1, dt * lookLerpRate);

    lastSyncedCameraYawRef.current = cameraYawRef.current;
    lastSyncedCameraPitchRef.current = cameraPitchRef.current;

    // Aim lookTarget slightly above the scaled-down character (charY + 1.32)
    const lookTargetY = charY + (isSeated ? 0.92 : 1.32);
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

    // Aspect-ratio adaptive FOV: on portrait mobile screens (aspect < 1.0), automatically widen
    // vertical FOV so the horizontal view stays wide and the character looks smaller inside the room
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = size.width / Math.max(1, size.height);
      const portraitBoost = aspect < 1.0 ? (1.0 - aspect) * 28 : 0;
      const zoomRatio = (camDist - 0.9) / (4.2 - 0.9);
      const baseFov = charZ <= 6.35 ? 54 + zoomRatio * 20 : 58;
      const targetFov = Math.min(88, baseFov + portraitBoost);
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6.0);
        camera.updateProjectionMatrix();
      }
    }

    // Use matching lerp factor for both camera position and lookAt target so the viewing ray direction never warps
    const camLerp = Math.min(1, dt * (isManualLooking ? 16.0 : 7.5));
    smoothCamPosRef.current.lerp(
      new THREE.Vector3(safeCamX, safeCamY, safeCamZ),
      camLerp
    );

    const viewFwdX = -Math.sin(yaw) * Math.cos(pitch);
    const viewFwdY = -Math.sin(pitch);
    const viewFwdZ = -Math.cos(yaw) * Math.cos(pitch);
    const lookAheadDist = 0.75;

    const lookTargetX = charX + viewFwdX * lookAheadDist;
    const lookTargetYWithPitch = lookTargetY + viewFwdY * lookAheadDist;
    const lookTargetZ = charZ + viewFwdZ * lookAheadDist;

    smoothLookAtRef.current.lerp(
      new THREE.Vector3(lookTargetX, lookTargetYWithPitch, lookTargetZ),
      camLerp
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
        if (d < 1.35 && d < closestBookDist) {
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

      // Only show a compact prompt when right next to a seat, book, or table (no passive story/shelf banners cluttering the screen)
      if (closestSeat && closestSeatDist < 1.1 && !isSeated) {
        onUpdateActivePrompt({
          kind: 'seat',
          id: closestSeat.id,
          label: `${closestSeat.name}에 앉기`,
          sublabel: closestSeat.description,
          keyHint: 'E',
          seat: closestSeat,
        });
      } else if (closestBook && closestBookDist < 1.2) {
        onUpdateActivePrompt({
          kind: 'book',
          id: closestBook.id,
          label: `책 꺼내기: 『${closestBook.title}』`,
          sublabel: `${closestBook.genreName} · ${closestBook.author}`,
          keyHint: 'E',
          book: closestBook,
        });
      } else if (closestTable && closestTableDist < 1.15) {
        onUpdateActivePrompt({
          kind: 'table',
          id: closestTable.id,
          label: heldBook
            ? `${closestTable.name}에 책 내려놓기`
            : `${closestTable.name} 살펴보기`,
          sublabel: closestTable.description,
          keyHint: 'E',
          table: closestTable,
        });
      } else {
        onUpdateActivePrompt(null);
      }
    }
  });

  return null;
};
