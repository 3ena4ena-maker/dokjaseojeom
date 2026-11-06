import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  CHARACTER_START_POSITION,
  CHARACTER_START_ROTATION_Y,
  SEAT_OBJECTS,
  STAMP_MISSIONS,
  StampMissionData,
} from './data/bookstoreData';
import {
  ActivePromptType,
  BookItem,
  CharacterActionState,
  GenreShelfData,
  SeatObjectData,
  SpaceStoryData,
  TableObjectData,
  WaypointNode,
} from './types';
import { findNavigationPath } from './systems/collisionAndNav';
import { bookstoreBgm } from './systems/bookstoreBgm';
import { Character3D } from './components/Character3D';
import { BookstoreEnvironment3D } from './components/BookstoreEnvironment3D';
import { SceneController } from './components/SceneController';
import { BookstoreHUD } from './components/BookstoreHUD';

export function App() {
  // Mutable refs for 60fps 3D character & camera transforms
  const positionRef = useRef<[number, number, number]>([
    ...CHARACTER_START_POSITION,
  ]);
  const rotationYRef = useRef<number>(CHARACTER_START_ROTATION_Y);
  const cameraYawRef = useRef<number>(0); // 0 means camera is at +Z looking toward -Z (from road toward Dokja entrance)
  const cameraPitchRef = useRef<number>(0.28);
  const cameraDistanceRef = useRef<number>(2.95);
  const joystickVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const navPathRef = useRef<Array<[number, number]>>([]);
  const pendingArrivalRef = useRef<(() => void) | null>(null);
  const interactionProgressRef = useRef<number>(0);

  // React state for UI & Character State Machine
  const [characterPos, setCharacterPos] = useState<[number, number, number]>([
    ...CHARACTER_START_POSITION,
  ]);
  const [cameraDistance, setCameraDistance] = useState<number>(2.95);
  const [actionState, setActionState] = useState<CharacterActionState>('IDLE');
  const [isSeated, setIsSeated] = useState<boolean>(false);
  const [activeSeat, setActiveSeat] = useState<SeatObjectData | null>(null);
  const [heldBook, setHeldBook] = useState<BookItem | null>(null);
  const [activeGenreShelf, setActiveGenreShelf] =
    useState<GenreShelfData | null>(null);
  // Explicit shelf browser modal (only opened on user action, never auto-blocking the side of the screen)
  const [browsingShelf, setBrowsingShelf] =
    useState<GenreShelfData | null>(null);
  const [nearbyBookId, setNearbyBookId] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<ActivePromptType | null>(
    null
  );

  // Modals & Interactive Object States
  const [inspectingBook, setInspectingBook] = useState<BookItem | null>(null);
  const [isReadingModalOpen, setIsReadingModalOpen] = useState<boolean>(false);
  const [inspectingTable, setInspectingTable] =
    useState<TableObjectData | null>(null);
  const [inspectingStory, setInspectingStory] =
    useState<SpaceStoryData | null>(null);
  const [tablePlacedBooks, setTablePlacedBooks] = useState<
    Record<string, BookItem | null>
  >({});
  const [windowLampOn, setWindowLampOn] = useState<boolean>(true);
  const [bgmPlaying, setBgmPlaying] = useState<boolean>(false);
  const userMutedBgmRef = useRef<boolean>(false);
  const [asmrLevels, setAsmrLevels] = useState<{
    rain: number;
    paper: number;
    fireplace: number;
  }>({ rain: 0, paper: 0, fireplace: 0 });
  const [collectedStampIds, setCollectedStampIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dokja_hidden_stamps_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toastMessage, setToastMessage] = useState<string | null>(
    '독자서점 외부 도로에 도착했습니다. 계단과 열린 출입문을 통해 서점 안으로 걸어 들어가 보세요!'
  );

  // Sync character Z coordinate to spatial BGM engine (soft/muffled on road -> warm fade-in inside store)
  useEffect(() => {
    bookstoreBgm.setCharacterZ(characterPos[2]);
  }, [characterPos]);

  // Auto-start soft road BGM + ASMR on first user gesture (unless explicitly muted via the sound icon)
  useEffect(() => {
    const unlockAudioOnFirstGesture = () => {
      if (!userMutedBgmRef.current && !bookstoreBgm.getIsEnabled()) {
        const started = bookstoreBgm.start();
        if (started) {
          setBgmPlaying(true);
          setAsmrLevels(bookstoreBgm.getAsmrLevels());
        }
      }
    };
    window.addEventListener('pointerdown', unlockAudioOnFirstGesture, {
      passive: true,
    });
    window.addEventListener('keydown', unlockAudioOnFirstGesture, {
      passive: true,
    });
    return () => {
      window.removeEventListener('pointerdown', unlockAudioOnFirstGesture);
      window.removeEventListener('keydown', unlockAudioOnFirstGesture);
    };
  }, []);

  const handleToggleBgm = useCallback(() => {
    const nextPlaying = bookstoreBgm.toggle();
    userMutedBgmRef.current = !nextPlaying;
    setBgmPlaying(nextPlaying);
    setAsmrLevels(bookstoreBgm.getAsmrLevels());
    setToastMessage(
      nextPlaying
        ? '🔊 서점 배경음악 & ASMR(빗소리·책장·모닥불)을 함께 켰습니다.'
        : '🔇 서점 배경음악 & ASMR을 모두 껐습니다.'
    );
  }, []);

  // Visual path indicators on the floor
  const [navTarget, setNavTarget] = useState<[number, number] | null>(null);
  const [navPathVisual, setNavPathVisual] = useState<Array<[number, number]>>(
    []
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  // Unlock a hidden-object stamp mission when the user directly spots and taps it in 3D
  const unlockStampMission = useCallback((mission: StampMissionData) => {
    setCollectedStampIds((prev) => {
      if (prev.includes(mission.id)) {
        setToastMessage(
          `✅ 이미 찾은 숨은그림입니다: ${mission.icon} ${mission.title}`
        );
        return prev;
      }
      const next = [...prev, mission.id];
      try {
        localStorage.setItem('dokja_hidden_stamps_v2', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      bookstoreBgm.playStampCollectedChime();
      if (next.length >= STAMP_MISSIONS.length) {
        setToastMessage(
          `🎉 숨은그림찾기 5개 모두 발견! (${next.length}/${STAMP_MISSIONS.length}) 서점 방문 시 스티커를 제공해 드립니다!`
        );
      } else {
        setToastMessage(
          `🔍 숨은그림 발견! (${next.length}/${STAMP_MISSIONS.length}) — ${mission.icon} ${mission.title}`
        );
      }
      return next;
    });
  }, []);

  const handleFindHiddenStamp = useCallback(
    (missionId: string) => {
      const matched = STAMP_MISSIONS.find((m) => m.id === missionId);
      if (matched) {
        unlockStampMission(matched);
      }
    },
    [unlockStampMission]
  );

  // Unlock stamp if a linked book (e.g. 『작지만, 독자』) is selected
  const unlockStampByLinkedId = useCallback(
    (linkedId: string) => {
      const matched = STAMP_MISSIONS.find((m) =>
        m.linkedIds.includes(linkedId)
      );
      if (matched) {
        unlockStampMission(matched);
      }
    },
    [unlockStampMission]
  );

  const handleChangeAsmrLevels = useCallback(
    (next: { rain: number; paper: number; fireplace: number }) => {
      setAsmrLevels(next);
      bookstoreBgm.setAsmrLevels(next);
    },
    []
  );

  const handleReadingTimerComplete = useCallback((minutes: number) => {
    bookstoreBgm.playTimerCompleteChime();
    setToastMessage(
      `🔔 ${minutes}분간의 독자서점 집중 독서 시간이 완료되었습니다! 잠시 눈을 쉬어 주세요.`
    );
  }, []);

  const handleResetStamps = useCallback(() => {
    setCollectedStampIds([]);
    try {
      localStorage.removeItem('dokja_hidden_stamps_v2');
    } catch {
      // ignore
    }
    setToastMessage('🔄 독자서점 숨은그림찾기 스탬프를 초기화했습니다.');
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleClearNavVisuals = useCallback(() => {
    setNavTarget(null);
    setNavPathVisual([]);
  }, []);

  // Stand up from current chair / bench / stool
  const handleStandUp = useCallback(() => {
    if (activeSeat) {
      positionRef.current = [
        activeSeat.approachPoint[0],
        0,
        activeSeat.approachPoint[2],
      ];
      setCharacterPos([...positionRef.current]);
    }
    setIsSeated(false);
    setActiveSeat(null);
    setIsReadingModalOpen(false);
    setActionState('IDLE');
  }, [activeSeat]);

  // Walk to a target [x, z] using A* obstacle avoidance and optionally run an action on arrival
  const walkToAndExecute = useCallback(
    (targetX: number, targetZ: number, onArrive?: () => void) => {
      if (actionState === 'INTERACTING') return;

      let startX = positionRef.current[0];
      let startZ = positionRef.current[2];

      if (isSeated && activeSeat) {
        startX = activeSeat.approachPoint[0];
        startZ = activeSeat.approachPoint[2];
        positionRef.current = [startX, 0, startZ];
        setIsSeated(false);
        setActiveSeat(null);
        setIsReadingModalOpen(false);
      }

      const dist = Math.hypot(targetX - startX, targetZ - startZ);
      if (dist < 0.32) {
        navPathRef.current = [];
        pendingArrivalRef.current = null;
        handleClearNavVisuals();
        if (onArrive) {
          onArrive();
        } else {
          setActionState('IDLE');
        }
        return;
      }

      const path = findNavigationPath(startX, startZ, targetX, targetZ);
      if (path.length === 0) return;

      navPathRef.current = path;
      pendingArrivalRef.current = onArrive ?? null;
      setNavTarget(path[path.length - 1]);
      setNavPathVisual(path);
      setActionState('WALKING');
    },
    [actionState, isSeated, activeSeat, handleClearNavVisuals]
  );

  // Triggered automatically when the character crosses from the outdoor road through the '독자' entrance door
  const handleEnteredStore = useCallback(() => {
    cameraYawRef.current = 0;
    cameraPitchRef.current = 0.28;
    cameraDistanceRef.current = 3.1;
    setCameraDistance(3.1);
    bookstoreBgm.triggerEnterStoreSwell();
    showToast(
      '✨ 독자서점 내부로 들어왔습니다! 잔잔한 재즈 피아노 선율과 함께 서점 공간이 한눈에 펼쳐집니다.'
    );
  }, [showToast]);

  // Quick button: walk from road outside through the open door into the entrance hall & show panoramic interior view
  const handleEnterStoreFromRoad = useCallback(() => {
    if (actionState === 'INTERACTING') return;
    setBrowsingShelf(null);
    setInspectingBook(null);
    setInspectingTable(null);
    setInspectingStory(null);
    showToast('🚪 도로에서 계단을 올라 독자서점 출입문 안으로 들어갑니다.');
    walkToAndExecute(0.15, 4.95, () => {
      rotationYRef.current = Math.PI;
      cameraYawRef.current = 0;
      cameraPitchRef.current = 0.28;
      cameraDistanceRef.current = 3.1;
      setCameraDistance(3.1);
      setActionState('IDLE');
    });
  }, [actionState, walkToAndExecute, showToast]);

  // Frame the entire Dokja interior at a single glance
  const handleSetPanoramicInteriorView = useCallback(() => {
    if (positionRef.current[2] > 6.2) {
      handleEnterStoreFromRoad();
      return;
    }
    rotationYRef.current = Math.PI;
    cameraYawRef.current = 0;
    cameraPitchRef.current = 0.28;
    cameraDistanceRef.current = 3.1;
    setCameraDistance(3.1);
    showToast('👁️ 독자서점 내부가 한눈에 보이도록 시점을 정렬했습니다.');
  }, [handleEnterStoreFromRoad, showToast]);

  // Floor Click (Roadview-style click movement)
  const handleFloorClick = useCallback(
    (x: number, z: number) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingTable(null);
      setInspectingStory(null);
      setIsReadingModalOpen(false);
      walkToAndExecute(x, z);
    },
    [actionState, walkToAndExecute]
  );

  // Waypoint Click
  const handleSelectWaypoint = useCallback(
    (wp: WaypointNode) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      showToast(`👣 '${wp.label}' 지점으로 이동합니다.`);
      walkToAndExecute(wp.position[0], wp.position[2]);
    },
    [actionState, walkToAndExecute, showToast]
  );

  // Genre Bookshelf Selection (walks to shelf and aligns gaze with the shelf without auto-blocking the screen)
  const handleSelectGenreShelf = useCallback(
    (shelf: GenreShelfData) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingTable(null);
      setInspectingStory(null);
      showToast(`📚 '${shelf.name}' 서가로 이동합니다.`);
      walkToAndExecute(
        shelf.interactionPoint[0],
        shelf.interactionPoint[2],
        () => {
          rotationYRef.current = shelf.interactionFacingY;
          setActiveGenreShelf(shelf);
          setActionState('IDLE');
        }
      );
    },
    [actionState, walkToAndExecute, showToast]
  );

  // Book Selection: 7-Step Process (Approach -> Reach Animation -> Hold in Hand -> Show Details)
  const handleSelectBook = useCallback(
    (book: BookItem) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      unlockStampByLinkedId(book.id);

      // If already holding this exact book, open its details modal directly
      if (heldBook?.id === book.id) {
        setInspectingBook(book);
        return;
      }

      setInspectingTable(null);
      setInspectingStory(null);
      setIsReadingModalOpen(false);

      walkToAndExecute(
        book.interactionPoint[0],
        book.interactionPoint[2],
        () => {
          rotationYRef.current = book.interactionFacingY;
          interactionProgressRef.current = 0;
          setActionState('INTERACTING');
          showToast(`✨ 책장에서 『${book.title}』 도서를 꺼냅니다...`);

          setTablePlacedBooks((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((tid) => {
              if (next[tid]?.id === book.id) {
                next[tid] = null;
              }
            });
            return next;
          });

          setTimeout(() => {
            setHeldBook(book);
            setActionState('IDLE');
            setInspectingBook(book);
          }, 580);
        }
      );
    },
    [actionState, heldBook, walkToAndExecute, showToast, unlockStampByLinkedId]
  );

  // Return currently held book back to its bookshelf
  const handleReturnHeldBook = useCallback(() => {
    if (!heldBook || actionState === 'INTERACTING') return;
    const title = heldBook.title;
    setInspectingBook(null);
    setIsReadingModalOpen(false);
    setHeldBook(null);
    if (isSeated) {
      setActionState('SITTING');
    } else {
      setActionState('IDLE');
    }
    showToast(`📕 『${title}』 도서를 다시 책장에 꽂았습니다.`);
  }, [heldBook, actionState, isSeated, showToast]);

  // Sit on a Chair, Wooden Bench Sofa, or Yellow Stool
  const handleSitOnSeat = useCallback(
    (seat: SeatObjectData, andReadAfter = false) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingTable(null);
      setInspectingStory(null);

      walkToAndExecute(seat.approachPoint[0], seat.approachPoint[2], () => {
        positionRef.current = [
          seat.seatPosition[0],
          0,
          seat.seatPosition[2],
        ];
        setCharacterPos([...positionRef.current]);
        rotationYRef.current = seat.seatFacingY;
        setIsSeated(true);
        setActiveSeat(seat);

        if (andReadAfter && heldBook) {
          setActionState('READING');
          setIsReadingModalOpen(true);
          showToast(
            `🪑 ${seat.name}에 앉아 『${heldBook.title}』 독서를 시작합니다.`
          );
        } else {
          setActionState('SITTING');
          showToast(`🪑 ${seat.name}에 앉았습니다. 독서 타이머 & ASMR로 여유롭게 머물러 보세요!`);
        }
        unlockStampByLinkedId(seat.id);
      });
    },
    [actionState, heldBook, walkToAndExecute, showToast, unlockStampByLinkedId]
  );

  // Find nearest seat, walk there, sit down, and start reading held book
  const handleSitAndReadNearest = useCallback(() => {
    if (actionState === 'INTERACTING') return;
    const [cx, , cz] = positionRef.current;
    let nearest = SEAT_OBJECTS[0];
    let bestDist = Infinity;
    for (const s of SEAT_OBJECTS) {
      const d = Math.hypot(cx - s.seatPosition[0], cz - s.seatPosition[2]);
      if (d < bestDist) {
        bestDist = d;
        nearest = s;
      }
    }
    handleSitOnSeat(nearest, true);
  }, [actionState, handleSitOnSeat]);

  // Start / Stop Reading Animation & Spread View
  const handleStartReading = useCallback(() => {
    if (!heldBook || actionState === 'INTERACTING') return;
    setBrowsingShelf(null);
    setInspectingBook(null);
    setActionState('READING');
    setIsReadingModalOpen(true);
    showToast(
      isSeated
        ? `📖 의자에 앉아 『${heldBook.title}』을(를) 읽습니다.`
        : `📖 『${heldBook.title}』을(를) 펼쳐 읽습니다.`
    );
  }, [heldBook, actionState, isSeated, showToast]);

  const handleStopReading = useCallback(() => {
    setIsReadingModalOpen(false);
    setActionState(isSeated ? 'SITTING' : 'IDLE');
  }, [isSeated]);

  // Table Interaction
  const handleSelectTable = useCallback(
    (table: TableObjectData) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingStory(null);
      setIsReadingModalOpen(false);

      walkToAndExecute(table.approachPoint[0], table.approachPoint[2], () => {
        rotationYRef.current = table.approachFacingY;
        setActionState('IDLE');
        setInspectingTable(table);
        unlockStampByLinkedId(table.id);
      });
    },
    [actionState, walkToAndExecute, unlockStampByLinkedId]
  );

  const handlePlaceBookOnTable = useCallback(
    (tableId: string) => {
      if (!heldBook) return;
      const book = heldBook;
      setTablePlacedBooks((prev) => ({ ...prev, [tableId]: book }));
      setHeldBook(null);
      showToast(`📕 『${book.title}』 도서를 테이블 위에 내려놓았습니다.`);
    },
    [heldBook, showToast]
  );

  const handlePickBookFromTable = useCallback(
    (tableId: string) => {
      const book = tablePlacedBooks[tableId];
      if (!book) return;
      setTablePlacedBooks((prev) => ({ ...prev, [tableId]: null }));
      setHeldBook(book);
      showToast(`📕 테이블에서 『${book.title}』 도서를 다시 손에 들었습니다.`);
    },
    [tablePlacedBooks, showToast]
  );

  // Space Story Inspection
  const handleSelectStory = useCallback(
    (story: SpaceStoryData) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingTable(null);
      setIsReadingModalOpen(false);

      walkToAndExecute(story.approachPoint[0], story.approachPoint[2], () => {
        rotationYRef.current = story.approachFacingY;
        setActionState('IDLE');
        setInspectingStory(story);
        unlockStampByLinkedId(story.id);
      });
    },
    [actionState, walkToAndExecute, unlockStampByLinkedId]
  );

  // Walk directly to a signature stamp mission spot from the Stamp Tour card
  const handleWalkToStampMission = useCallback(
    (mission: StampMissionData) => {
      if (actionState === 'INTERACTING') return;
      setBrowsingShelf(null);
      setInspectingBook(null);
      setInspectingTable(null);
      setInspectingStory(null);
      showToast(`👣 '${mission.title}' 장소로 걸어갑니다...`);
      walkToAndExecute(
        mission.targetPosition[0],
        mission.targetPosition[1],
        () => {
          setActionState('IDLE');
          unlockStampMission(mission);
        }
      );
    },
    [actionState, walkToAndExecute, showToast, unlockStampMission]
  );

  // Trigger Contextual [E] Prompt Action
  const handleTriggerPromptAction = useCallback(() => {
    if (!activePrompt || actionState === 'INTERACTING') return;
    if (activePrompt.kind === 'book') {
      handleSelectBook(activePrompt.book);
    } else if (activePrompt.kind === 'seat') {
      handleSitOnSeat(activePrompt.seat);
    } else if (activePrompt.kind === 'table') {
      handleSelectTable(activePrompt.table);
    } else if (activePrompt.kind === 'shelf') {
      setBrowsingShelf(activePrompt.shelf);
    } else if (activePrompt.kind === 'story') {
      handleSelectStory(activePrompt.story);
    }
  }, [
    activePrompt,
    actionState,
    handleSelectBook,
    handleSitOnSeat,
    handleSelectTable,
    handleSelectStory,
  ]);

  // Global Keyboard Shortcuts: E (Interact), R (Read), Q (Return Book), Space (Stand Up), Escape (Close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        handleTriggerPromptAction();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (actionState === 'READING') {
          handleStopReading();
        } else if (heldBook) {
          handleStartReading();
        }
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        if (heldBook) {
          handleReturnHeldBook();
        }
      } else if (e.code === 'Space') {
        if (isSeated) {
          e.preventDefault();
          handleStandUp();
        }
      } else if (e.code === 'Escape') {
        setBrowsingShelf(null);
        setInspectingBook(null);
        setInspectingTable(null);
        setInspectingStory(null);
        if (actionState === 'READING') {
          handleStopReading();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    actionState,
    heldBook,
    isSeated,
    handleTriggerPromptAction,
    handleStartReading,
    handleStopReading,
    handleReturnHeldBook,
    handleStandUp,
  ]);

  const handleZoomCamera = useCallback((delta: number) => {
    const next = Math.max(
      0.9,
      Math.min(4.2, cameraDistanceRef.current + delta)
    );
    cameraDistanceRef.current = next;
    setCameraDistance(next);
  }, []);

  const handleSetCameraDistance = useCallback((dist: number) => {
    const next = Math.max(0.9, Math.min(4.2, dist));
    cameraDistanceRef.current = next;
    setCameraDistance(next);
  }, []);

  const handleResetCamera = useCallback(() => {
    let alignedYaw = (rotationYRef.current - Math.PI) % (Math.PI * 2);
    if (alignedYaw > Math.PI) alignedYaw -= Math.PI * 2;
    if (alignedYaw < -Math.PI) alignedYaw += Math.PI * 2;
    cameraYawRef.current = alignedYaw;
    cameraPitchRef.current = 0.28;
    const defaultDist = positionRef.current[2] > 6.55 ? 2.95 : 3.1;
    cameraDistanceRef.current = defaultDist;
    setCameraDistance(defaultDist);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#14110f] select-none touch-none">
      {/* Toast Notification Banner (Shown on desktop, and also on mobile when a Stamp or Timer event occurs) */}
      {toastMessage && (
        <div
          className={`pointer-events-none fixed left-1/2 top-14 sm:top-16 z-40 -translate-x-1/2 max-w-[92vw] truncate rounded-full bg-[#191310]/92 px-3.5 py-1 text-[11px] sm:text-xs font-medium text-[#fde68a] shadow-xl border border-[#d4af37]/40 backdrop-blur-md transition-all ${
            toastMessage.startsWith('🔍') ||
            toastMessage.startsWith('🏅') ||
            toastMessage.startsWith('🎉') ||
            toastMessage.startsWith('🔔') ||
            toastMessage.startsWith('🔊') ||
            toastMessage.startsWith('🔇')
              ? 'block'
              : 'hidden sm:block'
          }`}
        >
          {toastMessage}
        </div>
      )}

      {/* 3D Interactive Bookstore Scene */}
      <Canvas
        shadows
        camera={{ position: [0.15, 2.0, 11.4], fov: 56, near: 0.1, far: 55 }}
      >
        <color attach="background" args={['#181310']} />
        <fog attach="fog" args={['#1d1612', 14, 30]} />

        <SceneController
          positionRef={positionRef}
          rotationYRef={rotationYRef}
          cameraYawRef={cameraYawRef}
          cameraPitchRef={cameraPitchRef}
          cameraDistanceRef={cameraDistanceRef}
          joystickVectorRef={joystickVectorRef}
          navPathRef={navPathRef}
          pendingArrivalRef={pendingArrivalRef}
          interactionProgressRef={interactionProgressRef}
          actionState={actionState}
          isSeated={isSeated}
          heldBook={heldBook}
          onSyncCharacterPos={setCharacterPos}
          onSyncCameraDistance={setCameraDistance}
          onActionStateChange={setActionState}
          onStandUp={handleStandUp}
          onClearNavVisuals={handleClearNavVisuals}
          onUpdateActiveShelf={setActiveGenreShelf}
          onUpdateNearbyBookId={setNearbyBookId}
          onUpdateActivePrompt={setActivePrompt}
          onEnteredStore={handleEnteredStore}
        />

        <Character3D
          positionRef={positionRef}
          rotationYRef={rotationYRef}
          actionState={actionState}
          isSeated={isSeated}
          heldBook={heldBook}
          interactionProgressRef={interactionProgressRef}
        />

        <BookstoreEnvironment3D
          characterPos={characterPos}
          activeGenreShelf={activeGenreShelf}
          nearbyBookId={nearbyBookId}
          heldBook={heldBook}
          tablePlacedBooks={tablePlacedBooks}
          activeSeatId={activeSeat?.id ?? null}
          navTarget={navTarget}
          navPath={navPathVisual}
          windowLampOn={windowLampOn}
          onFloorClick={handleFloorClick}
          onSelectBook={handleSelectBook}
          onSelectGenreShelf={handleSelectGenreShelf}
          onSelectSeat={(seat) => handleSitOnSeat(seat)}
          onSelectTable={handleSelectTable}
          onSelectStory={handleSelectStory}
          onSelectWaypoint={handleSelectWaypoint}
          collectedStampIds={collectedStampIds}
          onFindHiddenStamp={handleFindHiddenStamp}
        />
      </Canvas>

      {/* 2D UI & Contextual Interaction Overlay */}
      <BookstoreHUD
        characterPos={characterPos}
        actionState={actionState}
        isSeated={isSeated}
        activeSeat={activeSeat}
        heldBook={heldBook}
        activeGenreShelf={activeGenreShelf}
        browsingShelf={browsingShelf}
        activePrompt={activePrompt}
        inspectingBook={inspectingBook}
        isReadingModalOpen={isReadingModalOpen}
        inspectingTable={inspectingTable}
        inspectingStory={inspectingStory}
        tablePlacedBooks={tablePlacedBooks}
        windowLampOn={windowLampOn}
        cameraDistance={cameraDistance}
        joystickVectorRef={joystickVectorRef}
        onTriggerPromptAction={handleTriggerPromptAction}
        onSelectGenreShelf={handleSelectGenreShelf}
        onOpenBrowsingShelf={setBrowsingShelf}
        onCloseBrowsingShelf={() => setBrowsingShelf(null)}
        onSelectBook={handleSelectBook}
        onReturnHeldBook={handleReturnHeldBook}
        onStartReading={handleStartReading}
        onStopReading={handleStopReading}
        onSitOnSeat={(seat) => handleSitOnSeat(seat)}
        onSitAndReadNearest={handleSitAndReadNearest}
        onStandUp={handleStandUp}
        onPlaceBookOnTable={handlePlaceBookOnTable}
        onPickBookFromTable={handlePickBookFromTable}
        onToggleWindowLamp={() => setWindowLampOn((v) => !v)}
        onCloseBookDetail={() => setInspectingBook(null)}
        onCloseTableModal={() => setInspectingTable(null)}
        onCloseStoryModal={() => setInspectingStory(null)}
        onOpenStoryModal={handleSelectStory}
        onSelectWaypoint={handleSelectWaypoint}
        onZoomCamera={handleZoomCamera}
        onSetCameraDistance={handleSetCameraDistance}
        onResetCamera={handleResetCamera}
        onSetPanoramicInteriorView={handleSetPanoramicInteriorView}
        onEnterStoreFromRoad={handleEnterStoreFromRoad}
        bgmPlaying={bgmPlaying}
        onToggleBgm={handleToggleBgm}
        asmrLevels={asmrLevels}
        onChangeAsmrLevels={handleChangeAsmrLevels}
        onReadingTimerComplete={handleReadingTimerComplete}
        collectedStampIds={collectedStampIds}
        onWalkToStampMission={handleWalkToStampMission}
        onResetStamps={handleResetStamps}
      />
    </div>
  );
}

export default App;
