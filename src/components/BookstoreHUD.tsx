import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  DoorOpen,
  Eye,
  HelpCircle,
  Info,
  Lamp,
  MapPin,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  REPRESENTATIVE_BOOKS,
  SEAT_OBJECTS,
  SPACE_STORIES,
  STAMP_MISSIONS,
  StampMissionData,
  WAYPOINT_NODES,
} from '../data/bookstoreData';
import {
  ActivePromptType,
  BookItem,
  CharacterActionState,
  GenreShelfData,
  SeatObjectData,
  SpaceStoryData,
  TableObjectData,
  WaypointNode,
} from '../types';
import { OWNER_QA_ITEMS } from './BookshopOwner3D';

interface BookstoreHUDProps {
  characterPos: [number, number, number];
  actionState: CharacterActionState;
  isSeated: boolean;
  activeSeat: SeatObjectData | null;
  heldBook: BookItem | null;
  activeGenreShelf: GenreShelfData | null;
  browsingShelf: GenreShelfData | null;
  activePrompt: ActivePromptType | null;
  inspectingBook: BookItem | null;
  isReadingModalOpen: boolean;
  inspectingTable: TableObjectData | null;
  inspectingStory: SpaceStoryData | null;
  tablePlacedBooks: Record<string, BookItem | null>;
  windowLampOn: boolean;
  cameraDistance: number;
  joystickVectorRef: React.MutableRefObject<{ x: number; y: number }>;
  onTriggerPromptAction: () => void;
  onSelectGenreShelf: (shelf: GenreShelfData) => void;
  onOpenBrowsingShelf: (shelf: GenreShelfData) => void;
  onCloseBrowsingShelf: () => void;
  onSelectBook: (book: BookItem) => void;
  onReturnHeldBook: () => void;
  onStartReading: () => void;
  onStopReading: () => void;
  onSitOnSeat: (seat: SeatObjectData) => void;
  onSitAndReadNearest: () => void;
  onStandUp: () => void;
  onPlaceBookOnTable: (tableId: string) => void;
  onPickBookFromTable: (tableId: string) => void;
  onToggleWindowLamp: () => void;
  onCloseBookDetail: () => void;
  onCloseTableModal: () => void;
  onCloseStoryModal: () => void;
  onOpenStoryModal: (story: SpaceStoryData) => void;
  onSelectWaypoint: (wp: WaypointNode) => void;
  onZoomCamera: (delta: number) => void;
  onSetCameraDistance: (dist: number) => void;
  onResetCamera: () => void;
  onSetPanoramicInteriorView: () => void;
  onEnterStoreFromRoad: () => void;
  bgmPlaying: boolean;
  onToggleBgm: () => void;
  asmrLevels: { rain: number; paper: number; fireplace: number };
  onChangeAsmrLevels: (next: {
    rain: number;
    paper: number;
    fireplace: number;
  }) => void;
  onReadingTimerComplete: (minutes: number) => void;
  collectedStampIds: string[];
  onWalkToStampMission: (mission: StampMissionData) => void;
  onResetStamps: () => void;
  isTalkingToOwner?: boolean;
  selectedOwnerQuestionIdx?: number | null;
  onSelectOwnerQuestion?: (idx: number) => void;
  onCloseOwnerTalk?: () => void;
}

