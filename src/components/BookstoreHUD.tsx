import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  CloudRain,
  Compass,
  DoorOpen,
  Eye,
  Flame,
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
  UserCheck,
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

interface GuestbookEntry {
  id: string;
  nickname: string;
  message: string;
  favBook: string;
  date: string;
}

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
  asmrLevels,
  onChangeAsmrLevels,
  onReadingTimerComplete,
  collectedStampIds,
  onWalkToStampMission,
  onResetStamps,
}) => {
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
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
  const [honoraryReaderName, setHonoraryReaderName] = useState<string>('');
  const [honorarySigned, setHonorarySigned] = useState<boolean>(false);

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

  const hasActiveAsmr =
    asmrLevels.rain > 0.02 ||
    asmrLevels.paper > 0.02 ||
    asmrLevels.fireplace > 0.02;
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([
    {
      id: 'gb1',
      nickname: '산책자',
      message:
        '도로에서 독자 간판 보고 계단 올라와 문을 열자마자 주황빛 천장과 크리스탈 샹들리에, 책장들이 한눈에 펼쳐져서 감탄했어요!',
      favBook: '작지만, 독자',
      date: '2026.11.06',
    },
    {
      id: 'gb2',
      nickname: '가죽과책',
      message:
        '오른쪽 벽에 붙은 추천 테이블과 안쪽 책장의 수제 가죽가방·와인들, 그리고 가죽공방 옆 큰 테이블까지 실제 독자서점 그대로네요.',
      favBook: '소년이 온다',
      date: '2026.11.05',
    },
  ]);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestMsg, setNewGuestMsg] = useState('');

  const browsingShelfBooks = browsingShelf
    ? REPRESENTATIVE_BOOKS.filter((b) => b.genreId === browsingShelf.id)
    : [];

  const isOutsideOnRoad = characterPos[2] > 6.55;

  const handleAddGuestbook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestMsg.trim()) return;
    setGuestbookEntries((prev) => [
      {
        id: `gb_${Date.now()}`,
        nickname: newGuestName.trim() || '익명의 독자',
        message: newGuestMsg.trim(),
        favBook: heldBook?.title || '독자서점 공간',
        date: '2026.11.06',
      },
      ...prev,
    ]);
    setNewGuestName('');
    setNewGuestMsg('');
  };

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
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-2.5 sm:p-4">
      {/* ============================================================
          SINGLE COMPACT TOP ROW: MINIMAL BRAND PILL + QUICK TOOLS
          (Zoom controls hidden on mobile; Genre/Seat bar removed)
         ============================================================ */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Compact Brand Badge */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#191310]/80 px-3 py-1.5 shadow-lg border border-[#d4af37]/25 backdrop-blur-md">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c85a28] text-white font-serif font-bold text-xs shadow-inner">
            독자
          </div>
          <span className="font-serif text-xs sm:text-sm font-bold tracking-wide text-[#f8f1e5]">
            독자서점
          </span>
          <span className="hidden md:inline-block text-[11px] text-[#cbbba8]">
            · 3D 독립서점 & 가죽공방 딤프치
          </span>
        </div>

        {/* Right: Minimal Action Icons (Zoom Slider hidden on mobile; mobile uses 2-finger pinch) */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#191310]/80 px-2 py-1 shadow-lg border border-[#d4af37]/25 backdrop-blur-md">
          {isOutsideOnRoad ? (
            <button
              type="button"
              data-testid="enter-store-btn"
              onClick={onEnterStoreFromRoad}
              className="flex items-center gap-1 rounded-full bg-[#c85a28] px-2.5 py-1 text-[11px] sm:text-xs font-bold text-white shadow hover:bg-[#e06630] transition"
            >
              <DoorOpen className="h-3.5 w-3.5" />
              <span>입구 입장</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="panoramic-view-btn"
              onClick={onSetPanoramicInteriorView}
              title="독자 내부 한눈에 보기"
              className="flex items-center gap-1 rounded-full bg-[#2a201b] px-2.5 py-1 text-[11px] sm:text-xs font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
            >
              <Maximize2 className="h-3 w-3" />
              <span>한눈에 보기</span>
            </button>
          )}

          {/* Desktop-only Zoom Controls (hidden on mobile as requested) */}
          <div className="hidden sm:flex items-center gap-1 rounded-full bg-[#241c17] px-2 py-0.5 border border-[#3b2e26]">
            <button
              type="button"
              data-testid="zoom-in-btn"
              onClick={() => onZoomCamera(-0.45)}
              title="공간 확대"
              className="flex h-5 w-5 items-center justify-center rounded-full text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
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
              className="h-1 w-20 cursor-pointer accent-[#c85a28]"
            />
            <button
              type="button"
              data-testid="zoom-out-btn"
              onClick={() => onZoomCamera(0.45)}
              title="공간 축소"
              className="flex h-5 w-5 items-center justify-center rounded-full text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onResetCamera}
              title="시점 초기화"
              className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[#e5d5c3] hover:bg-[#c85a28] hover:text-white transition"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Single Music On/Off Icon Button (Web Audio Jazz Piano & Music Box BGM) */}
          <button
            type="button"
            data-testid="bgm-toggle-btn"
            onClick={onToggleBgm}
            title={
              bgmPlaying
                ? '배경음악 끄기 (재즈 피아노 & 오르골 선율 재생 중)'
                : '배경음악 켜기 (재즈 피아노 & 오르골 선율)'
            }
            aria-label={bgmPlaying ? '배경음악 끄기' : '배경음악 켜기'}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
              bgmPlaying
                ? 'bg-[#c85a28] text-white shadow-sm ring-1 ring-[#fde68a]/60'
                : 'bg-[#2a201b] text-[#cbbba8] hover:bg-[#3a2d26] hover:text-white'
            }`}
          >
            {bgmPlaying ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Feature #2: Reading Focus Timer & Bookstore ASMR Station Button */}
          <button
            type="button"
            data-testid="timer-asmr-btn"
            onClick={() => setShowTimerAsmrModal(true)}
            title="창가 독서 타이머 & 서점 ASMR 모드 (빗소리·책장·모닥불)"
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
              timerRunning || hasActiveAsmr
                ? 'bg-amber-600 text-white shadow-sm ring-1 ring-[#fde68a]'
                : 'bg-[#2a201b] text-[#fde68a] hover:bg-[#c85a28] hover:text-white'
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            {timerRunning ? (
              <span className="font-mono text-[10px] font-bold">
                {formatTimer(timerRemainingSec)}
              </span>
            ) : (
              <span className="hidden md:inline">독서·ASMR</span>
            )}
          </button>

          {/* Feature #3: Dokja 5-Signature Stamp Tour Button */}
          <button
            type="button"
            data-testid="stamp-tour-btn"
            onClick={() => setShowStampTourModal(true)}
            title="독자서점 5대 시그니처 보물찾기 스탬프 투어"
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition ${
              collectedStampIds.length >= STAMP_MISSIONS.length
                ? 'bg-amber-500 text-[#191310] shadow-sm ring-1 ring-white'
                : collectedStampIds.length > 0
                ? 'bg-[#c85a28]/90 text-white'
                : 'bg-[#2a201b] text-[#fde68a] hover:bg-[#c85a28] hover:text-white'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-[11px]">
              {collectedStampIds.length}/{STAMP_MISSIONS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPhotoGallery(true)}
            title="실제 서점 사진 & 이야기"
            className="flex items-center gap-1 rounded-full bg-[#2a201b] px-2 py-1 text-[11px] font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden md:inline">실제 사진</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMinimap((v) => !v)}
            title="평면도 지도"
            className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
              showMinimap
                ? 'bg-[#c85a28] text-white'
                : 'bg-[#2a201b] text-[#e5d5c3] hover:bg-[#3a2d26]'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            title="조작 도움말"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2a201b] text-[#e5d5c3] hover:bg-[#c85a28] hover:text-white transition"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================
          MIDDLE AREA: OPTIONAL MINIMAP OVERLAY (Hidden by default)
         ============================================================ */}
      <div className="my-auto flex items-start justify-end">
        {showMinimap && (
          <div className="pointer-events-auto ml-auto flex flex-col rounded-2xl bg-[#191310]/90 p-2.5 shadow-2xl border border-[#d4af37]/30 backdrop-blur-md w-48">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#fde68a] flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[#c85a28]" /> 독자서점 평면도
              </span>
              <button
                type="button"
                onClick={() => setShowMinimap(false)}
                className="text-[10px] text-[#a8a29e] hover:text-white"
              >
                닫기
              </button>
            </div>
            <div className="relative h-56 w-full rounded-xl bg-[#27201c] border border-[#3e322b] overflow-hidden">
              <div className="absolute left-[26%] top-[48%] h-[18%] w-[46%] rounded bg-[#7c1d1d]/50 border border-[#d8c3a5]/30" />
              <div className="absolute left-[46%] top-[10%] h-[20%] w-[36%] rounded bg-[#1e293b]/60 border border-[#b39b6e]/30" />
              <div className="absolute left-0 top-[44%] h-[24%] w-[9%] bg-[#7c4a21] flex items-center justify-center text-[7px] text-amber-200 [writing-mode:vertical-rl]">
                여행·독립출판
              </div>
              <div className="absolute right-0 top-[6%] h-[66%] w-[10%] bg-[#59351c] flex items-center justify-center text-[7px] text-amber-200 [writing-mode:vertical-rl]">
                메인 6단 서가
              </div>
              <div className="absolute right-[10%] top-[36%] h-[8%] w-[26%] rounded-sm bg-[#8b5a2b] border border-amber-500/40 flex items-center justify-center text-[7px] text-white">
                추천테이블
              </div>
              <div className="absolute left-[4%] top-[10%] h-[20%] w-[38%] rounded-sm bg-[#6e4423]/80 border border-amber-500/30 flex items-center justify-center text-[7px] text-amber-100 text-center leading-tight">
                딤프치 & 큰테이블
              </div>
              <div className="absolute inset-x-0 top-[76%] h-[2%] bg-[#8b3a2b]" />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[7px] text-[#fde68a]">
                ▲ 도로 & 독자 입구
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-400/70 hover:bg-amber-300 hover:scale-125 transition ring-2 ring-black/40"
                  />
                );
              })}

              <div
                style={{ left: `${mapPercentX}%`, top: `${mapPercentY}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <span className="absolute h-4 w-4 animate-ping rounded-full bg-sky-400/50" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-white shadow" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM AREA: COMPACT D-PAD & SLIM INTERACTION PILL
         ============================================================ */}
      <div className="flex items-end justify-between gap-2">
        {/* Compact Semi-Transparent Mobile Touch D-Pad */}
        <div className="pointer-events-auto flex sm:hidden flex-col items-center gap-0.5 rounded-2xl bg-[#191310]/65 p-1.5 border border-[#d4af37]/25 backdrop-blur-xs">
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
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2a201b]/90 text-xs font-bold text-[#fde68a] active:bg-[#c85a28]"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2a201b]/90 text-xs font-bold text-[#fde68a] active:bg-[#c85a28]"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2a201b]/90 text-xs font-bold text-[#fde68a] active:bg-[#c85a28]"
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
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2a201b]/90 text-xs font-bold text-[#fde68a] active:bg-[#c85a28]"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Center/Right Compact Contextual Pills */}
        <div className="mx-auto flex flex-col items-center gap-1.5">
          {/* Held Book Compact Bar */}
          {heldBook && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full bg-[#1f1713]/92 px-3 py-1.5 shadow-xl border border-[#e09f3e]/50 backdrop-blur-md">
              <span className="truncate max-w-[140px] sm:max-w-[220px] font-serif text-xs font-bold text-[#fde68a]">
                📕 『{heldBook.title}』
              </span>

              {actionState === 'READING' ? (
                <button
                  type="button"
                  onClick={onStopReading}
                  className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 transition"
                >
                  책 덮기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartReading}
                  className="rounded-full bg-[#c85a28] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#e06630] transition"
                >
                  책 읽기
                </button>
              )}

              {!isSeated && (
                <button
                  type="button"
                  onClick={onSitAndReadNearest}
                  className="rounded-full bg-purple-700/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-purple-600 transition"
                >
                  🪑 앉아서 읽기
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectBook(heldBook)}
                className="rounded-full bg-[#2e231d] px-2 py-1 text-[11px] text-[#fde68a] hover:bg-[#3d2f28] transition"
              >
                <Info className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={onReturnHeldBook}
                className="rounded-full bg-[#2a201b] px-2 py-1 text-[11px] text-[#cbbba8] hover:text-white transition"
              >
                꽂기
              </button>
            </div>
          )}

          {/* Seated Compact Pill */}
          {isSeated && activeSeat && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-purple-950/90 px-3 py-1.5 shadow-lg border border-purple-400/40 backdrop-blur-md">
              <span className="text-[11px] font-medium text-purple-100">
                🪑 {activeSeat.name} 착석 중
              </span>
              {heldBook && actionState !== 'READING' && (
                <button
                  type="button"
                  onClick={onStartReading}
                  className="rounded-full bg-[#c85a28] px-2.5 py-0.5 text-[11px] font-semibold text-white"
                >
                  📖 읽기
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTimerAsmrModal(true)}
                className="rounded-full bg-amber-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-500 transition"
              >
                🌧️ 독서 타이머·ASMR
              </button>
              <button
                type="button"
                onClick={onStandUp}
                className="rounded-full bg-purple-700 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-purple-600"
              >
                일어나기
              </button>
            </div>
          )}

          {/* Compact 1-Line Contextual Prompt Pill (only for nearby book, chair, or table) */}
          {activePrompt && actionState !== 'INTERACTING' && (
            <button
              type="button"
              onClick={onTriggerPromptAction}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#191310]/90 px-3.5 py-1.5 shadow-xl border border-[#e09f3e] hover:bg-[#c85a28] transition"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e09f3e] text-[10px] font-extrabold text-[#191310]">
                {activePrompt.keyHint}
              </span>
              <span className="text-xs font-bold text-[#f8f1e5] truncate max-w-[200px] sm:max-w-xs">
                {activePrompt.label}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          MODAL 0: ON-DEMAND SHELF BOOK BROWSER
         ============================================================ */}
      {browsingShelf && !inspectingBook && !isReadingModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-[#191310] p-5 text-[#f5efe6] shadow-2xl border border-[#d97736]/55">
            <button
              type="button"
              onClick={onCloseBrowsingShelf}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: browsingShelf.accentColor }}
              />
              <span className="text-[11px] font-semibold tracking-wider text-[#e09f3e]">
                {browsingShelf.englishName}
              </span>
              <span className="rounded-lg bg-[#2a201b] px-2 py-0.5 text-[10px] text-[#cbbba8] border border-[#3d2f28]">
                {browsingShelf.locationLabel}
              </span>
            </div>

            <h2 className="mt-1 font-serif text-lg font-bold text-[#f8f1e5]">
              {browsingShelf.name} 서가
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#dfd5c7]">
              {browsingShelf.description}
            </p>

            <div className="mt-3.5 border-t border-[#362a23] pt-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#fde68a]">
                <span>
                  ✨ 선택 가능한 대표 도서 ({browsingShelfBooks.length}권)
                </span>
                <span className="text-[10px] font-normal text-[#b8a99a]">
                  클릭하여 책장에서 꺼내기
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
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
                      className={`group flex items-center justify-between rounded-xl p-2.5 text-left transition ${
                        isCurrentlyHeld
                          ? 'bg-[#c85a28]/30 border border-[#c85a28] text-white'
                          : 'bg-[#241c17] hover:bg-[#332720] border border-transparent hover:border-[#d97736]/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-9 w-7 flex-shrink-0 rounded shadow-sm border border-white/15 flex items-center justify-center text-[10px] font-serif font-bold"
                          style={{
                            backgroundColor: book.coverColor,
                            color: book.textColor,
                          }}
                        >
                          책
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[#f8f1e5] group-hover:text-[#fde68a]">
                            {book.title}
                          </div>
                          <div className="truncate text-[11px] text-[#b8a99a]">
                            {book.author} · {book.publisher}
                          </div>
                        </div>
                      </div>
                      <span className="ml-2 flex-shrink-0 rounded-lg bg-[#c85a28] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm group-hover:bg-[#e06630]">
                        {isCurrentlyHeld ? '들고 있음' : '꺼내기'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 1: BOOK COVER & DETAILED INFORMATION PANEL
         ============================================================ */}
      {inspectingBook && !isReadingModalOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-3xl bg-[#1b1411] p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/50">
            <button
              type="button"
              onClick={onCloseBookDetail}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col items-center">
                <div
                  className="relative flex h-64 w-44 flex-col justify-between rounded-r-xl rounded-l-sm p-4 shadow-2xl border border-white/15"
                  style={{
                    backgroundColor: inspectingBook.coverColor,
                    color: inspectingBook.textColor,
                    boxShadow: `-6px 8px 20px rgba(0,0,0,0.6), inset 6px 0 12px rgba(255,255,255,0.12)`,
                  }}
                >
                  <div className="text-[10px] font-semibold tracking-widest uppercase opacity-75">
                    DOKJA CURATION · {inspectingBook.genreName}
                  </div>
                  <div className="my-auto py-2">
                    <div className="font-serif text-lg font-bold leading-snug">
                      {inspectingBook.title}
                    </div>
                    <div className="mt-2 text-xs opacity-85">
                      {inspectingBook.author}
                    </div>
                  </div>
                  <div
                    className="rounded px-2 py-1 text-[10px] font-bold tracking-wide"
                    style={{
                      backgroundColor: inspectingBook.accentColor,
                      color: '#ffffff',
                    }}
                  >
                    {inspectingBook.publisher} · {inspectingBook.publishedYear}
                  </div>
                </div>
                <span className="mt-2 text-[11px] text-[#fde68a] flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" /> 현재 캐릭터가 손에 들고 있는 도서
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#c85a28] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {inspectingBook.genreName}
                    </span>
                    <span className="text-xs text-[#b8a99a]">
                      ISBN {inspectingBook.isbn}
                    </span>
                  </div>

                  <h2 className="mt-2 font-serif text-2xl font-bold text-[#f8f1e5]">
                    {inspectingBook.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-[#d4a359]">
                    {inspectingBook.author} 지음 · {inspectingBook.publisher} (
                    {inspectingBook.publishedYear})
                  </p>

                  <div className="mt-3 rounded-xl bg-[#261d18] p-3 border border-[#3d2f28]">
                    <div className="text-[11px] font-semibold text-[#fde68a]">
                      📍 독자서점 내 실제 비치 위치
                    </div>
                    <div className="mt-0.5 text-xs text-[#dfd5c7]">
                      {inspectingBook.realSpotDescription}
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-xs font-semibold text-[#e09f3e]">
                      도서 소개
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#e5ddd3]">
                      {inspectingBook.summary}
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#231b16] p-3 border-l-4 border-[#c85a28]">
                    <div className="text-xs font-semibold text-[#fde68a]">
                      💬 독자서점 책방지기의 노트
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#d6c7b2]">
                      {inspectingBook.curatorNote}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {inspectingBook.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-[#2a201b] px-2 py-0.5 text-[11px] text-[#cbbba8]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#362a23] pt-4">
                  <button
                    type="button"
                    onClick={onStartReading}
                    className="flex items-center gap-1.5 rounded-xl bg-[#c85a28] px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-[#e06630] transition"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>책 펼쳐 읽기</span>
                  </button>

                  {!isSeated && (
                    <button
                      type="button"
                      onClick={onSitAndReadNearest}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-2.5 text-xs font-semibold text-white shadow hover:bg-purple-600 transition"
                    >
                      <span>🪑 의자에 앉아 읽기</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onCloseBookDetail}
                    className="rounded-xl bg-[#2e231d] px-3.5 py-2.5 text-xs font-medium text-[#fde68a] hover:bg-[#3d2f28] transition"
                  >
                    손에 든 채로 서점 걷기
                  </button>

                  <button
                    type="button"
                    onClick={onReturnHeldBook}
                    className="rounded-xl bg-[#241c17] px-3 py-2.5 text-xs text-[#b8a99a] hover:bg-stone-800 hover:text-white transition"
                  >
                    책장에 다시 꽂기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: OPEN BOOK READING SPREAD
         ============================================================ */}
      {isReadingModalOpen && heldBook && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-3xl flex-col px-3">
          <div className="relative rounded-3xl bg-[#f7f1e3] p-5 text-[#292524] shadow-2xl border-4 border-[#7c4a21]">
            <div className="mb-3 flex items-center justify-between border-b border-[#d6cbb9] pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#c85a28] px-2 py-0.5 text-[11px] font-bold text-white">
                  독서 중 {isSeated ? '(착석 독서)' : '(서서 읽기)'}
                </span>
                <span className="font-serif text-sm font-bold text-[#1c1917]">
                  『{heldBook.title}』 — {heldBook.author}
                </span>
              </div>
              <button
                type="button"
                onClick={onStopReading}
                className="rounded-lg bg-[#292524] px-3 py-1 text-xs font-semibold text-[#f7f1e3] hover:bg-[#c85a28] transition"
              >
                책 덮기
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-serif">
              <div className="sm:border-r border-[#d6cbb9] sm:pr-4">
                <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-[#292524]">
                  {heldBook.excerpt[0]}
                </p>
                <div className="mt-2 text-[10px] text-[#78716c]">— p. 42</div>
              </div>
              <div className="sm:pl-2">
                <p className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-[#292524]">
                  {heldBook.excerpt[1]}
                </p>
                <div className="mt-2 text-right text-[10px] text-[#78716c]">
                  — p. 43
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 3: TABLE INTERACTION & GUESTBOOK MODAL
         ============================================================ */}
      {inspectingTable && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#1b1411] p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/50">
            <button
              type="button"
              onClick={onCloseTableModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-xs font-semibold text-[#e09f3e]">
              테이블 및 가구 인터랙션
            </div>
            <h2 className="mt-1 font-serif text-xl font-bold text-[#f8f1e5]">
              {inspectingTable.name}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#dfd5c7]">
              {inspectingTable.description}
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border border-[#3d2f28]">
              <img
                src={inspectingTable.realPhotoUrl}
                alt={inspectingTable.name}
                className="h-44 w-full object-cover"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {heldBook && !tablePlacedBooks[inspectingTable.id] && (
                <button
                  type="button"
                  onClick={() => onPlaceBookOnTable(inspectingTable.id)}
                  className="rounded-xl bg-[#c85a28] px-4 py-2 text-xs font-bold text-white hover:bg-[#e06630] transition"
                >
                  📕 들고 있는 『{heldBook.title}』 테이블에 내려놓기
                </button>
              )}

              {tablePlacedBooks[inspectingTable.id] && (
                <button
                  type="button"
                  onClick={() => onPickBookFromTable(inspectingTable.id)}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition"
                >
                  📕 테이블 위의 『{tablePlacedBooks[inspectingTable.id]?.title}』 다시 집어들기
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
                  className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-600 transition"
                >
                  🪑 이 테이블 의자에 앉기
                </button>
              )}

              {inspectingTable.id === 'table_window_desk' && (
                <button
                  type="button"
                  onClick={onToggleWindowLamp}
                  className="flex items-center gap-1.5 rounded-xl bg-[#2e231d] px-3.5 py-2 text-xs font-medium text-[#fde68a] hover:bg-[#3d2f28] transition"
                >
                  <Lamp className="h-4 w-4" />
                  <span>오렌지 스탠드 조명 {windowLampOn ? '끄기' : '켜기'}</span>
                </button>
              )}
            </div>

            {inspectingTable.id === 'table_center_recommend' && (
              <div className="mt-5 border-t border-[#362a23] pt-4">
                <h3 className="font-serif text-sm font-bold text-[#fde68a]">
                  ✍️ 독자서점 방문객 방명록 (READ MORE BOOKS)
                </h3>
                <form onSubmit={handleAddGuestbook} className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    placeholder="닉네임"
                    className="w-24 rounded-xl bg-[#261d18] px-2.5 py-1.5 text-xs text-white border border-[#3d2f28] focus:outline-none focus:border-[#c85a28]"
                  />
                  <input
                    type="text"
                    value={newGuestMsg}
                    onChange={(e) => setNewGuestMsg(e.target.value)}
                    placeholder="서점 방문 소감이나 문장을 남겨보세요..."
                    className="flex-1 rounded-xl bg-[#261d18] px-3 py-1.5 text-xs text-white border border-[#3d2f28] focus:outline-none focus:border-[#c85a28]"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#c85a28] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e06630]"
                  >
                    남기기
                  </button>
                </form>
                <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
                  {guestbookEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl bg-[#241c17] p-2.5 text-xs border border-[#362a23]"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#d4a359]">
                        <strong>{entry.nickname}</strong>
                        <span>
                          📕 {entry.favBook} · {entry.date}
                        </span>
                      </div>
                      <p className="mt-1 text-[#e5ddd3]">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 4: SPACE STORY & REAL PHOTO COMPARISON MODAL
         ============================================================ */}
      {inspectingStory && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#1b1411] p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/50">
            <button
              type="button"
              onClick={onCloseStoryModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="rounded-full bg-[#c85a28]/25 px-3 py-0.5 text-xs font-semibold text-[#fde68a] border border-[#c85a28]/40">
              {inspectingStory.category}
            </span>
            <h2 className="mt-2 font-serif text-xl font-bold text-[#f8f1e5]">
              {inspectingStory.title}
            </h2>
            <p className="text-xs text-[#d4a359]">{inspectingStory.subtitle}</p>

            <div className="mt-3 overflow-hidden rounded-2xl border border-[#3d2f28]">
              <img
                src={inspectingStory.realPhotoUrl}
                alt={inspectingStory.title}
                className="h-56 w-full object-cover"
              />
              <div className="bg-[#241c17] px-3 py-1.5 text-[11px] text-[#cbbba8]">
                📷 실제 독자서점(DOKJA) 현장 사진 아카이브
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#e5ddd3]">
              {inspectingStory.description}
            </p>

            <ul className="mt-3 space-y-1.5 rounded-2xl bg-[#241c17] p-3.5 text-xs text-[#d6c7b2] border border-[#362a23]">
              {inspectingStory.details.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#c85a28]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 5: REAL PHOTO ARCHIVE & SPACE STORIES GALLERY
         ============================================================ */}
      {showPhotoGallery && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-[#1b1411] p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/50">
            <button
              type="button"
              onClick={() => setShowPhotoGallery(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#f8f1e5]">
              독자서점 (DOKJA) 공간별 이야기 & 실물 사진 아카이브
            </h2>
            <p className="mt-1 text-xs text-[#cbbba8]">
              원하는 공간을 선택하면 캐릭터가 해당 장소로 직접 걸어가며 상세 이야기를 확인할 수 있습니다.
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {SPACE_STORIES.map((story) => (
                <div
                  key={story.id}
                  onClick={() => {
                    setShowPhotoGallery(false);
                    onOpenStoryModal(story);
                  }}
                  className="group cursor-pointer overflow-hidden rounded-2xl bg-[#241c17] border border-[#3d2f28] hover:border-[#c85a28] transition flex flex-col justify-between"
                >
                  <div>
                    <img
                      src={story.realPhotoUrl}
                      alt={story.title}
                      className="h-36 w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="p-3">
                      <span className="text-[10px] font-semibold text-[#e09f3e]">
                        {story.category}
                      </span>
                      <h3 className="mt-0.5 font-serif text-sm font-bold text-[#f8f1e5] group-hover:text-[#fde68a]">
                        {story.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#b8a99a]">
                        {story.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <span className="inline-block rounded-lg bg-[#c85a28]/20 px-2.5 py-1 text-[11px] font-medium text-[#fde68a] group-hover:bg-[#c85a28] group-hover:text-white transition">
                      이 공간으로 이동 및 살펴보기 →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 6: CONTROLS & EXPERIENCE GUIDE MODAL
         ============================================================ */}
      {showGuideModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="relative max-w-lg w-full rounded-3xl bg-[#1b1411] p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/50">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-serif text-xl font-bold text-[#fde68a]">
              독자서점 3D 인터랙티브 탐험 가이드
            </h2>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#dfd5c7]">
              <div className="rounded-xl bg-[#241c17] p-3 border border-[#362a23]">
                <strong className="text-[#f8f1e5]">
                  1. 모바일 두 손가락 확대/축소 & 터치 이동
                </strong>
                <p className="mt-1">
                  • 모바일에서는 <strong>두 손가락을 벌리거나 오므려(Pinch Zoom)</strong> 공간을 자유롭게 확대·축소할 수 있습니다.
                  <br />• 바닥을 직접 터치하거나 좌측 하단 방향키로 이동할 수 있으며, 한 손가락 드래그로 시점을 둘러볼 수 있습니다.
                </p>
              </div>
              <div className="rounded-xl bg-[#241c17] p-3 border border-[#362a23]">
                <strong className="text-[#f8f1e5]">
                  2. 책장 구경하기 & 책 꺼내서 들고 다니기
                </strong>
                <p className="mt-1">
                  • 서가의 간판이나 빛나는 대표 도서를 터치(클릭)하면 캐릭터가 다가가 책을 꺼내 손에 듭니다.
                </p>
              </div>
              <div className="rounded-xl bg-[#241c17] p-3 border border-[#362a23]">
                <strong className="text-[#f8f1e5]">
                  3. 의자에 앉기 · 독서 타이머 & 5대 보물찾기
                </strong>
                <p className="mt-1">
                  • 창가 책상이나 대형 테이블 의자에 앉아 <strong>독서 타이머 & ASMR(빗소리·책장·모닥불)</strong>을 켜고 여유롭게 머물 수 있습니다.
                  <br />• 서점 곳곳의 <strong>5대 시그니처 보물</strong>을 모두 발견하면 명예 독자 디지털 책갈피가 발급됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 7 (FEATURE #2): READING FOCUS TIMER & BOOKSTORE ASMR LOUNGE
         ============================================================ */}
      {showTimerAsmrModal && (
        <div
          data-testid="timer-asmr-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-xl w-full overflow-y-auto rounded-3xl bg-[#1b1411] p-5 sm:p-6 text-[#f5efe6] shadow-2xl border border-[#d97736]/60">
            <button
              type="button"
              onClick={() => setShowTimerAsmrModal(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-[#e09f3e]">
              <Timer className="h-4 w-4" />
              <span>독자서점 창가 독서 라운지 · 포모도로 & 백색소음(ASMR)</span>
            </div>
            <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold text-[#f8f1e5]">
              창가 책상 독서 타이머 & 서점 ASMR
            </h2>
            <p className="mt-1 text-xs text-[#cbbba8]">
              실제 책을 읽거나 작업할 때 타이머와 서점 백색소음을 켜두고 독자서점 안에 오래도록 머물러 보세요. 창을 닫아도 상단 미니 타이머와 사운드는 계속 유지됩니다.
            </p>

            {/* 1. Pomodoro Reading Timer Card */}
            <div className="mt-4 rounded-2xl bg-[#241c17] p-4 border border-[#3d2f28]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#fde68a]">
                  ⏱️ 집중 독서 타이머 선택
                </span>
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
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        timerDurationMinutes === mins
                          ? 'bg-[#c85a28] text-white shadow'
                          : 'bg-[#191310] text-[#cbbba8] hover:text-white'
                      }`}
                    >
                      {mins}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-[#191310]/90 px-5 py-4 border border-[#362a23]">
                <div className="text-center sm:text-left">
                  <div className="font-mono text-3xl sm:text-4xl font-bold tracking-wider text-[#fde68a]">
                    {formatTimer(timerRemainingSec)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#b8a99a]">
                    {timerRunning
                      ? '✨ 독자서점에서 집중 독서 중입니다...'
                      : completedSessions > 0
                      ? `오늘 완료한 독서 세션: ${completedSessions}회`
                      : '원하는 시간을 고르고 독서를 시작해 보세요'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="timer-start-pause-btn"
                    onClick={() => setTimerRunning((r) => !r)}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow transition ${
                      timerRunning
                        ? 'bg-amber-600 hover:bg-amber-500'
                        : 'bg-[#c85a28] hover:bg-[#e06630]'
                    }`}
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
                    className="rounded-xl bg-[#2a201b] px-3 py-2.5 text-xs font-medium text-[#cbbba8] hover:text-white transition"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* Quick Seat Navigation Shortcuts */}
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
                  className="flex-1 rounded-xl bg-[#2e231d] px-3 py-2 text-xs font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition text-center"
                >
                  🪑 입구 창가 독서 책상에 앉기
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
                  className="flex-1 rounded-xl bg-[#2e231d] px-3 py-2 text-xs font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition text-center"
                >
                  🪑 안쪽 대형 독서 테이블에 앉기
                </button>
              </div>
            </div>

            {/* 2. Bookstore ASMR Sound Mixer */}
            <div className="mt-4 rounded-2xl bg-[#241c17] p-4 border border-[#3d2f28]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold text-[#fde68a]">
                  🎧 서점 공간 사운드 & ASMR 믹서
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="asmr-cozy-preset-btn"
                    onClick={() => {
                      if (!bgmPlaying) onToggleBgm();
                      onChangeAsmrLevels({
                        rain: 0.65,
                        paper: 0.5,
                        fireplace: 0.4,
                      });
                    }}
                    className="rounded-full bg-amber-600/25 border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-[#fde68a] hover:bg-amber-600 hover:text-white transition"
                  >
                    ✨ 비 오는 밤의 책방 프리셋 켜기
                  </button>
                  {hasActiveAsmr && (
                    <button
                      type="button"
                      onClick={() =>
                        onChangeAsmrLevels({ rain: 0, paper: 0, fireplace: 0 })
                      }
                      className="rounded-full bg-[#191310] px-2.5 py-1 text-[11px] text-[#cbbba8] hover:text-white transition"
                    >
                      ASMR 모두 끄기
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* Channel 1: Jazz Piano & Music Box BGM */}
                <div className="flex items-center justify-between rounded-xl bg-[#191310] px-3.5 py-2.5 border border-[#332721]">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="h-4 w-4 text-[#e09f3e]" />
                    <div>
                      <div className="text-xs font-semibold text-[#f8f1e5]">
                        서점 감성 재즈 피아노 & 오르골 선율
                      </div>
                      <div className="text-[10px] text-[#a89888]">
                        출입문 입장과 연동되는 따뜻한 펠트 피아노 배경음악
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleBgm}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                      bgmPlaying
                        ? 'bg-[#c85a28] text-white'
                        : 'bg-[#2a201b] text-[#cbbba8]'
                    }`}
                  >
                    {bgmPlaying ? '켜짐' : '꺼짐'}
                  </button>
                </div>

                {/* Channel 2: Window Rain ASMR */}
                <div className="rounded-xl bg-[#191310] px-3.5 py-2.5 border border-[#332721]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-semibold text-[#f8f1e5]">
                        창밖 레이스 커튼 너머 잔잔한 빗소리
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-sky-300">
                      {Math.round(asmrLevels.rain * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={asmrLevels.rain}
                    onChange={(e) =>
                      onChangeAsmrLevels({
                        ...asmrLevels,
                        rain: parseFloat(e.target.value),
                      })
                    }
                    className="mt-2 h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Channel 3: Paper Page Turn & Pencil Rustle */}
                <div className="rounded-xl bg-[#191310] px-3.5 py-2.5 border border-[#332721]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-amber-300" />
                      <span className="text-xs font-semibold text-[#f8f1e5]">
                        종이 책장 넘기는 소리 & 연필 사각거림
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300">
                      {Math.round(asmrLevels.paper * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={asmrLevels.paper}
                    onChange={(e) =>
                      onChangeAsmrLevels({
                        ...asmrLevels,
                        paper: parseFloat(e.target.value),
                      })
                    }
                    className="mt-2 h-1.5 w-full cursor-pointer accent-amber-400"
                  />
                </div>

                {/* Channel 4: Warm Fireplace / Analog LP Crackle */}
                <div className="rounded-xl bg-[#191310] px-3.5 py-2.5 border border-[#332721]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <span className="text-xs font-semibold text-[#f8f1e5]">
                        모닥불 타닥거림 & 아날로그 LP 온기
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-orange-300">
                      {Math.round(asmrLevels.fireplace * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={asmrLevels.fireplace}
                    onChange={(e) =>
                      onChangeAsmrLevels({
                        ...asmrLevels,
                        fireplace: parseFloat(e.target.value),
                      })
                    }
                    className="mt-2 h-1.5 w-full cursor-pointer accent-orange-400"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTimerAsmrModal(false)}
                className="rounded-xl bg-[#c85a28] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#e06630] transition"
              >
                창 닫고 서점 풍경 감상하며 머물기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 8 (FEATURE #3): VISUAL IMAGE-BASED DOKJA STAMP TOUR CARD
         ============================================================ */}
      {showStampTourModal && (
        <div
          data-testid="stamp-tour-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-2xl w-full overflow-y-auto rounded-3xl bg-[#1b1411] p-4 sm:p-5 text-[#f5efe6] shadow-2xl border border-[#d97736]/60">
            {/* Compact Visual Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#332721]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c85a28] text-white shadow">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif text-base sm:text-lg font-bold text-[#f8f1e5]">
                    독자서점 스탬프 투어
                  </h2>
                  <p className="text-[11px] text-[#b8a99a]">
                    사진을 터치해 5곳을 방문하고 스탬프를 모아보세요
                  </p>
                </div>
              </div>

              {/* 5 Mini Stamp Circles + Close Button */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-full bg-[#120d0b] px-2.5 py-1 border border-[#332721]">
                  {STAMP_MISSIONS.map((m) => {
                    const done = collectedStampIds.includes(m.id);
                    return (
                      <span
                        key={m.id}
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                          done
                            ? 'bg-amber-500 text-[#191310] shadow ring-1 ring-[#fde68a]'
                            : 'bg-[#241c17] text-[#6b5d52] opacity-50'
                        }`}
                      >
                        {done ? '✓' : m.stepNumber}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowStampTourModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a201b] text-[#cbbba8] hover:bg-[#c85a28] hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 3x2 Visual Polaroid Photo Stamp Grid (5 Photo Spots + 1 Leather Bookmark Reward Card) */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAMP_MISSIONS.map((mission) => {
                const isCollected = collectedStampIds.includes(mission.id);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => {
                      setShowStampTourModal(false);
                      onWalkToStampMission(mission);
                    }}
                    className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${
                      isCollected
                        ? 'bg-[#261d17] border-amber-400/80 shadow-lg ring-1 ring-amber-400/30'
                        : 'bg-[#1f1713] border-[#382b24] hover:border-[#c85a28]'
                    }`}
                  >
                    {/* Real Bookstore Spot Photo */}
                    <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-black">
                      <img
                        src={mission.photoUrl}
                        alt={mission.title}
                        className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                          isCollected
                            ? 'brightness-100 contrast-105'
                            : 'brightness-55 contrast-95 grayscale-[30%]'
                        }`}
                      />

                      {/* Step Number Pill on Top-Left */}
                      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-[#fde68a] backdrop-blur-xs">
                        #{mission.stepNumber} {mission.zone}
                      </span>

                      {/* Visual Stamp Overlay on Center of Photo */}
                      {isCollected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                          <div className="-rotate-12 flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-[#fde68a] bg-[#c85a28]/92 text-white shadow-xl ring-4 ring-[#c85a28]/30">
                            <span className="text-lg leading-none">
                              {mission.icon}
                            </span>
                            <span className="mt-0.5 text-[9px] font-extrabold tracking-widest text-[#fde68a]">
                              DOKJA ✓
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-dashed border-[#fde68a]/65 bg-black/45 text-[#f8f1e5] group-hover:bg-[#c85a28]/85 group-hover:border-white transition">
                            <span className="text-base leading-none">
                              {mission.icon}
                            </span>
                            <span className="mt-0.5 text-[9px] font-semibold">
                              이동하기
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Minimal 1-Line Photo Caption */}
                    <div className="flex items-center justify-between px-2.5 py-2">
                      <span className="truncate font-serif text-xs font-bold text-[#f8f1e5]">
                        {mission.title}
                      </span>
                      {isCollected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      ) : (
                        <span className="shrink-0 text-[10px] font-semibold text-[#e09f3e]">
                          👣 방문
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* 6th Card: Visual Golden Leather Bookmark Reward Card */}
              <div
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-3 transition ${
                  collectedStampIds.length >= STAMP_MISSIONS.length
                    ? 'bg-gradient-to-br from-[#472916] via-[#2f1b0e] to-[#1b110b] border-2 border-[#d4af37] shadow-xl'
                    : 'bg-[#18120f] border-dashed border-[#44352c]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-[10px] font-bold text-[#fde68a]">
                    REWARD · {collectedStampIds.length}/{STAMP_MISSIONS.length}
                  </span>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>

                {/* Visual Leather Bookmark Illustration */}
                <div className="my-2 flex flex-col items-center justify-center">
                  <div
                    className={`relative flex h-20 w-12 flex-col items-center justify-center rounded-t-xl rounded-b-md border-2 shadow-inner ${
                      collectedStampIds.length >= STAMP_MISSIONS.length
                        ? 'bg-[#8c4a20] border-[#facc15] text-[#fde68a]'
                        : 'bg-[#2a201b] border-[#4b3b32] text-[#786b5e]'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#191310] mb-1" />
                    <span className="font-serif text-[10px] font-bold tracking-widest [writing-mode:vertical-rl]">
                      독자·딤프치
                    </span>
                  </div>
                </div>

                {collectedStampIds.length >= STAMP_MISSIONS.length ? (
                  !honorarySigned ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={honoraryReaderName}
                        onChange={(e) => setHonoraryReaderName(e.target.value)}
                        placeholder="닉네임 각인"
                        className="w-full min-w-0 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white placeholder-[#a89888] border border-[#d4af37]/50 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const reader =
                            honoraryReaderName.trim() || '명예 독자';
                          setGuestbookEntries((prev) => [
                            {
                              id: `gb_stamp_${Date.now()}`,
                              nickname: `🏅 ${reader}`,
                              message:
                                '독자서점 5대 시그니처 스탬프 투어(5/5) 완주!',
                              favBook: heldBook?.title || '독자서점 스탬프 완주',
                              date: '2026.11.06',
                            },
                            ...prev,
                          ]);
                          setHonorarySigned(true);
                        }}
                        className="shrink-0 rounded-lg bg-[#d4af37] px-2 py-1 text-[10px] font-extrabold text-[#191310]"
                      >
                        각인
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-[11px] font-bold text-[#fde68a]">
                      ✨ {honoraryReaderName.trim() || '명예 독자'} 각인 완료!
                    </div>
                  )
                ) : (
                  <div className="text-center text-[11px] font-semibold text-[#9c8c7c]">
                    🔒 5곳 완주 시 가죽 책갈피 발급
                  </div>
                )}
              </div>
            </div>

            {collectedStampIds.length > 0 && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setHonorarySigned(false);
                    onResetStamps();
                  }}
                  className="text-[11px] text-[#9c8c7c] underline hover:text-white"
                >
                  스탬프 초기화
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
