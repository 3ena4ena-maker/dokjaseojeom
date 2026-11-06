import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BookItem, CharacterActionState } from '../types';

interface Character3DProps {
  positionRef: React.MutableRefObject<[number, number, number]>;
  rotationYRef: React.MutableRefObject<number>;
  actionState: CharacterActionState;
  isSeated: boolean;
  heldBook: BookItem | null;
  interactionProgressRef: React.MutableRefObject<number>;
}

export const Character3D: React.FC<Character3DProps> = ({
  positionRef,
  rotationYRef,
  actionState,
  isSeated,
  heldBook,
  interactionProgressRef,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const pelvisRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);
  const heldBookGroupRef = useRef<THREE.Group>(null);
  const openBookGroupRef = useRef<THREE.Group>(null);

  const walkCycleRef = useRef(0);

  useFrame((state, delta) => {
    if (!rootRef.current || !pelvisRef.current || !torsoRef.current) return;

    const [px, py, pz] = positionRef.current;
    const rotY = rotationYRef.current;

    // Update world position & smooth rotation
    rootRef.current.position.set(px, py, pz);

    // Shortest angle interpolation for visual body orientation
    let diff = rotY - rootRef.current.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rootRef.current.rotation.y += diff * Math.min(1, delta * 14);

    const t = state.clock.getElapsedTime();

    // Default joint targets
    let pelvisY = 0.72;
    let pelvisZ = 0;
    let torsoRotX = 0;
    let torsoRotZ = 0;
    let headRotX = 0;
    let headRotY = 0;

    let lArmX = 0;
    let lArmZ = 0.08;
    let lForearmX = -0.15;

    let rArmX = 0;
    let rArmZ = -0.08;
    let rForearmX = -0.15;

    let lLegX = 0;
    let lShinX = 0;
    let rLegX = 0;
    let rShinX = 0;

    if (actionState === 'WALKING') {
      walkCycleRef.current += delta * 9.5;
      const wc = walkCycleRef.current;
      const swing = Math.sin(wc);
      const bob = Math.abs(Math.cos(wc)) * 0.038;

      pelvisY = 0.72 + bob;
      torsoRotX = 0.06;
      torsoRotZ = Math.cos(wc) * 0.025;
      headRotY = Math.sin(t * 1.5) * 0.04;

      // Legs swing & knees bend naturally
      lLegX = swing * 0.58;
      rLegX = -swing * 0.58;
      lShinX = Math.max(0, -Math.cos(wc) * 0.52);
      rShinX = Math.max(0, Math.cos(wc) * 0.52);

      // Arms swing (if holding a book, right arm holds book steady at waist/chest)
      lArmX = -swing * 0.42;
      lForearmX = -0.25 - Math.max(0, -swing) * 0.2;

      if (heldBook) {
        rArmX = -0.45 + bob * 0.5;
        rArmZ = -0.12;
        rForearmX = -0.85;
      } else {
        rArmX = swing * 0.42;
        rForearmX = -0.25 - Math.max(0, swing) * 0.2;
      }
    } else if (actionState === 'INTERACTING') {
      // Reaching out to shelf to take or return a book
      const p = interactionProgressRef.current; // 0..1
      const reachCurve = Math.sin(p * Math.PI);

      pelvisY = 0.72 - reachCurve * 0.02;
      torsoRotX = 0.14 * reachCurve;
      headRotX = -0.18 * reachCurve;

      rArmX = -1.25 * reachCurve - 0.25 * (1 - reachCurve);
      rArmZ = -0.05;
      rForearmX = -0.45 * reachCurve - 0.5 * (1 - reachCurve);

      lArmX = -0.35 * reachCurve;
      lForearmX = -0.4 * reachCurve;
    } else if (actionState === 'SITTING' || (actionState === 'READING' && isSeated)) {
      // Seated posture on chair / wooden bench / stool
      pelvisY = 0.47;
      pelvisZ = 0.04;
      torsoRotX = -0.05 + Math.sin(t * 1.8) * 0.012;

      // Thighs horizontal, shins vertical down to floor
      lLegX = -1.42;
      rLegX = -1.42;
      lShinX = 1.42;
      rShinX = 1.42;

      if (actionState === 'READING') {
        // Seated reading posture: holding open book with both hands, head tilted down scanning pages
        headRotX = 0.34;
        headRotY = Math.sin(t * 1.4) * 0.09;
        torsoRotX = 0.08;

        lArmX = -0.68;
        lArmZ = 0.18;
        lForearmX = -0.88;

        rArmX = -0.68;
        rArmZ = -0.18;
        rForearmX = -0.88;
      } else if (heldBook) {
        // Seated holding closed book on lap
        headRotX = 0.12;
        headRotY = Math.sin(t * 0.9) * 0.12;

        lArmX = -0.38;
        lForearmX = -0.65;
        rArmX = -0.48;
        rForearmX = -0.78;
      } else {
        // Relaxed seated posture
        headRotY = Math.sin(t * 0.8) * 0.15;
        lArmX = -0.25;
        lForearmX = -0.55;
        rArmX = -0.25;
        rForearmX = -0.55;
      }
    } else if (actionState === 'READING' && !isSeated) {
      // Standing and reading the held book
      pelvisY = 0.72 + Math.sin(t * 2) * 0.008;
      torsoRotX = 0.08;
      headRotX = 0.32;
      headRotY = Math.sin(t * 1.4) * 0.09; // Eyes scanning across left and right pages

      lArmX = -0.65;
      lArmZ = 0.2;
      lForearmX = -0.92;

      rArmX = -0.65;
      rArmZ = -0.2;
      rForearmX = -0.92;
    } else {
      // IDLE state
      const breath = Math.sin(t * 2.2) * 0.01;
      pelvisY = 0.72 + breath;
      headRotY = Math.sin(t * 0.7) * 0.08;
      headRotX = Math.cos(t * 1.1) * 0.03;

      if (heldBook) {
        rArmX = -0.45;
        rArmZ = -0.12;
        rForearmX = -0.88;
        lArmX = -0.08;
        lForearmX = -0.2;
      } else {
        lArmX = Math.sin(t * 1.5) * 0.03;
        rArmX = -Math.sin(t * 1.5) * 0.03;
      }
    }

    const damp = Math.min(1, delta * 12);

    pelvisRef.current.position.y = THREE.MathUtils.lerp(
      pelvisRef.current.position.y,
      pelvisY,
      damp
    );
    pelvisRef.current.position.z = THREE.MathUtils.lerp(
      pelvisRef.current.position.z,
      pelvisZ,
      damp
    );

    torsoRef.current.rotation.x = THREE.MathUtils.lerp(
      torsoRef.current.rotation.x,
      torsoRotX,
      damp
    );
    torsoRef.current.rotation.z = THREE.MathUtils.lerp(
      torsoRef.current.rotation.z,
      torsoRotZ,
      damp
    );

    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        headRotX,
        damp
      );
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        headRotY,
        damp
      );
    }

    if (leftArmRef.current && leftForearmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftArmRef.current.rotation.x,
        lArmX,
        damp
      );
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(
        leftArmRef.current.rotation.z,
        lArmZ,
        damp
      );
      leftForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftForearmRef.current.rotation.x,
        lForearmX,
        damp
      );
    }

    if (rightArmRef.current && rightForearmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightArmRef.current.rotation.x,
        rArmX,
        damp
      );
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(
        rightArmRef.current.rotation.z,
        rArmZ,
        damp
      );
      rightForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightForearmRef.current.rotation.x,
        rForearmX,
        damp
      );
    }

    if (
      leftLegRef.current &&
      leftShinRef.current &&
      rightLegRef.current &&
      rightShinRef.current
    ) {
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
        leftLegRef.current.rotation.x,
        lLegX,
        damp
      );
      leftShinRef.current.rotation.x = THREE.MathUtils.lerp(
        leftShinRef.current.rotation.x,
        lShinX,
        damp
      );
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
        rightLegRef.current.rotation.x,
        rLegX,
        damp
      );
      rightShinRef.current.rotation.x = THREE.MathUtils.lerp(
        rightShinRef.current.rotation.x,
        rShinX,
        damp
      );
    }
  });

  const showOpenBook = actionState === 'READING' && heldBook !== null;
  const showClosedHeldBook =
    heldBook !== null && actionState !== 'READING';

  return (
    <group ref={rootRef} position={[0.1, 0, 5.45]} rotation={[0, Math.PI, 0]}>
      {/* Ground shadow & subtle position indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.28, 32]} />
        <meshBasicMaterial color="#090807" transparent opacity={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.27, 0.31, 32]} />
        <meshBasicMaterial color="#e09f3e" transparent opacity={0.45} />
      </mesh>

      {/* Pelvis / Root of articulated skeleton */}
      <group ref={pelvisRef} position={[0, 0.72, 0]}>
        {/* Hip block */}
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.14, 0.2]} />
          <meshStandardMaterial color="#2b2623" roughness={0.85} />
        </mesh>

        {/* Left Leg */}
        <group ref={leftLegRef} position={[0.085, -0.04, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.062, 0.22, 8, 12]} />
            <meshStandardMaterial color="#2b2623" roughness={0.85} />
          </mesh>
          {/* Knee & Shin */}
          <group ref={leftShinRef} position={[0, -0.34, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.052, 0.22, 8, 12]} />
              <meshStandardMaterial color="#2b2623" roughness={0.85} />
            </mesh>
            {/* Shoe */}
            <mesh position={[0, -0.32, 0.04]} castShadow>
              <boxGeometry args={[0.11, 0.075, 0.21]} />
              <meshStandardMaterial color="#452719" roughness={0.6} />
            </mesh>
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[-0.085, -0.04, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.062, 0.22, 8, 12]} />
            <meshStandardMaterial color="#2b2623" roughness={0.85} />
          </mesh>
          {/* Knee & Shin */}
          <group ref={rightShinRef} position={[0, -0.34, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow>
              <capsuleGeometry args={[0.052, 0.22, 8, 12]} />
              <meshStandardMaterial color="#2b2623" roughness={0.85} />
            </mesh>
            {/* Shoe */}
            <mesh position={[0, -0.32, 0.04]} castShadow>
              <boxGeometry args={[0.11, 0.075, 0.21]} />
              <meshStandardMaterial color="#452719" roughness={0.6} />
            </mesh>
          </group>
        </group>

        {/* Torso & Upper Body */}
        <group ref={torsoRef} position={[0, 0.05, 0]}>
          {/* Sweater / Knit Cardigan Torso */}
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.34, 0.44, 0.22]} />
            <meshStandardMaterial color="#d6c7b2" roughness={0.8} />
          </mesh>
          {/* Inner Shirt Collar / Scarf Accent */}
          <mesh position={[0, 0.45, 0.02]} castShadow>
            <cylinderGeometry args={[0.11, 0.13, 0.08, 16]} />
            <meshStandardMaterial color="#b44c27" roughness={0.75} />
          </mesh>
          {/* Crossbody Canvas Book Bag Strap & Pouch */}
          <mesh position={[0, 0.24, 0.115]} rotation={[0, 0, 0.62]}>
            <boxGeometry args={[0.04, 0.48, 0.015]} />
            <meshStandardMaterial color="#5c3a21" roughness={0.7} />
          </mesh>
          <mesh position={[-0.19, 0.04, -0.02]} castShadow>
            <boxGeometry args={[0.07, 0.2, 0.18]} />
            <meshStandardMaterial color="#6e472b" roughness={0.75} />
          </mesh>

          {/* Head & Hair */}
          <group ref={headRef} position={[0, 0.52, 0]}>
            {/* Neck */}
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.055, 0.065, 0.08, 12]} />
              <meshStandardMaterial color="#f2ccb0" roughness={0.65} />
            </mesh>
            {/* Head Sphere */}
            <mesh position={[0, 0.17, 0]} castShadow>
              <sphereGeometry args={[0.145, 24, 24]} />
              <meshStandardMaterial color="#f5d2b8" roughness={0.6} />
            </mesh>
            {/* Hair Cap */}
            <mesh position={[0, 0.21, -0.015]} castShadow>
              <sphereGeometry args={[0.152, 24, 24]} />
              <meshStandardMaterial color="#231c18" roughness={0.85} />
            </mesh>
            {/* Front Bangs / Hair Detail */}
            <mesh position={[0, 0.25, 0.09]} rotation={[0.3, 0, 0]} castShadow>
              <boxGeometry args={[0.23, 0.07, 0.1]} />
              <meshStandardMaterial color="#231c18" roughness={0.85} />
            </mesh>
            {/* Warm Beret Hat */}
            <mesh
              position={[0.02, 0.31, -0.02]}
              rotation={[-0.12, 0, -0.15]}
              castShadow
            >
              <cylinderGeometry args={[0.15, 0.13, 0.06, 20]} />
              <meshStandardMaterial color="#8c3b20" roughness={0.8} />
            </mesh>
            {/* Eyes (facing +Z in local character space) */}
            <mesh position={[0.048, 0.17, 0.132]}>
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshBasicMaterial color="#1c1917" />
            </mesh>
            <mesh position={[-0.048, 0.17, 0.132]}>
              <sphereGeometry args={[0.016, 10, 10]} />
              <meshBasicMaterial color="#1c1917" />
            </mesh>
            {/* Round Glasses */}
            <mesh position={[0.05, 0.17, 0.14]}>
              <torusGeometry args={[0.028, 0.004, 8, 20]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[-0.05, 0.17, 0.14]}>
              <torusGeometry args={[0.028, 0.004, 8, 20]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>

          {/* Left Arm */}
          <group ref={leftArmRef} position={[0.21, 0.4, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.048, 0.16, 8, 12]} />
              <meshStandardMaterial color="#d6c7b2" roughness={0.8} />
            </mesh>
            <group ref={leftForearmRef} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.042, 0.15, 8, 12]} />
                <meshStandardMaterial color="#d6c7b2" roughness={0.8} />
              </mesh>
              {/* Left Hand */}
              <mesh position={[0, -0.21, 0]} castShadow>
                <sphereGeometry args={[0.042, 12, 12]} />
                <meshStandardMaterial color="#f5d2b8" roughness={0.6} />
              </mesh>
            </group>
          </group>

          {/* Right Arm (holds closed book when carrying) */}
          <group ref={rightArmRef} position={[-0.21, 0.4, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.048, 0.16, 8, 12]} />
              <meshStandardMaterial color="#d6c7b2" roughness={0.8} />
            </mesh>
            <group ref={rightForearmRef} position={[0, -0.22, 0]}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.042, 0.15, 8, 12]} />
                <meshStandardMaterial color="#d6c7b2" roughness={0.8} />
              </mesh>
              {/* Right Hand */}
              <mesh position={[0, -0.21, 0]} castShadow>
                <sphereGeometry args={[0.042, 12, 12]} />
                <meshStandardMaterial color="#f5d2b8" roughness={0.6} />
              </mesh>

              {/* Closed 3D Book held in right hand */}
              {showClosedHeldBook && heldBook && (
                <group
                  ref={heldBookGroupRef}
                  position={[0.06, -0.22, 0.08]}
                  rotation={[0.3, 0.2, -0.2]}
                >
                  {/* Book Cover */}
                  <mesh castShadow>
                    <boxGeometry args={[0.16, 0.22, 0.036]} />
                    <meshStandardMaterial
                      color={heldBook.coverColor}
                      roughness={0.5}
                    />
                  </mesh>
                  {/* Book Pages Edge */}
                  <mesh position={[0.006, 0, 0]}>
                    <boxGeometry args={[0.152, 0.21, 0.028]} />
                    <meshStandardMaterial color="#fcf8f0" roughness={0.8} />
                  </mesh>
                  {/* Book Accent Band */}
                  <mesh position={[0, -0.04, 0.019]}>
                    <boxGeometry args={[0.162, 0.045, 0.002]} />
                    <meshStandardMaterial color={heldBook.accentColor} />
                  </mesh>
                </group>
              )}
            </group>
          </group>

          {/* Open 3D Book held in front of chest with both hands during READING */}
          {showOpenBook && heldBook && (
            <group
              ref={openBookGroupRef}
              position={[0, 0.26, 0.32]}
              rotation={[-0.55, 0, 0]}
            >
              {/* Left Cover & Page */}
              <group position={[0.075, 0, 0]} rotation={[0, -0.28, 0]}>
                <mesh position={[0, 0, -0.008]} castShadow>
                  <boxGeometry args={[0.16, 0.22, 0.008]} />
                  <meshStandardMaterial
                    color={heldBook.coverColor}
                    roughness={0.5}
                  />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <boxGeometry args={[0.15, 0.21, 0.01]} />
                  <meshStandardMaterial color="#fffcf5" roughness={0.85} />
                </mesh>
              </group>
              {/* Right Cover & Page */}
              <group position={[-0.075, 0, 0]} rotation={[0, 0.28, 0]}>
                <mesh position={[0, 0, -0.008]} castShadow>
                  <boxGeometry args={[0.16, 0.22, 0.008]} />
                  <meshStandardMaterial
                    color={heldBook.coverColor}
                    roughness={0.5}
                  />
                </mesh>
                <mesh position={[0, 0, 0.002]}>
                  <boxGeometry args={[0.15, 0.21, 0.01]} />
                  <meshStandardMaterial color="#fffcf5" roughness={0.85} />
                </mesh>
              </group>
              {/* Spine */}
              <mesh position={[0, 0, -0.02]}>
                <boxGeometry args={[0.024, 0.22, 0.018]} />
                <meshStandardMaterial color={heldBook.spineColor} />
              </mesh>
            </group>
          )}
        </group>
      </group>

      {/* Subtle floating badge over character head when reading, sitting, or holding a book */}
      {(actionState !== 'IDLE' && actionState !== 'WALKING') || heldBook ? (
        <Html
          position={[0, isSeated ? 1.48 : 1.75, 0]}
          center
          zIndexRange={[5, 0]}
        >
          <div className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-full bg-[#1c1613]/90 px-2.5 py-0.5 text-[11px] font-medium text-[#fde68a] shadow-md border border-[#d97736]/40 backdrop-blur-sm">
            {actionState === 'READING' && (
              <>
                <span>📖</span>
                <span>『{heldBook?.title}』 읽는 중...</span>
              </>
            )}
            {actionState === 'SITTING' && (
              <>
                <span>🪑</span>
                <span>
                  {heldBook
                    ? `앉아서 『${heldBook.title}』 감상 중`
                    : '앉아서 쉬는 중'}
                </span>
              </>
            )}
            {actionState === 'INTERACTING' && (
              <>
                <span>✨</span>
                <span>책을 꺼내는 중...</span>
              </>
            )}
            {(actionState === 'IDLE' || actionState === 'WALKING') &&
              heldBook && (
                <>
                  <span>📕</span>
                  <span className="max-w-[140px] truncate">
                    {heldBook.title}
                  </span>
                </>
              )}
          </div>
        </Html>
      ) : null}
    </group>
  );
};