export const BookstoreHUD: React.FC<BookstoreHUDProps> = ({
  characterPos,
  actionState,
  isSeated,
  activeSeat,
  heldBook,
  browsingShelf,
  activePrompt,
  inspectingBook,
  isReadingModalOpen,
  inspectingTable,
  inspectingStory,
  tablePlacedBooks,
  windowLampOn,
  cameraDistance,
  joystickVectorRef,
  onTriggerPromptAction,
  onCloseBrowsingShelf,
  onSelectBook,
  onReturnHeldBook,
  onStartReading,
  onStopReading,
  onSitOnSeat,
  onSitAndReadNearest,
  onStandUp,
  onPlaceBookOnTable,
  onPickBookFromTable,
  onToggleWindowLamp,
  onCloseBookDetail,
  onCloseTableModal,
  onCloseStoryModal,
  onOpenStoryModal,
  onSelectWaypoint,
  onZoomCamera,
  onSetCameraDistance,
  onResetCamera,
  onSetPanoramicInteriorView,
  onEnterStoreFromRoad,
  bgmPlaying,
  onToggleBgm,
  onReadingTimerComplete,
  collectedStampIds,
  onResetStamps,
  isTalkingToOwner = false,
  selectedOwnerQuestionIdx = null,
  onSelectOwnerQuestion,
  onCloseOwnerTalk,
}) => {
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(true);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showTimerAsmrModal, setShowTimerAsmrModal] = useState(false);
  const [showStampTourModal, setShowStampTourModal] = useState(false);

  // Reading Focus Timer State (10 / 25 / 45 min Pomodoro)
  const [timerDurationMinutes, setTimerDurationMinutes] = useState<10 | 25 | 45>(
    25
  );
  const [timerRemainingSec, setTimerRemainingSec] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerRemainingSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setCompletedSessions((c) => c + 1);
          onReadingTimerComplete(timerDurationMinutes);
          return timerDurationMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerDurationMinutes, onReadingTimerComplete]);

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const browsingShelfBooks = browsingShelf
    ? REPRESENTATIVE_BOOKS.filter((b) => b.genreId === browsingShelf.id)
    : [];

  const isOutsideOnRoad = characterPos[2] > 6.55;

  // Convert character world [X: -4.6..4.6, Z: -6.8..10.2] to percentage on minimap
  const mapPercentX = Math.max(
    5,
    Math.min(95, ((characterPos[0] + 4.6) / 9.2) * 100)
  );
  const mapPercentY = Math.max(
    4,
    Math.min(96, ((characterPos[2] + 6.8) / 17.0) * 100)
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-2 sm:p-4 break-keep">
      {/* ============================================================
          SINGLE COMPACT TOP ROW: BORDERLESS SEMI-TRANSPARENT BRAND & TOOLS
         ============================================================ */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Compact Brand Box (Removed '독자' square prefix, single-line '독자서점') */}
        <div className="pointer-events-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-[6px] bg-black/42 px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-md backdrop-blur-md">
          <span className="whitespace-nowrap text-xs sm:text-sm tracking-wide text-white/95">
            독자서점
          </span>
          <span className="hidden md:inline-block whitespace-nowrap text-xs text-white/70">
            · 독립서점 & 가죽공방 딤프치
          </span>
        </div>

        {/* Right: Minimal Action Icons (No-wrap single-line buttons on mobile) */}
        <div className="pointer-events-auto min-w-0 overflow-x-auto no-scrollbar flex items-center gap-0.5 sm:gap-1 rounded-[6px] bg-black/42 px-1.5 sm:px-2 py-1 shadow-md backdrop-blur-md">
          {isOutsideOnRoad ? (
            <button
              type="button"
              data-testid="enter-store-btn"
              onClick={onEnterStoreFromRoad}
              className="shrink-0 whitespace-nowrap flex items-center gap-1 rounded-[4px] bg-white/20 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs text-white hover:bg-white/30 transition cursor-pointer"
            >
              <DoorOpen className="h-3.5 w-3.5 shrink-0" />
              <span>입구 입장</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="panoramic-view-btn"
              onClick={onSetPanoramicInteriorView}
              title="독자 내부 한눈에 보기"
              className="shrink-0 whitespace-nowrap flex items-center gap-1 rounded-[4px] bg-white/12 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs text-white/90 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <Maximize2 className="h-3 w-3 shrink-0" />
              <span>한눈에 보기</span>
            </button>
          )}

          {/* Desktop-only Zoom Controls */}
          <div className="hidden sm:flex shrink-0 items-center gap-1 rounded-[4px] bg-white/10 px-2 py-0.5">
            <button
              type="button"
              data-testid="zoom-in-btn"
              onClick={() => onZoomCamera(-0.45)}
              title="공간 확대"
              className="flex h-5 w-5 items-center justify-center rounded-[3px] text-white/85 hover:bg-white/20 hover:text-white transition cursor-pointer"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
            <input
              type="range"
              data-testid="zoom-slider"
              min={0.9}
              max={4.2}
              step={0.1}
              value={cameraDistance}
              onChange={(e) => onSetCameraDistance(parseFloat(e.target.value))}
              aria-label="공간 확대 축소 슬라이더"
              className="h-1 w-20 cursor-pointer accent-white"
            />
            <button
              type="button"
              data-testid="zoom-out-btn"
              onClick={() => onZoomCamera(0.45)}
              title="공간 축소"
              className="flex h-5 w-5 items-center justify-center rounded-[3px] text-white/85 hover:bg-white/20 hover:text-white transition cursor-pointer"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onResetCamera}
              title="시점 초기화"
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-[3px] text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Unified Sound On/Off Button */}
          <button
            type="button"
            data-testid="bgm-toggle-btn"
            onClick={onToggleBgm}
            title={bgmPlaying ? '사운드 끄기' : '사운드 켜기'}
            aria-label={bgmPlaying ? '사운드 끄기' : '사운드 켜기'}
            className={`shrink-0 whitespace-nowrap flex h-6 w-6 md:h-auto md:w-auto items-center justify-center md:gap-1 rounded-[4px] md:px-2 md:py-1 text-xs transition cursor-pointer ${
              bgmPlaying
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
            }`}
          >
            {bgmPlaying ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="hidden md:inline">
              {bgmPlaying ? '사운드 켜짐' : '사운드 꺼짐'}
            </span>
          </button>

          {/* Reading Focus Timer Button */}
          <button
            type="button"
            data-testid="timer-asmr-btn"
            onClick={() => setShowTimerAsmrModal(true)}
            title="독서 타이머"
            className={`shrink-0 whitespace-nowrap flex h-6 md:h-auto items-center justify-center gap-1 rounded-[4px] px-1.5 sm:px-2 md:py-1 text-xs transition cursor-pointer ${
              timerRunning
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Timer className="h-3.5 w-3.5 shrink-0" />
            {timerRunning ? (
              <span className="text-[11px] sm:text-xs">{formatTimer(timerRemainingSec)}</span>
            ) : (
              <span className="hidden md:inline">독서 타이머</span>
            )}
          </button>

          {/* Stamp Tour Button */}
          <button
            type="button"
            data-testid="stamp-tour-btn"
            onClick={() => setShowStampTourModal(true)}
            title="숨은그림찾기"
            className={`shrink-0 whitespace-nowrap flex h-6 md:h-auto items-center gap-0.5 sm:gap-1 rounded-[4px] px-1.5 sm:px-2 md:py-1 text-xs transition cursor-pointer ${
              collectedStampIds.length > 0
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Award className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              {collectedStampIds.length}/{STAMP_MISSIONS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPhotoGallery(true)}
            title="공간 사진"
            className="shrink-0 whitespace-nowrap flex h-6 w-6 md:h-auto md:w-auto items-center justify-center md:gap-1 rounded-[4px] bg-white/10 md:px-2 md:py-1 text-xs text-white/85 hover:bg-white/20 hover:text-white transition cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">실제 사진</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMinimap((v) => !v)}
            title="평면도 지도"
            className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-[4px] transition cursor-pointer ${
              showMinimap
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            title="도움말"
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-[4px] bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================
          MIDDLE AREA: OPTIONAL MINIMAP & FIRST-PERSON OWNER TALK BUBBLE
         ============================================================ */}
      <div className="my-auto flex flex-col items-end justify-center gap-2">
        {isTalkingToOwner && (
          <div className="pointer-events-auto ml-auto flex flex-col items-end break-keep">
            <div className="w-[225px] sm:w-[270px] rounded-2xl bg-neutral-950/82 p-3 sm:p-3.5 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs sm:text-sm text-white">말걸기</span>
                  <span className="text-[11px] text-white/65">
                    가장 많이 질문하는 것들
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseOwnerTalk}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/14 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
                  aria-label="말걸기 닫기"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {OWNER_QA_ITEMS.map((item, idx) => {
                  const isSelected = selectedOwnerQuestionIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectOwnerQuestion?.(idx)}
                      className={`rounded-xl px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-white/28 text-white shadow-sm'
                          : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {item.question}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mr-6 h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-neutral-950/82" />
          </div>
        )}

        {showMinimap && (
          <div className="pointer-events-auto ml-auto flex flex-col rounded-xl bg-neutral-950/65 p-3 shadow-xl backdrop-blur-xl w-48">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/95 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-white/80" /> 독자서점 평면도
              </span>
              <button
                type="button"
                onClick={() => setShowMinimap(false)}
                className="text-xs text-white/60 hover:text-white cursor-pointer"
              >
                닫기
              </button>
            </div>
            <div className="relative h-56 w-full rounded-lg bg-white/8 overflow-hidden">
              <div className="absolute left-[26%] top-[48%] h-[18%] w-[46%] rounded bg-white/10" />
              <div className="absolute left-[46%] top-[10%] h-[20%] w-[36%] rounded bg-white/10" />
              <div className="absolute left-0 top-[44%] h-[24%] w-[10%] bg-white/15 flex items-center justify-center text-[8px] text-white/90 [writing-mode:vertical-rl]">
                독자 추천 도서
              </div>
              <div className="absolute right-0 top-[6%] h-[66%] w-[10%] bg-white/15 flex items-center justify-center text-[8px] text-white/90 [writing-mode:vertical-rl]">
                메인 6단 서가
              </div>
              <div className="absolute right-[10%] top-[36%] h-[8%] w-[26%] rounded-sm bg-white/18 flex items-center justify-center text-[8px] text-white">
                추천 도서 테이블
              </div>
              <div className="absolute left-[4%] top-[10%] h-[20%] w-[38%] rounded-sm bg-white/15 flex items-center justify-center text-[8px] text-white/90 text-center leading-tight">
                딤프치 & 독서테이블
              </div>
              <div className="absolute inset-x-0 top-[76%] h-[2%] bg-white/25" />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/50 px-1.5 py-0.5 text-[8px] text-white/90">
                도로 & 입구
              </div>

              {WAYPOINT_NODES.map((wp) => {
                const wx = ((wp.position[0] + 4.6) / 9.2) * 100;
                const wy = ((wp.position[2] + 6.8) / 17.0) * 100;
                return (
                  <button
                    key={wp.id}
                    type="button"
                    title={wp.label}
                    onClick={() => onSelectWaypoint(wp)}
                    style={{ left: `${wx}%`, top: `${wy}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white/75 hover:bg-white hover:scale-125 transition cursor-pointer"
                  />
                );
              })}

              <div
                style={{ left: `${mapPercentX}%`, top: `${mapPercentY}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <span className="absolute h-4 w-4 animate-ping rounded-full bg-sky-400/50" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-sky-400 shadow" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM AREA: COMPACT D-PAD & BORDERLESS SEMI-TRANSPARENT BAR
         ============================================================ */}
      <div className="flex items-end justify-between gap-2">
        {/* Compact Semi-Transparent Mobile Touch D-Pad */}
        <div className="pointer-events-auto flex sm:hidden flex-col items-center gap-0.5 rounded-xl bg-black/42 p-1.5 backdrop-blur-md">
          <button
            type="button"
            onPointerDown={() => {
              joystickVectorRef.current = { x: 0, y: 1 };
            }}
            onPointerUp={() => {
              joystickVectorRef.current = { x: 0, y: 0 };
            }}
            onPointerLeave={() => {
              joystickVectorRef.current = { x: 0, y: 0 };
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs text-white active:bg-white/30"
          >
            ▲
          </button>
          <div className="flex gap-0.5">
            <button
              type="button"
              onPointerDown={() => {
                joystickVectorRef.current = { x: -1, y: 0 };
              }}
              onPointerUp={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              onPointerLeave={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs text-white active:bg-white/30"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={() => {
                joystickVectorRef.current = { x: 0, y: -1 };
              }}
              onPointerUp={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              onPointerLeave={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs text-white active:bg-white/30"
            >
              ▼
            </button>
            <button
              type="button"
              onPointerDown={() => {
                joystickVectorRef.current = { x: 1, y: 0 };
              }}
              onPointerUp={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              onPointerLeave={() => {
                joystickVectorRef.current = { x: 0, y: 0 };
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-xs text-white active:bg-white/30"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Center/Right Compact Contextual Boxes */}
        <div className="mx-auto flex flex-col items-center gap-1.5">
          {/* Held Book Compact Bar */}
          {heldBook && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 rounded-[6px] bg-black/48 px-3 py-1.5 shadow-md backdrop-blur-md">
              <span className="truncate max-w-[130px] sm:max-w-[220px] text-xs text-white/95">
                『{heldBook.title}』
              </span>

              {actionState === 'READING' ? (
                <button
                  type="button"
                  onClick={onStopReading}
                  className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/30 transition cursor-pointer"
                >
                  책 덮기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartReading}
                  className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/30 transition cursor-pointer"
                >
                  책 읽기
                </button>
              )}

              {!isSeated && (
                <button
                  type="button"
                  onClick={onSitAndReadNearest}
                  className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/15 px-2.5 py-1 text-xs text-white/90 hover:bg-white/25 transition cursor-pointer"
                >
                  앉아서 읽기
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectBook(heldBook)}
                className="shrink-0 rounded-[4px] bg-white/12 px-2 py-1 text-xs text-white/90 hover:bg-white/22 transition cursor-pointer"
              >
                <Info className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onReturnHeldBook}
                className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/12 px-2 py-1 text-xs text-white/80 hover:bg-white/22 hover:text-white transition cursor-pointer"
              >
                꽂기
              </button>
            </div>
          )}

          {/* Seated Compact Box */}
          {isSeated && activeSeat && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-[6px] bg-black/48 px-3 py-1.5 shadow-md backdrop-blur-md">
              <span className="whitespace-nowrap text-xs text-white/95">
                {activeSeat.name} 착석 중
              </span>
              {heldBook && actionState !== 'READING' && (
                <button
                  type="button"
                  onClick={onStartReading}
                  className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/20 px-2.5 py-0.5 text-xs text-white hover:bg-white/30 transition cursor-pointer"
                >
                  읽기
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTimerAsmrModal(true)}
                className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/15 px-2.5 py-0.5 text-xs text-white/90 hover:bg-white/25 transition cursor-pointer"
              >
                독서 타이머
              </button>
              <button
                type="button"
                onClick={onStandUp}
                className="whitespace-nowrap shrink-0 rounded-[4px] bg-white/20 px-2.5 py-0.5 text-xs text-white hover:bg-white/30 transition cursor-pointer"
              >
                일어나기
              </button>
            </div>
          )}

          {/* Compact 1-Line Contextual Prompt Box */}
          {activePrompt && actionState !== 'INTERACTING' && (
            <button
              type="button"
              onClick={onTriggerPromptAction}
              className="pointer-events-auto flex items-center gap-2 rounded-[6px] bg-black/48 px-3.5 py-1.5 shadow-md backdrop-blur-md hover:bg-black/62 transition cursor-pointer"
            >
              <span className="flex h-5 px-1.5 items-center justify-center rounded-[3px] bg-white/20 text-[11px] text-white">
                {activePrompt.keyHint}
              </span>
              <span className="text-xs text-white/95 truncate max-w-[200px] sm:max-w-xs">
                {activePrompt.label}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          MODAL 0: ON-DEMAND SHELF BOOK BROWSER (Borderless Semi-Transparent)
         ============================================================ */}
      {browsingShelf && !inspectingBook && !isReadingModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={onCloseBrowsingShelf}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl text-white">{browsingShelf.name}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              {browsingShelf.description}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {browsingShelfBooks.map((book) => {
                const isCurrentlyHeld = heldBook?.id === book.id;
                return (
                  <button
                    key={book.id}
                    type="button"
                    data-testid={`book-btn-${book.id}`}
                    onClick={() => {
                      onCloseBrowsingShelf();
                      onSelectBook(book);
                    }}
                    className={`group flex items-center justify-between rounded-xl p-2.5 text-left transition cursor-pointer ${
                      isCurrentlyHeld
                        ? 'bg-white/22 text-white'
                        : 'bg-white/8 hover:bg-white/16 text-white/95'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-7 flex-shrink-0 rounded shadow-sm flex items-center justify-center text-[11px]"
                        style={{
                          backgroundColor: book.coverColor,
                          color: book.textColor,
                        }}
                      >
                        책
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white">
                          {book.title}
                        </div>
                        <div className="truncate text-xs text-white/65">
                          {book.author} · {book.publisher}
                        </div>
                      </div>
                    </div>
                    <span className="ml-2 flex-shrink-0 rounded-lg bg-white/18 px-2.5 py-1 text-xs text-white group-hover:bg-white/28 transition">
                      {isCurrentlyHeld ? '들고 있음' : '꺼내기'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 1: BOOK COVER & 2-LINE INTRODUCTION POPUP (Borderless Semi-Transparent)
         ============================================================ */}
      {inspectingBook && !isReadingModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={onCloseBookDetail}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6">
              {/* Book Cover */}
              <div className="flex-shrink-0">
                {inspectingBook.id === 'book_tokyo_den' ? (
                  <div
                    className="relative flex h-52 w-44 flex-col justify-between overflow-hidden rounded-r-md rounded-l-[2px] bg-white shadow-2xl"
                    style={{
                      boxShadow:
                        '-6px 8px 20px rgba(0,0,0,0.45), inset 4px 0 8px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="pointer-events-none absolute inset-y-0 left-2 w-[1px] bg-black/10" />
                    {/* Crisp White Upper Margin with Centered '東京傳' */}
                    <div className="flex flex-col items-center justify-center pt-5 pb-3 text-neutral-900">
                      <div className="text-base tracking-[0.22em]">東京傳</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        박근태 사진집
                      </div>
                    </div>
                    {/* Lower Two-Thirds Tokyo Dusk Street Photo Composition */}
                    <div className="relative mx-2 mb-2 flex-1 overflow-hidden rounded-[2px] bg-gradient-to-b from-slate-700 via-stone-700 to-neutral-900">
                      {/* Warm Storefront Window Glows in Background */}
                      <div className="absolute inset-x-2 top-3 flex justify-between gap-1.5 opacity-85">
                        <div className="h-9 flex-1 rounded-[1px] bg-amber-200/45" />
                        <div className="h-9 flex-1 rounded-[1px] bg-orange-200/35" />
                        <div className="h-9 flex-1 rounded-[1px] bg-sky-200/30" />
                      </div>
                      {/* Street Silver Car Silhouette & Pedestrians at Dusk */}
                      <div className="absolute inset-x-3 bottom-5 h-7 rounded-t-md bg-slate-300/65" />
                      <div className="absolute bottom-0 left-5 h-11 w-4 rounded-t-full bg-neutral-950/90" />
                      <div className="absolute bottom-0 left-11 h-12 w-5 rounded-t-full bg-amber-800/85" />
                      <div className="absolute bottom-0 right-6 h-10 w-4 rounded-t-full bg-neutral-900/90" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="relative flex h-56 w-40 flex-col justify-between overflow-hidden rounded-r-lg rounded-l-[2px] p-4 shadow-2xl"
                    style={{
                      backgroundColor: inspectingBook.coverColor,
                      color: inspectingBook.textColor,
                      boxShadow:
                        '-6px 8px 20px rgba(0,0,0,0.45), inset 5px 0 10px rgba(0,0,0,0.08)',
                    }}
                  >
                    {/* Subtle Book Spine Crease */}
                    <div className="pointer-events-none absolute inset-y-0 left-2 w-[1px] bg-black/12" />

                    <div className="pl-1.5">
                      <div className="text-base leading-snug">
                        {inspectingBook.title}
                      </div>
                      <div className="mt-1 text-xs opacity-75">
                        {inspectingBook.author}
                      </div>
                    </div>

                    {/* Minimalist Cover Motif Illustration */}
                    <div className="my-auto flex items-center justify-center py-2">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full opacity-85"
                        style={{
                          backgroundColor: `${inspectingBook.accentColor}22`,
                        }}
                      >
                        <div
                          className="h-8 w-8 rounded-sm rotate-12"
                          style={{ backgroundColor: inspectingBook.accentColor }}
                        />
                      </div>
                    </div>

                    {/* Bottom Obi Band */}
                    <div
                      className="-mx-4 -mb-4 px-4 py-2 text-[11px]"
                      style={{
                        backgroundColor: inspectingBook.accentColor,
                        color: '#ffffff',
                      }}
                    >
                      {inspectingBook.publisher}
                    </div>
                  </div>
                )}
              </div>

              {/* 2-Line Concise Introduction & Actions */}
              <div className="flex-1 flex flex-col justify-between text-center sm:text-left">
                <div className="pr-0 sm:pr-6">
                  <div className="text-xs text-white/60">
                    {inspectingBook.genreName}
                  </div>
                  <h2 className="mt-1 text-xl text-white">
                    {inspectingBook.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-white/70">
                    {inspectingBook.author} · {inspectingBook.publisher}
                  </p>

                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/90">
                    {inspectingBook.summary}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={onStartReading}
                    className="whitespace-nowrap shrink-0 flex items-center gap-1.5 rounded-xl bg-white/22 px-3.5 py-2 text-xs text-white hover:bg-white/32 transition cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span>책 펼쳐 읽기</span>
                  </button>

                  {!isSeated && (
                    <button
                      type="button"
                      onClick={onSitAndReadNearest}
                      className="whitespace-nowrap shrink-0 rounded-xl bg-white/14 px-3 py-2 text-xs text-white/95 hover:bg-white/24 transition cursor-pointer"
                    >
                      앉아서 읽기
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onReturnHeldBook}
                    className="whitespace-nowrap shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/20 hover:text-white transition cursor-pointer"
                  >
                    다시 꽂기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: OPEN BOOK READING SPREAD (Borderless Clean Spread)
         ============================================================ */}
      {isReadingModalOpen && heldBook && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-3xl flex-col px-3">
          <div className="relative rounded-2xl bg-[#f7f3eb]/95 p-5 text-neutral-800 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-neutral-800/12 px-2 py-0.5 text-xs text-neutral-700">
                  독서 중
                </span>
                <span className="text-base text-neutral-900">
                  『{heldBook.title}』 — {heldBook.author}
                </span>
              </div>
              <button
                type="button"
                onClick={onStopReading}
                className="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700 transition cursor-pointer"
              >
                책 덮기
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">
                  {heldBook.excerpt[0]}
                </p>
                <div className="mt-2 text-xs text-neutral-500">— p. 42</div>
              </div>
              <div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">
                  {heldBook.excerpt[1]}
                </p>
                <div className="mt-2 text-right text-xs text-neutral-500">
                  — p. 43
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: TABLE MODAL (No Borders, No Kicker, No Guestbook)
         ============================================================ */}
      {inspectingTable && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={onCloseTableModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl text-white pr-10">{inspectingTable.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              {inspectingTable.description}
            </p>

            <div className="mt-4 overflow-hidden rounded-xl">
              <img
                src={inspectingTable.realPhotoUrl}
                alt={inspectingTable.name}
                className="h-48 w-full object-cover"
              />
            </div>

            {(heldBook ||
              tablePlacedBooks[inspectingTable.id] ||
              inspectingTable.linkedSeatId ||
              inspectingTable.id === 'table_window_desk') && (
              <div className="mt-4 flex flex-wrap gap-2">
                {heldBook && !tablePlacedBooks[inspectingTable.id] && (
                  <button
                    type="button"
                    onClick={() => onPlaceBookOnTable(inspectingTable.id)}
                    className="rounded-xl bg-white/20 px-4 py-2 text-sm text-white hover:bg-white/30 transition cursor-pointer"
                  >
                    『{heldBook.title}』 내려놓기
                  </button>
                )}

                {tablePlacedBooks[inspectingTable.id] && (
                  <button
                    type="button"
                    onClick={() => onPickBookFromTable(inspectingTable.id)}
                    className="rounded-xl bg-white/20 px-4 py-2 text-sm text-white hover:bg-white/30 transition cursor-pointer"
                  >
                    『{tablePlacedBooks[inspectingTable.id]?.title}』 다시 집어들기
                  </button>
                )}

                {inspectingTable.linkedSeatId && (
                  <button
                    type="button"
                    onClick={() => {
                      const seat = SEAT_OBJECTS.find(
                        (s) => s.id === inspectingTable.linkedSeatId
                      );
                      if (seat) {
                        onCloseTableModal();
                        onSitOnSeat(seat);
                      }
                    }}
                    className="rounded-xl bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25 transition cursor-pointer"
                  >
                    의자에 앉기
                  </button>
                )}

                {inspectingTable.id === 'table_window_desk' && (
                  <button
                    type="button"
                    onClick={onToggleWindowLamp}
                    className="flex items-center gap-1.5 rounded-xl bg-white/14 px-3.5 py-2 text-sm text-white/90 hover:bg-white/24 transition cursor-pointer"
                  >
                    <Lamp className="h-4 w-4" />
                    <span>스탠드 조명 {windowLampOn ? '끄기' : '켜기'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 4: SPACE STORY MODAL (Borderless, Clean, Concise)
         ============================================================ */}
      {inspectingStory && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={onCloseStoryModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl text-white pr-10">
              {inspectingStory.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              {inspectingStory.description}
            </p>

            <div className="mt-4 overflow-hidden rounded-xl">
              <img
                src={inspectingStory.realPhotoUrl}
                alt={inspectingStory.title}
                className="h-52 w-full object-cover"
              />
            </div>

            {inspectingStory.details.length > 0 && (
              <ul className="mt-4 space-y-1.5 rounded-xl bg-white/8 p-3.5 text-sm text-white/85">
                {inspectingStory.details.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-white/50">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 5: REAL PHOTO ARCHIVE GALLERY (Borderless Semi-Transparent)
         ============================================================ */}
      {showPhotoGallery && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setShowPhotoGallery(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl sm:text-2xl text-white">
              독자서점 공간 사진
            </h2>
            <p className="mt-1 text-sm text-white/75">
              공간을 선택하면 해당 위치로 이동해 둘러볼 수 있습니다.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {SPACE_STORIES.map((story) => (
                <div
                  key={story.id}
                  onClick={() => {
                    setShowPhotoGallery(false);
                    onOpenStoryModal(story);
                  }}
                  className="group cursor-pointer overflow-hidden rounded-xl bg-white/8 hover:bg-white/15 transition flex flex-col justify-between"
                >
                  <div>
                    <img
                      src={story.realPhotoUrl}
                      alt={story.title}
                      className="h-36 w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="p-3.5">
                      <h3 className="text-base text-white">{story.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-white/70">
                        {story.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-3.5 pb-3.5">
                    <span className="inline-block rounded-lg bg-white/14 px-2.5 py-1 text-xs text-white group-hover:bg-white/25 transition">
                      이동하기
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 6: AUTOMATIC ENTRANCE WELCOME GUIDE (독자 입구 안내)
         ============================================================ */}
      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl text-white">독자 입구 안내</h2>

            <div className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/90 break-keep">
              <div className="flex items-start gap-1.5">
                <span className="shrink-0">·</span>
                <span>독자는 무인서점이라 사장이 있다 없다 합니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="shrink-0">·</span>
                <span>반려동물 동반 가능 · 키즈케어존입니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="shrink-0">·</span>
                <span>창가에 앉아 있으면 낮과 밤이 바뀌는 풍경을 볼 수 있습니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="shrink-0">·</span>
                <span>
                  각 스팟별로 설명이 되어 있고 약간의 챌린지도 숨어 있으니, 독자에서 잘 놀다 가세요.
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {isOutsideOnRoad && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGuideModal(false);
                    onEnterStoreFromRoad();
                  }}
                  className="whitespace-nowrap rounded-xl bg-white/22 px-4 py-2 text-sm text-white hover:bg-white/32 transition cursor-pointer"
                >
                  독자서점 들어가기
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="whitespace-nowrap rounded-xl bg-white/12 px-4 py-2 text-sm text-white/85 hover:bg-white/22 hover:text-white transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 7: READING FOCUS TIMER & SOUND (Borderless Semi-Transparent)
         ============================================================ */}
      {showTimerAsmrModal && (
        <div
          data-testid="timer-asmr-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-lg w-full overflow-y-auto rounded-2xl bg-neutral-950/68 p-6 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setShowTimerAsmrModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl text-white">독서 타이머 & 서점 사운드</h2>
            <p className="mt-1 text-sm text-white/75">
              타이머와 서점 사운드를 켜두고 편하게 독서해 보세요.
            </p>

            {/* Pomodoro Reading Timer Card */}
            <div className="mt-4 rounded-xl bg-white/8 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-white/90">집중 시간 선택</span>
                <div className="flex items-center gap-1.5">
                  {([10, 25, 45] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setTimerDurationMinutes(mins);
                        setTimerRemainingSec(mins * 60);
                        setTimerRunning(false);
                      }}
                      className={`rounded-lg px-3 py-1 text-xs transition cursor-pointer ${
                        timerDurationMinutes === mins
                          ? 'bg-white/25 text-white'
                          : 'bg-white/8 text-white/75 hover:bg-white/16 hover:text-white'
                      }`}
                    >
                      {mins}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-black/30 px-5 py-4">
                <div className="text-center sm:text-left">
                  <div className="text-3xl sm:text-4xl tracking-wider text-white">
                    {formatTimer(timerRemainingSec)}
                  </div>
                  <div className="mt-0.5 text-xs text-white/65">
                    {timerRunning
                      ? '독자서점에서 독서 중입니다.'
                      : completedSessions > 0
                      ? `완료한 독서 세션: ${completedSessions}회`
                      : '시간을 선택하고 시작해 보세요.'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="timer-start-pause-btn"
                    onClick={() => setTimerRunning((r) => !r)}
                    className="flex items-center gap-1.5 rounded-xl bg-white/22 px-4 py-2 text-sm text-white hover:bg-white/32 transition cursor-pointer"
                  >
                    {timerRunning ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>일시정지</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>독서 시작</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerRemainingSec(timerDurationMinutes * 60);
                    }}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const winChair = SEAT_OBJECTS.find(
                      (s) => s.id === 'seat_window_chair'
                    );
                    if (winChair) {
                      setShowTimerAsmrModal(false);
                      onSitOnSeat(winChair);
                    }
                  }}
                  className="whitespace-nowrap flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/20 transition text-center cursor-pointer"
                >
                  창가 독서 책상에 앉기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const workChair = SEAT_OBJECTS.find(
                      (s) => s.id === 'seat_workshop_chair'
                    );
                    if (workChair) {
                      setShowTimerAsmrModal(false);
                      onSitOnSeat(workChair);
                    }
                  }}
                  className="whitespace-nowrap flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/90 hover:bg-white/20 transition text-center cursor-pointer"
                >
                  안쪽 독서 테이블에 앉기
                </button>
              </div>
            </div>

            {/* Unified Bookstore Sound */}
            <div className="mt-3 rounded-xl bg-white/8 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white">서점 배경음악 & ASMR</div>
                <p className="mt-0.5 text-xs text-white/70">
                  재즈 피아노 선율과 백색소음을 함께 켜고 끕니다.
                </p>
              </div>

              <button
                type="button"
                data-testid="unified-sound-toggle-btn"
                onClick={onToggleBgm}
                className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition cursor-pointer ${
                  bgmPlaying
                    ? 'bg-white/25 text-white hover:bg-white/35'
                    : 'bg-white/12 text-white/85 hover:bg-white/22 hover:text-white'
                }`}
              >
                {bgmPlaying ? (
                  <>
                    <Volume2 className="h-4 w-4" />
                    <span>사운드 켜짐</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-4 w-4" />
                    <span>사운드 꺼짐</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 8: HIDDEN OBJECT STAMP TOUR (Borderless Semi-Transparent)
         ============================================================ */}
      {showStampTourModal && (
        <div
          data-testid="stamp-tour-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[92vh] max-w-2xl w-full overflow-y-auto rounded-2xl bg-neutral-950/68 p-5 sm:p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl text-white">독자 숨은그림을 찾아라</h2>
                <p className="mt-0.5 text-xs sm:text-sm text-white/75">
                  서점 속에 숨은 5가지를 직접 찾아 클릭해 보세요.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white/16 px-3 py-1 text-xs text-white">
                  {collectedStampIds.length} / {STAMP_MISSIONS.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowStampTourModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white/80 hover:bg-white/25 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAMP_MISSIONS.map((mission) => {
                const isCollected = collectedStampIds.includes(mission.id);
                return (
                  <div
                    key={mission.id}
                    onClick={() => setShowStampTourModal(false)}
                    className={`group cursor-pointer relative overflow-hidden rounded-xl text-left transition-all ${
                      isCollected
                        ? 'bg-white/18 shadow-md'
                        : 'bg-white/8 hover:bg-white/14'
                    }`}
                  >
                    <div className="relative flex h-32 sm:h-36 w-full items-center justify-center overflow-hidden bg-black/25 p-3">
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-black/50 px-2 py-0.5 text-[11px] text-white/85">
                        {mission.zone}
                      </span>

                      {mission.id === 'hidden_book_dokja' && (
                        <svg viewBox="0 0 100 100" className="h-24 w-24 drop-shadow-lg">
                          <rect x="14" y="28" width="14" height="58" rx="2" fill="#3b281e" opacity="0.7" />
                          <rect x="72" y="25" width="14" height="61" rx="2" fill="#3b281e" opacity="0.7" />
                          <rect x="31" y="24" width="38" height="62" rx="3" fill="#c85a28" />
                          <rect x="31" y="62" width="38" height="10" fill="#fde68a" />
                          <rect x="47" y="12" width="6" height="15" fill="#dc2626" />
                          <polygon
                            points="50,2 53,9 61,9 55,14 57,21 50,17 43,21 45,14 39,9 47,9"
                            fill="#facc15"
                          />
                        </svg>
                      )}

                      {mission.id === 'hidden_house_frame' && (
                        <svg viewBox="0 0 100 100" className="h-24 w-24 drop-shadow-lg">
                          <rect x="16" y="14" width="68" height="68" rx="4" fill="#a67c52" />
                          <rect x="24" y="22" width="52" height="52" fill="#38bdf8" />
                          <circle cx="35" cy="33" r="6" fill="#facc15" />
                          <path d="M24 56 Q50 46 76 56 L76 74 L24 74 Z" fill="#22c55e" />
                          <rect x="41" y="45" width="20" height="16" fill="#ffffff" />
                          <polygon points="38,45 51,32 64,45" fill="#dc2626" />
                          <rect x="48" y="52" width="6" height="9" fill="#78350f" />
                        </svg>
                      )}

                      {mission.id === 'hidden_butterfly_frame' && (
                        <svg viewBox="0 0 100 100" className="h-24 w-24 drop-shadow-lg">
                          <rect x="18" y="14" width="64" height="68" rx="4" fill="#27272a" />
                          <rect x="25" y="21" width="50" height="54" fill="#fef3c7" />
                          <ellipse cx="40" cy="43" rx="12" ry="10" transform="rotate(-20 40 43)" fill="#0ea5e9" />
                          <ellipse cx="60" cy="43" rx="12" ry="10" transform="rotate(20 60 43)" fill="#0ea5e9" />
                          <ellipse cx="42" cy="55" rx="8" ry="7" fill="#38bdf8" />
                          <ellipse cx="58" cy="55" rx="8" ry="7" fill="#38bdf8" />
                          <rect x="48.5" y="35" width="3" height="24" rx="1.5" fill="#18181b" />
                        </svg>
                      )}

                      {mission.id === 'hidden_hat_duck' && (
                        <svg viewBox="0 0 100 100" className="h-24 w-24 drop-shadow-lg">
                          <ellipse cx="50" cy="66" rx="22" ry="16" fill="#ffffff" />
                          <circle cx="52" cy="44" r="14" fill="#ffffff" />
                          <polygon points="64,41 78,45 64,49" fill="#ea580c" />
                          <circle cx="56" cy="41" r="2.2" fill="#18181b" />
                          <ellipse cx="51" cy="31" rx="19" ry="4" fill="#facc15" />
                          <rect x="40" y="19" width="22" height="12" rx="4" fill="#facc15" />
                          <rect x="40" y="27" width="22" height="3.5" fill="#dc2626" />
                        </svg>
                      )}

                      {mission.id === 'hidden_mumu_dog' && (
                        <svg viewBox="0 0 100 100" className="h-24 w-24 drop-shadow-lg">
                          <ellipse cx="26" cy="50" rx="9" ry="18" fill="#09090b" />
                          <ellipse cx="74" cy="50" rx="9" ry="18" fill="#09090b" />
                          <circle cx="50" cy="46" r="23" fill="#1c1917" />
                          <rect x="33" y="64" width="34" height="7" rx="3.5" fill="#dc2626" />
                          <circle cx="50" cy="72" r="5" fill="#facc15" />
                          <circle cx="41" cy="42" r="4" fill="#ffffff" />
                          <circle cx="59" cy="42" r="4" fill="#ffffff" />
                          <circle cx="41" cy="42" r="2.2" fill="#09090b" />
                          <circle cx="59" cy="42" r="2.2" fill="#09090b" />
                          <ellipse cx="50" cy="49" rx="4.5" ry="3.2" fill="#09090b" />
                          <path d="M46 54 Q50 63 54 54 Z" fill="#fb7185" />
                        </svg>
                      )}

                      {isCollected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <div className="-rotate-12 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg">
                            <span className="text-xs">발견 완료</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="truncate text-xs text-white/95">
                        {mission.title}
                      </span>
                      {isCollected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white" />
                      ) : (
                        <span className="shrink-0 text-[11px] text-white/60">
                          미발견
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 6th Card: Sticker Reward Card */}
              <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white/8 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-white/14 px-2 py-0.5 text-[11px] text-white/90">
                    {collectedStampIds.length}/{STAMP_MISSIONS.length}
                  </span>
                  <Sparkles className="h-4 w-4 text-white/80" />
                </div>

                <div className="my-2 flex items-center justify-center">
                  <div
                    className={`flex h-16 w-16 flex-col items-center justify-center rounded-full shadow-md transition ${
                      collectedStampIds.length >= STAMP_MISSIONS.length
                        ? 'bg-white text-neutral-900 -rotate-6'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    <span className="text-xs">독자서점</span>
                    <span className="text-[10px]">스티커</span>
                  </div>
                </div>

                {collectedStampIds.length >= STAMP_MISSIONS.length ? (
                  <div className="rounded-lg bg-white/16 px-2 py-1.5 text-center">
                    <div className="text-xs text-white">
                      방문 시 스티커 제공
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs leading-snug text-white/75">
                    5개 모두 찾으면
                    <br />
                    방문 시 스티커 제공
                  </div>
                )}
              </div>
            </div>

            {collectedStampIds.length > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={onResetStamps}
                  className="text-xs text-white/60 underline hover:text-white cursor-pointer"
                >
                  기록 초기화
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
