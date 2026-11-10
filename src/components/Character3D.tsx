import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BookItem, CharacterActionState } from '../types';

interface Character3DProps {
  actionState: CharacterActionState;
  reachingBook: BookItem | null;
  interactionProgressRef: React.MutableRefObject<number>;
}

/**
 * First-Person VR Arm (`책을 꺼내거나 숨은 그림을 찾을때 팔만 보이도록 구현`):
 * - The 3rd-person customer character body is removed for an immersive First-Person VR view.
 * - During normal exploration, sitting, or looking around, nothing obstructs the VR camera (`visible = false`).
 * - Only when `actionState === 'INTERACTING'` (taking out a book or finding a hidden object),
 *   the visitor's right arm smoothly reaches out from the lower-right of the VR view and retracts.
 */
export const Character3D: React.FC<Character3DProps> = ({
  actionState,
  reachingBook,
  interactionProgressRef,
}) => {
  const cameraAnchorRef = useRef<THREE.Group>(null);
  const armReachGroupRef = useRef<THREE.Group>(null);
  const handGroupRef = useRef<THREE.Group>(null);
  const fingersGroupRef = useRef<THREE.Group>(null);
  const thumbGroupRef = useRef<THREE.Group>(null);
  const graspedBookGroupRef = useRef<THREE.Group>(null);
  const discoveryPulseRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const anchor = cameraAnchorRef.current;
    const armReach = armReachGroupRef.current;
    if (!anchor || !armReach) return;

    const p = THREE.MathUtils.clamp(interactionProgressRef.current, 0, 1);
    const isInteracting = actionState === 'INTERACTING' && p > 0.001;

    if (!isInteracting) {
      anchor.visible = false;
      return;
    }

    anchor.visible = true;
    // Lock directly to the First-Person VR camera transform every frame
    anchor.position.copy(state.camera.position);
    anchor.quaternion.copy(state.camera.quaternion);

    // Smooth reach curve: 0 -> 1 at peak (p = 0.5) -> 0 on retraction
    const reachCurve = Math.sin(p * Math.PI);
    // Slight hold near peak reach so the grasp feels tangible
    const shapedReach = Math.pow(reachCurve, 0.78);

    // Camera-space coordinates: +X right, +Y up, -Z forward in front of the eyes
    const restX = 0.24;
    const restY = -0.34;
    const restZ = -0.14;

    const peakX = 0.08;
    const peakY = -0.11;
    const peakZ = -0.48;

    armReach.position.set(
      THREE.MathUtils.lerp(restX, peakX, shapedReach),
      THREE.MathUtils.lerp(restY, peakY, shapedReach),
      THREE.MathUtils.lerp(restZ, peakZ, shapedReach)
    );

    // Subtle natural wrist & forearm rotation as the arm extends forward
    armReach.rotation.set(
      THREE.MathUtils.lerp(-0.38, -0.06, shapedReach),
      THREE.MathUtils.lerp(0.28, 0.14, shapedReach),
      THREE.MathUtils.lerp(-0.18, -0.05, shapedReach)
    );

    // Curl fingers slightly as the hand grasps the book or touches the hidden item
    const graspCurl =
      p < 0.35
        ? THREE.MathUtils.smoothstep(p, 0.1, 0.35)
        : p < 0.75
        ? 1.0
        : 1.0 - THREE.MathUtils.smoothstep(p, 0.75, 1.0);

    if (fingersGroupRef.current) {
      fingersGroupRef.current.rotation.x = -0.25 - graspCurl * 0.52;
    }
    if (thumbGroupRef.current) {
      thumbGroupRef.current.rotation.z = 0.22 + graspCurl * 0.32;
    }
    if (handGroupRef.current) {
      handGroupRef.current.rotation.x = -0.08 + graspCurl * 0.14;
    }

    // Show the 3D book in hand once the hand reaches the shelf (p >= 0.28)
    if (graspedBookGroupRef.current) {
      graspedBookGroupRef.current.visible = Boolean(reachingBook && p >= 0.26);
    }

    // Subtle discovery ring pulse when finding a hidden object (`reachingBook === null`)
    if (discoveryPulseRef.current) {
      const showPulse = !reachingBook && p >= 0.28 && p <= 0.78;
      discoveryPulseRef.current.visible = showPulse;
      if (showPulse) {
        const pulseScale = 0.75 + Math.sin(((p - 0.28) / 0.5) * Math.PI) * 0.55;
        discoveryPulseRef.current.scale.setScalar(pulseScale);
      }
    }
  });

  return (
    <group ref={cameraAnchorRef} visible={false}>
      <group ref={armReachGroupRef}>
        {/* First-Person Forearm & Cozy Cream Knit Sweater Sleeve extending along -Z */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Outer Knit Sweater Sleeve */}
          <mesh position={[0, -0.15, 0]} castShadow>
            <capsuleGeometry args={[0.044, 0.22, 10, 16]} />
            <meshStandardMaterial color="#e6dfd3" roughness={0.82} />
          </mesh>

          {/* Ribbed Knit Cuff with Warm Terracotta Trim */}
          <mesh position={[0, -0.02, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.046, 0.042, 18]} />
            <meshStandardMaterial color="#d5c8b4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.002, 0]}>
            <cylinderGeometry args={[0.0455, 0.0455, 0.01, 18]} />
            <meshStandardMaterial color="#b05232" roughness={0.75} />
          </mesh>

          {/* Inner Wrist */}
          <mesh position={[0, 0.028, 0]} castShadow>
            <cylinderGeometry args={[0.033, 0.036, 0.05, 16]} />
            <meshStandardMaterial color="#f2cbb0" roughness={0.58} />
          </mesh>
        </group>

        {/* Articulated Right Hand at the Front Tip of the Forearm (z = -0.06) */}
        <group ref={handGroupRef} position={[0, 0.005, -0.065]}>
          {/* Rounded Palm */}
          <mesh position={[0, 0, -0.028]} castShadow>
            <boxGeometry args={[0.072, 0.028, 0.076]} />
            <meshStandardMaterial color="#f2cbb0" roughness={0.55} />
          </mesh>

          {/* Opposable Thumb on the Left Side (-X) of Right Hand */}
          <group
            ref={thumbGroupRef}
            position={[-0.038, -0.004, -0.024]}
            rotation={[0.1, 0.38, 0.22]}
          >
            <mesh position={[0, 0, -0.022]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <capsuleGeometry args={[0.011, 0.03, 6, 10]} />
              <meshStandardMaterial color="#f2cbb0" roughness={0.55} />
            </mesh>
          </group>

          {/* 4 Articulated Fingers Reaching Forward (-Z) */}
          <group ref={fingersGroupRef} position={[0, 0.002, -0.064]}>
            {[-0.024, -0.008, 0.008, 0.024].map((fx, fIdx) => {
              const fingerLen = fIdx === 1 || fIdx === 2 ? 0.036 : 0.03;
              return (
                <mesh
                  key={fIdx}
                  position={[fx, 0, -fingerLen * 0.55]}
                  rotation={[Math.PI / 2, 0, 0]}
                  castShadow
                >
                  <capsuleGeometry args={[0.0085, fingerLen, 6, 10]} />
                  <meshStandardMaterial color="#f2cbb0" roughness={0.55} />
                </mesh>
              );
            })}
          </group>

          {/* 3D Book Grasped in Hand When Taking Out a Book (`책을 꺼낼 때`) */}
          <group
            ref={graspedBookGroupRef}
            position={[-0.02, 0.022, -0.095]}
            rotation={[0.22, 0.35, -0.12]}
            visible={false}
          >
            {/* Book Cover Block */}
            <mesh castShadow>
              <boxGeometry args={[0.13, 0.18, 0.028]} />
              <meshStandardMaterial
                color={reachingBook?.coverColor ?? '#c85a28'}
                roughness={0.62}
              />
            </mesh>
            {/* Book Spine Accent */}
            <mesh position={[-0.062, 0, 0]}>
              <boxGeometry args={[0.01, 0.182, 0.03]} />
              <meshStandardMaterial
                color={reachingBook?.spineColor ?? '#8f3914'}
                roughness={0.7}
              />
            </mesh>
            {/* Cream Paper Pages Edge */}
            <mesh position={[0.004, 0, 0]}>
              <boxGeometry args={[0.124, 0.172, 0.022]} />
              <meshStandardMaterial color="#faf3e3" roughness={0.85} />
            </mesh>
            {/* Front Cover Title Label Plate */}
            <mesh position={[0.005, 0.02, 0.015]}>
              <planeGeometry args={[0.085, 0.055]} />
              <meshBasicMaterial color="#fffbeb" />
            </mesh>
          </group>

          {/* Subtle Warm Sparkle Ring When Touching/Finding a Hidden Object (`숨은 그림을 찾을 때`) */}
          <mesh
            ref={discoveryPulseRef}
            position={[0, 0.01, -0.105]}
            visible={false}
          >
            <ringGeometry args={[0.028, 0.042, 24]} />
            <meshBasicMaterial
              color="#fde047"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};
