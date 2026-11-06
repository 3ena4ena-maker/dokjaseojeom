import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  DoorOpen,
  Eye,
  Footprints,
  HelpCircle,
  Info,
  Lamp,
  MapPin,
  Maximize2,
  RotateCcw,
  Sparkles,
  UserCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GENRE_SHELVES,
  REPRESENTATIVE_BOOKS,
  SEAT_OBJECTS,
  SPACE_STORIES,
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
}

const STATE_LABELS: Record<
  CharacterActionState,
  { label: string; color: string }
> = {
  IDLE: {
    label: 'IDLE · 서점 탐색 대기',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  WALKING: {
    label: 'WALKING · 이동 중',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  INTERACTING: {
    label: 'INTERACTING · 책 꺼내는 중',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  SITTING: {
    label: 'SITTING · 착석 휴식 중',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  READING: {
    label: 'READING · 독서 중',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

export const BookstoreHUD: React.FC<BookstoreHUDProps> = ({
  characterPos,
  actionState,
  isSeated,
  activeSeat,
  heldBook,
  activeGenreShelf,
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
  onSelectGenreShelf,
  onOpenBrowsingShelf,
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
}) => {
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
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
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-3 sm:p-4">
      {/* ============================================================
          TOP BAR: BRANDING, ZOOM SLIDER, PANORAMIC VIEW & GENRE BAR
         ============================================================ */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Brand Identity & Character State Machine Indicator */}
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#191310]/90 px-3.5 py-2 shadow-xl border border-[#d4af37]/30 backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c85a28] text-white font-serif font-bold text-base shadow-inner">
              독자
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-sm sm:text-base font-bold tracking-wide text-[#f8f1e5]">
                  독자서점 (DOKJA)
                </h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATE_LABELS[actionState].color}`}
                >
                  {STATE_LABELS[actionState].label}
                </span>
                <span className="hidden md:inline-block rounded-full bg-[#2a201b] px-2 py-0.5 text-[10px] font-medium text-[#fde68a] border border-[#3d2f28]">
                  {isOutsideOnRoad ? '📍 외부 도로 / 독자 입구 앞' : '📍 독자서점 내부'}
                </span>
              </div>
              <p className="text-[11px] text-[#cbbba8]">
                휠·슬라이더로 <span className="text-[#fde68a]">실내 공간 확대/축소(0.9m~4.2m)</span>하며 방향키·클릭 이동
              </p>
            </div>
          </div>

          {/* Right: Space Zoom Slider, Enter Store / Panoramic View, Photos & Minimap */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#191310]/90 px-2.5 py-1.5 shadow-xl border border-[#d4af37]/30 backdrop-blur-md">
            {/* Quick Enter from Road button when outside, or Panoramic Interior View button */}
            {isOutsideOnRoad ? (
              <button
                type="button"
                data-testid="enter-store-btn"
                onClick={onEnterStoreFromRoad}
                className="flex items-center gap-1.5 rounded-xl bg-[#c85a28] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#e06630] transition animate-pulse"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                <span>독자 입구로 들어가기</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="panoramic-view-btn"
                onClick={onSetPanoramicInteriorView}
                title="독자 내부 한눈에 보기 시점"
                className="flex items-center gap-1.5 rounded-xl bg-[#2a201b] px-2.5 py-1.5 text-xs font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition border border-[#d4af37]/30"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">내부 한눈에 보기</span>
              </button>
            )}

            <div className="mx-0.5 h-5 w-px bg-[#3b2e26]" />

            {/* Space Zoom In / Slider / Zoom Out */}
            <div className="flex items-center gap-1.5 rounded-xl bg-[#241c17] px-2 py-1 border border-[#3b2e26]">
              <button
                type="button"
                data-testid="zoom-in-btn"
                onClick={() => onZoomCamera(-0.45)}
                title="공간 확대 (가까이 보기)"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
              >
                <ZoomIn className="h-3.5 w-3.5" />
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
                className="h-1.5 w-20 sm:w-28 cursor-pointer accent-[#c85a28]"
              />
              <button
                type="button"
                data-testid="zoom-out-btn"
                onClick={() => onZoomCamera(0.45)}
                title="공간 축소 (실내 넓게 보기)"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="hidden lg:inline-block min-w-[36px] text-right font-mono text-[10px] text-[#cbbba8]">
                {cameraDistance.toFixed(1)}m
              </span>
            </div>

            <button
              type="button"
              onClick={onResetCamera}
              title="기본 시점 초기화"
              className="flex h-7 w-7 items-center justify-center rounded-xl text-[#e5d5c3] hover:bg-[#c85a28] hover:text-white transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-5 w-px bg-[#3b2e26]" />

            <button
              type="button"
              onClick={() => setShowPhotoGallery(true)}
              className="flex items-center gap-1 rounded-xl bg-[#2a201b] px-2.5 py-1.5 text-xs font-medium text-[#fde68a] hover:bg-[#c85a28] hover:text-white transition"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden md:inline">실제 사진</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMinimap((v) => !v)}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                showMinimap
                  ? 'bg-[#c85a28] text-white'
                  : 'bg-[#2a201b] text-[#e5d5c3] hover:bg-[#3a2d26]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden md:inline">지도</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              title="조작 도움말"
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#2a201b] text-[#e5d5c3] hover:bg-[#c85a28] hover:text-white transition"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Genre Bookshelf & Seat Quick Navigation Bar */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-[#191310]/80 px-3 py-1.5 shadow-lg border border-[#d4af37]/20 backdrop-blur-md no-scrollbar">
          <span className="mr-1 flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-[#d4a359]">
            <Sparkles className="h-3 w-3" /> 서가 이동:
          </span>
          {GENRE_SHELVES.map((shelf) => {
            const isActive = activeGenreShelf?.id === shelf.id;
            return (
              <button
                key={shelf.id}
                type="button"
                data-testid={`genre-btn-${shelf.id}`}
                onClick={() => onSelectGenreShelf(shelf)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#c85a28] text-white shadow-md ring-1 ring-[#fde68a]'
                    : 'bg-[#261e19] text-[#e5d5c3] hover:bg-[#382b24] hover:text-white'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: shelf.accentColor }}
                />
                <span>{shelf.name}</span>
              </button>
            );
          })}
          <div className="mx-1 h-4 w-px bg-[#3b2e26]" />
          <span className="mr-1 whitespace-nowrap text-[11px] font-semibold text-[#a8a29e]">
            의자/휴식:
          </span>
          {SEAT_OBJECTS.map((seat) => (
            <button
              key={seat.id}
              type="button"
              data-testid={`seat-btn-${seat.id}`}
              onClick={() => onSitOnSeat(seat)}
              className={`whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                activeSeat?.id === seat.id
                  ? 'bg-purple-600 text-white ring-1 ring-purple-300'
                  : 'bg-[#261e19] text-[#d6c7b2] hover:bg-[#382b24] hover:text-white'
              }`}
            >
              🪑 {seat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          MIDDLE AREA: UNOBSTRUCTED 3D VIEW (Optional Minimap on Right)
         ============================================================ */}
      <div className="my-auto flex items-start justify-end gap-4 py-2">
        {/* Right: Interactive 2D Floorplan Minimap (Toggleable, hidden by default so 3D view is clean) */}
        {showMinimap && (
          <div className="pointer-events-auto ml-auto flex flex-col rounded-2xl bg-[#191310]/90 p-3 shadow-2xl border border-[#d4af37]/30 backdrop-blur-md w-52">
            <div className="mb-2 flex items-center justify-between">
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
            <div className="relative h-64 w-full rounded-xl bg-[#27201c] border border-[#3e322b] overflow-hidden">
              {/* Carpets representation */}
              <div className="absolute left-[26%] top-[48%] h-[18%] w-[46%] rounded bg-[#7c1d1d]/50 border border-[#d8c3a5]/30" />
              <div className="absolute left-[46%] top-[10%] h-[20%] w-[36%] rounded bg-[#1e293b]/60 border border-[#b39b6e]/30" />

              {/* Left Wall Curation Ledges */}
              <div className="absolute left-0 top-[44%] h-[24%] w-[9%] bg-[#7c4a21] flex items-center justify-center text-[8px] text-amber-200 [writing-mode:vertical-rl]">
                여행·독립출판
              </div>
              {/* Right Wall Main Bookcase */}
              <div className="absolute right-0 top-[6%] h-[66%] w-[10%] bg-[#59351c] flex items-center justify-center text-[8px] text-amber-200 [writing-mode:vertical-rl]">
                메인 6단 월넛 서가
              </div>
              {/* Right-Wall Attached Recommendation Table */}
              <div className="absolute right-[10%] top-[36%] h-[8%] w-[26%] rounded-sm bg-[#8b5a2b] border border-amber-500/40 flex items-center justify-center text-[8px] text-white">
                추천테이블
              </div>
              {/* Back-Left Leather Workshop + Large Table */}
              <div className="absolute left-[4%] top-[10%] h-[20%] w-[38%] rounded-sm bg-[#6e4423]/80 border border-amber-500/30 flex items-center justify-center text-[8px] text-amber-100 text-center leading-tight">
                딤프치 공방 & 큰 테이블
              </div>
              {/* Storefront Wall & Door */}
              <div className="absolute inset-x-0 top-[76%] h-[2%] bg-[#8b3a2b]" />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-[8px] text-[#fde68a]">
                ▲ 외부 도로 & 독자 입구
              </div>

              {/* Waypoint Dots on Minimap */}
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

              {/* Live Character Marker */}
              <div
                style={{ left: `${mapPercentX}%`, top: `${mapPercentY}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <span className="absolute h-5 w-5 animate-ping rounded-full bg-sky-400/50" />
                <span className="relative h-3 w-3 rounded-full bg-sky-400 ring-2 ring-white shadow" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM AREA: SUBTLE SHELF PILL, HELD BOOK BAR & [E] PROMPT
         ============================================================ */}
      <div className="flex flex-col items-center gap-2">
        {/* Subtle 1-Line Shelf Indicator Pill when near a Genre Shelf (Does NOT block screen!) */}
        {activeGenreShelf &&
          !browsingShelf &&
          !inspectingBook &&
          !isReadingModalOpen && (
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#191310]/90 px-4 py-1.5 shadow-lg border border-[#d97736]/45 backdrop-blur-md">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: activeGenreShelf.accentColor }}
              />
              <span className="font-serif text-xs font-bold text-[#f8f1e5]">
                {activeGenreShelf.name} 서가
              </span>
              <span className="hidden sm:inline text-[11px] text-[#cbbba8]">
                · {activeGenreShelf.subtitle}
              </span>
              <button
                type="button"
                data-testid="open-shelf-books-btn"
                onClick={() => onOpenBrowsingShelf(activeGenreShelf)}
                className="ml-1 rounded-full bg-[#c85a28] px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-[#e06630] transition"
              >
                대표 도서 보기
              </button>
            </div>
          )}

        {/* Held Book Status & Action Bar (when character is holding a book in hand) */}
        {heldBook && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1f1713]/95 px-4 py-2 shadow-2xl border border-[#e09f3e]/60 backdrop-blur-md max-w-2xl w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded shadow-md border border-white/20 font-serif text-xs font-bold"
                style={{
                  backgroundColor: heldBook.coverColor,
                  color: heldBook.textColor,
                }}
              >
                독자
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-[#c85a28]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#fde68a] border border-[#c85a28]/50">
                    손에 들고 있는 도서
                  </span>
                  <span className="text-[11px] text-[#cbbba8]">
                    {heldBook.genreName}
                  </span>
                </div>
                <div className="truncate font-serif text-sm font-bold text-[#f8f1e5]">
                  『{heldBook.title}』
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {actionState === 'READING' ? (
                <button
                  type="button"
                  onClick={onStopReading}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-500 transition"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>책 덮기 [R]</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartReading}
                  className="flex items-center gap-1.5 rounded-xl bg-[#c85a28] px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-[#e06630] transition"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>
                    {isSeated ? '앉아서 책 읽기 [R]' : '책 펼쳐 읽기 [R]'}
                  </span>
                </button>
              )}

              {!isSeated && (
                <button
                  type="button"
                  onClick={onSitAndReadNearest}
                  className="flex items-center gap-1 rounded-xl bg-purple-700/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 transition"
                >
                  <span>🪑 의자에 앉아 읽기</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectBook(heldBook)}
                className="flex items-center gap-1 rounded-xl bg-[#2e231d] px-2.5 py-1.5 text-xs font-medium text-[#fde68a] hover:bg-[#3d2f28] transition"
              >
                <Info className="h-3.5 w-3.5" />
                <span>표지·상세정보</span>
              </button>

              <button
                type="button"
                onClick={onReturnHeldBook}
                className="flex items-center gap-1 rounded-xl bg-[#2a201b] px-2.5 py-1.5 text-xs font-medium text-[#cbbba8] hover:bg-stone-700 hover:text-white transition"
              >
                <span>책장에 다시 꽂기 [Q]</span>
              </button>
            </div>
          </div>
        )}

        {/* Seated Status Banner (when seated on a chair/bench/stool) */}
        {isSeated && activeSeat && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-purple-950/90 px-4 py-2 shadow-xl border border-purple-400/40 backdrop-blur-md">
            <span className="text-xs font-medium text-purple-100">
              🪑 현재 <strong>{activeSeat.name}</strong>에 앉아 있습니다.
            </span>
            {heldBook && actionState !== 'READING' && (
              <button
                type="button"
                onClick={onStartReading}
                className="rounded-xl bg-[#c85a28] px-3 py-1 text-xs font-semibold text-white hover:bg-[#e06630] transition"
              >
                📖 앉은 상태로 책 읽기 [R]
              </button>
            )}
            <button
              type="button"
              onClick={onStandUp}
              className="rounded-xl bg-purple-700 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-600 transition"
            >
              일어나기 [Space / 방향키]
            </button>
          </div>
        )}

        {/* Context-Sensitive Interaction Prompt ([E] 책 꺼내기 / [E] 앉기 / [E] 책장 구경하기) */}
        {activePrompt && actionState !== 'INTERACTING' && (
          <button
            type="button"
            onClick={onTriggerPromptAction}
            className="pointer-events-auto group flex items-center gap-3 rounded-2xl bg-[#191310]/95 px-4 py-2.5 shadow-2xl border-2 border-[#e09f3e] hover:bg-[#c85a28] transition-all transform hover:scale-105"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e09f3e] text-xs font-extrabold text-[#191310] group-hover:bg-white">
              {activePrompt.keyHint}
            </span>
            <div className="text-left">
              <div className="text-xs sm:text-sm font-bold text-[#f8f1e5] group-hover:text-white">
                {activePrompt.label}
              </div>
              <div className="text-[10px] text-[#cbbba8] group-hover:text-amber-100 max-w-xs truncate">
                {activePrompt.sublabel}
              </div>
            </div>
          </button>
        )}

        {/* Bottom Helper Strip + Mobile Touch D-Pad */}
        <div className="flex w-full items-end justify-between gap-2">
          {/* Mobile Touch D-Pad Controls */}
          <div className="pointer-events-auto flex sm:hidden flex-col items-center gap-1 rounded-2xl bg-[#191310]/85 p-2 border border-[#d4af37]/30 backdrop-blur-sm">
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
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a201b] text-sm font-bold text-[#fde68a] active:bg-[#c85a28]"
            >
              ▲
            </button>
            <div className="flex gap-1">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a201b] text-sm font-bold text-[#fde68a] active:bg-[#c85a28]"
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a201b] text-sm font-bold text-[#fde68a] active:bg-[#c85a28]"
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a201b] text-sm font-bold text-[#fde68a] active:bg-[#c85a28]"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Keyboard & Click Controls Summary Pill */}
          <div className="pointer-events-auto mx-auto hidden sm:flex items-center gap-4 rounded-full bg-[#191310]/85 px-4 py-1 text-[11px] text-[#cbbba8] border border-[#d4af37]/25 backdrop-blur-md">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#2e231d] px-1.5 py-0.5 text-[10px] font-semibold text-[#fde68a]">
                WASD / 방향키
              </kbd>
              이동
            </span>
            <span className="flex items-center gap-1">
              <Footprints className="h-3.5 w-3.5 text-[#38bdf8]" />
              <strong className="text-[#f8f1e5]">바닥 클릭</strong> 이동
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#2e231d] px-1.5 py-0.5 text-[10px] font-semibold text-[#fde68a]">
                마우스 드래그 · 휠
              </kbd>
              시점 회전 & 확대/축소
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#2e231d] px-1.5 py-0.5 text-[10px] font-semibold text-[#fde68a]">
                E
              </kbd>
              상호작용
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-[#2e231d] px-1.5 py-0.5 text-[10px] font-semibold text-[#fde68a]">
                R
              </kbd>
              책 읽기
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODAL 0: ON-DEMAND SHELF BOOK BROWSER (Only opens when user clicks a shelf or presses E on shelf)
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
                <span>✨ 선택 가능한 대표 도서 ({browsingShelfBooks.length}권)</span>
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
              {/* Stylized 3D Book Cover Visual */}
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

              {/* Book Metadata & Curator Commentary */}
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

                {/* Action Buttons */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#362a23] pt-4">
                  <button
                    type="button"
                    onClick={onStartReading}
                    className="flex items-center gap-1.5 rounded-xl bg-[#c85a28] px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-[#e06630] transition"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>책 펼쳐 읽기 (독서 애니메이션)</span>
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
          MODAL 2: OPEN BOOK READING SPREAD (CHARACTER READING STATE)
         ============================================================ */}
      {isReadingModalOpen && heldBook && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-3xl flex-col px-4">
          <div className="relative rounded-3xl bg-[#f7f1e3] p-6 text-[#292524] shadow-2xl border-4 border-[#7c4a21]">
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
                책 덮기 [R / ESC]
              </button>
            </div>

            {/* Two-Page Open Book Spread */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-serif">
              <div className="sm:border-r border-[#d6cbb9] sm:pr-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#292524]">
                  {heldBook.excerpt[0]}
                </p>
                <div className="mt-4 text-[11px] text-[#78716c]">— p. 42</div>
              </div>
              <div className="sm:pl-2">
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#292524]">
                  {heldBook.excerpt[1]}
                </p>
                <div className="mt-4 text-right text-[11px] text-[#78716c]">
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

            {/* Real Bookstore Reference Photo of this Table */}
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#3d2f28]">
              <img
                src={inspectingTable.realPhotoUrl}
                alt={inspectingTable.name}
                className="h-44 w-full object-cover"
              />
            </div>

            {/* Table Actions: Place Held Book / Pick Up Placed Book / Sit / Toggle Lamp */}
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

            {/* Guestbook section on Central Recommendation Table */}
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
                    placeholder="서점 방문 소감이나 오늘 만난 책 문장을 남겨보세요..."
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

            <h2 className="font-serif text-2xl font-bold text-[#f8f1e5]">
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
                  1. 외부 도로에서 독자 입구로 입장 & 공간 확대/축소
                </strong>
                <p className="mt-1">
                  • 도로 위에서 시작해 돌계단과 열린 출입문을 통과해 서점 내부로 걸어 들어갈 수 있습니다.
                  <br />• 마우스 휠 또는 상단 <strong>확대/축소 슬라이더(0.8m~10.5m)</strong>로 공간을 클로즈업하거나 전체를 넓게 조망하며 이동할 수 있습니다.
                </p>
              </div>
              <div className="rounded-xl bg-[#241c17] p-3 border border-[#362a23]">
                <strong className="text-[#f8f1e5]">
                  2. 책장 구경하기 & 책 꺼내서 들고 다니기
                </strong>
                <p className="mt-1">
                  • 시야를 가리는 자동 팝업 없이 3D 서가를 쾌적하게 감상할 수 있습니다.
                  <br />• 책장의 도서를 직접 클릭하거나 <strong>[E] 키</strong>를 누르면 대표 도서 목록을 열거나 캐릭터가 책을 꺼내 손에 듭니다.
                </p>
              </div>
              <div className="rounded-xl bg-[#241c17] p-3 border border-[#362a23]">
                <strong className="text-[#f8f1e5]">
                  3. 의자·소파에 앉기 & 책 읽기 애니메이션
                </strong>
                <p className="mt-1">
                  • 창가 독서 의자, 통원목 벤치 소파, 노란 스툴, 공방 의자를 클릭하거나 가까이 가서 <strong>[E] 키</strong>로 앉을 수 있습니다.
                  <br />• 책을 든 상태에서 <strong>[R] 키</strong>를 누르면 서서 또는 앉은 상태로 책을 펼쳐 읽습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
