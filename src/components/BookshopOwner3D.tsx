import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export const OWNER_QA_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: '안녕하세요',
    answer: '안녕하세요',
  },
  {
    question: '여기 뭐하는데에요?',
    answer: '책을 파는 서점입니다.',
  },
  {
    question: '커피도 파나요?',
    answer:
      '커피는 판매하지 않아요. 근처 카페에서 사오셔서 여기서 드셔도 됩니다',
  },
  {
    question: '여기는 무슨 컨셉이에요?',
    answer:
      '책방지기의 취향으로 만들어진 독립서점이에요. 독립서점 특성상 책의 종류는 많지 않아요. 대신 흔하게 볼 수 있는 책과 독립출판물도 볼 수 있어요',
  },
  {
    question: '장사가 안되겠어요.',
    answer: '네, 그래서 책방지기는 월세를 벌러 나가요. 책 많이 팔아주세요 :)',
  },
];

interface BookshopOwner3DProps {
  position: [number, number, number];
  rotationY: number;
  isTalking: boolean;
  selectedQuestionIdx: number | null;
  onTalkClick: () => void;
}

export const BookshopOwner3D: React.FC<BookshopOwner3DProps> = ({
  position,
  rotationY,
  isTalking,
  selectedQuestionIdx,
  onTalkClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const damp = Math.min(1, delta * 8);

    if (torsoRef.current) {
      const targetTorsoX = isTalking
        ? -0.02 + Math.sin(t * 2.4) * 0.015
        : 0.05 + Math.sin(t * 1.6) * 0.012;
      torsoRef.current.rotation.x = THREE.MathUtils.lerp(
        torsoRef.current.rotation.x,
        targetTorsoX,
        damp
      );
    }

    if (headRef.current) {
      const targetHeadX = isTalking
        ? -0.03 + Math.sin(t * 3.2) * 0.035
        : 0.14 + Math.sin(t * 0.9) * 0.06;
      const targetHeadY = isTalking
        ? Math.sin(t * 1.5) * 0.08
        : Math.sin(t * 0.65) * 0.16;
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        targetHeadX,
        damp
      );
      headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y,
        targetHeadY,
        damp
      );
    }

    if (leftForearmRef.current && rightForearmRef.current) {
      const lTarget = isTalking
        ? -0.82 + Math.sin(t * 2.6) * 0.05
        : -0.96 + Math.sin(t * 3.8) * 0.035;
      const rTarget = isTalking
        ? -0.82 + Math.cos(t * 2.6) * 0.05
        : -0.96 + Math.cos(t * 4.1) * 0.035;
      leftForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        leftForearmRef.current.rotation.x,
        lTarget,
        damp
      );
      rightForearmRef.current.rotation.x = THREE.MathUtils.lerp(
        rightForearmRef.current.rotation.x,
        rTarget,
        damp
      );
    }
  });

  const activeAnswer =
    selectedQuestionIdx !== null
      ? OWNER_QA_ITEMS[selectedQuestionIdx]?.answer ?? null
      : null;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onTalkClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Articulated Seated Figure matching Character3D scale & wooden-doll style */}
      <group scale={0.76}>
        {/* Pelvis seated on Windsor Chair (seat top Y = 0.46) */}
        <group position={[0, 0.67, -0.02]}>
          {/* Hip Block (Dark Denim / Work Trousers) */}
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.14, 0.2]} />
            <meshStandardMaterial color="#1e242b" roughness={0.85} />
          </mesh>

          {/* Left Seated Leg */}
          <group position={[0.085, -0.04, 0]} rotation={[-1.48, 0, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.22, 8, 12]} />
              <meshStandardMaterial color="#1e242b" roughness={0.85} />
            </mesh>
            <group position={[0, -0.34, 0]} rotation={[1.48, 0, 0]}>
              <mesh position={[0, -0.16, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.22, 8, 12]} />
                <meshStandardMaterial color="#1e242b" roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.32, 0.04]} castShadow>
                <boxGeometry args={[0.11, 0.075, 0.21]} />
                <meshStandardMaterial color="#3b2314" roughness={0.6} />
              </mesh>
            </group>
          </group>

          {/* Right Seated Leg */}
          <group position={[-0.085, -0.04, 0]} rotation={[-1.48, 0, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.22, 8, 12]} />
              <meshStandardMaterial color="#1e242b" roughness={0.85} />
            </mesh>
            <group position={[0, -0.34, 0]} rotation={[1.48, 0, 0]}>
              <mesh position={[0, -0.16, 0]} castShadow>
                <capsuleGeometry args={[0.052, 0.22, 8, 12]} />
                <meshStandardMaterial color="#1e242b" roughness={0.85} />
              </mesh>
              <mesh position={[0, -0.32, 0.04]} castShadow>
                <boxGeometry args={[0.11, 0.075, 0.21]} />
                <meshStandardMaterial color="#3b2314" roughness={0.6} />
              </mesh>
            </group>
          </group>

          {/* Torso & Leather Craftsman Apron */}
          <group ref={torsoRef} position={[0, 0.05, 0]}>
            {/* Deep Charcoal-Olive Knit Sweater */}
            <mesh position={[0, 0.24, 0]} castShadow>
              <boxGeometry args={[0.35, 0.45, 0.22]} />
              <meshStandardMaterial
                color={hovered ? '#3f4d43' : '#2f3a33'}
                roughness={0.8}
              />
            </mesh>
            {/* Shirt Collar */}
            <mesh position={[0, 0.455, 0.015]} castShadow>
              <cylinderGeometry args={[0.105, 0.125, 0.075, 16]} />
              <meshStandardMaterial color="#e7dfd3" roughness={0.75} />
            </mesh>
            {/* Cognac Leather Workshop Apron Bib & Neck Strap (Dimpchi Leather Craft) */}
            <mesh position={[0, 0.21, 0.114]} castShadow>
              <boxGeometry args={[0.25, 0.36, 0.018]} />
              <meshStandardMaterial color="#8c4f27" roughness={0.65} />
            </mesh>
            <mesh position={[0, 0.41, 0.095]} rotation={[-0.35, 0, 0]}>
              <torusGeometry args={[0.095, 0.012, 8, 18, Math.PI]} />
              <meshStandardMaterial color="#6e3b1b" roughness={0.7} />
            </mesh>
            {/* Apron Brass Studs & Chest Pocket */}
            <mesh position={[0, 0.25, 0.126]}>
              <boxGeometry args={[0.13, 0.1, 0.01]} />
              <meshStandardMaterial color="#733e1c" roughness={0.65} />
            </mesh>
            {[-0.085, 0.085].map((bx, bIdx) => (
              <mesh key={bIdx} position={[bx, 0.36, 0.125]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshStandardMaterial
                  color="#d4af37"
                  metalness={0.75}
                  roughness={0.25}
                />
              </mesh>
            ))}

            {/* Head, Short Dark Hair & Matte Black Round Glasses */}
            <group ref={headRef} position={[0, 0.52, 0]}>
              {/* Neck */}
              <mesh position={[0, 0.03, 0]}>
                <cylinderGeometry args={[0.055, 0.065, 0.08, 12]} />
                <meshStandardMaterial color="#f0c8ab" roughness={0.65} />
              </mesh>
              {/* Head Sphere */}
              <mesh position={[0, 0.17, 0]} castShadow>
                <sphereGeometry args={[0.145, 24, 24]} />
                <meshStandardMaterial color="#f3ceb3" roughness={0.6} />
              </mesh>
              {/* Neat Dark Espresso Hair Cap & Parted Front Bangs */}
              <mesh position={[0, 0.215, -0.018]} castShadow>
                <sphereGeometry args={[0.152, 24, 24]} />
                <meshStandardMaterial color="#1c1715" roughness={0.85} />
              </mesh>
              <mesh
                position={[-0.02, 0.265, 0.088]}
                rotation={[0.25, 0, -0.08]}
                castShadow
              >
                <boxGeometry args={[0.22, 0.068, 0.1]} />
                <meshStandardMaterial color="#1c1715" roughness={0.85} />
              </mesh>
              {/* Eyes */}
              <mesh position={[0.048, 0.17, 0.132]}>
                <sphereGeometry args={[0.015, 10, 10]} />
                <meshBasicMaterial color="#1c1917" />
              </mesh>
              <mesh position={[-0.048, 0.17, 0.132]}>
                <sphereGeometry args={[0.015, 10, 10]} />
                <meshBasicMaterial color="#1c1917" />
              </mesh>
              {/* Black Round Horn-Rimmed Glasses */}
              <mesh position={[0.05, 0.17, 0.142]}>
                <torusGeometry args={[0.03, 0.005, 8, 20]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[-0.05, 0.17, 0.142]}>
                <torusGeometry args={[0.03, 0.005, 8, 20]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.172, 0.144]}>
                <boxGeometry args={[0.042, 0.006, 0.006]} />
                <meshStandardMaterial color="#18181b" roughness={0.35} />
              </mesh>
            </group>

            {/* Left Arm resting toward the desk */}
            <group
              position={[0.215, 0.4, 0]}
              rotation={[-0.42, 0, 0.08]}
            >
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.048, 0.16, 8, 12]} />
                <meshStandardMaterial color="#2f3a33" roughness={0.8} />
              </mesh>
              <group
                ref={leftForearmRef}
                position={[0, -0.22, 0]}
                rotation={[-0.95, 0, -0.12]}
              >
                <mesh position={[0, -0.1, 0]} castShadow>
                  <capsuleGeometry args={[0.042, 0.15, 8, 12]} />
                  <meshStandardMaterial color="#2f3a33" roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.21, 0]} castShadow>
                  <sphereGeometry args={[0.042, 12, 12]} />
                  <meshStandardMaterial color="#f3ceb3" roughness={0.6} />
                </mesh>
              </group>
            </group>

            {/* Right Arm resting toward the desk */}
            <group
              position={[-0.215, 0.4, 0]}
              rotation={[-0.42, 0, -0.08]}
            >
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.048, 0.16, 8, 12]} />
                <meshStandardMaterial color="#2f3a33" roughness={0.8} />
              </mesh>
              <group
                ref={rightForearmRef}
                position={[0, -0.22, 0]}
                rotation={[-0.95, 0, 0.12]}
              >
                <mesh position={[0, -0.1, 0]} castShadow>
                  <capsuleGeometry args={[0.042, 0.15, 8, 12]} />
                  <meshStandardMaterial color="#2f3a33" roughness={0.8} />
                </mesh>
                <mesh position={[0, -0.21, 0]} castShadow>
                  <sphereGeometry args={[0.042, 12, 12]} />
                  <meshStandardMaterial color="#f3ceb3" roughness={0.6} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Answer Speech Bubble (`대답 말풍선`) Floating Directly Above the Bookshop Owner's Head */}
      <Html position={[0, 1.24, 0]} zIndexRange={[80, 0]}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="-translate-x-1/2 -translate-y-full flex flex-col items-center pb-1 break-keep"
        >
          {!isTalking ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTalkClick();
                }}
                className={`pointer-events-auto cursor-pointer whitespace-nowrap rounded-2xl px-3.5 py-1.5 text-xs text-white shadow-lg backdrop-blur-md transition ${
                  hovered
                    ? 'bg-neutral-950/78 scale-105'
                    : 'bg-neutral-950/58 hover:bg-neutral-950/75'
                }`}
              >
                책방지기 · 말걸기
              </button>
              <div className="h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-neutral-950/65" />
            </>
          ) : (
            <>
              <div className="pointer-events-none w-max max-w-[190px] sm:max-w-[245px] rounded-2xl bg-neutral-950/82 px-3.5 py-2.5 text-white shadow-2xl backdrop-blur-xl">
                <div className="text-[11px] text-white/60">책방지기</div>
                <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-white">
                  {activeAnswer ?? '무엇이 궁금하신가요?'}
                </p>
              </div>
              <div className="h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-neutral-950/82" />
            </>
          )}
        </div>
      </Html>
    </group>
  );
};
