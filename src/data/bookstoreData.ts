import {
  BookItem,
  GenreShelfData,
  ObstacleBox,
  SeatObjectData,
  SpaceStoryData,
  TableObjectData,
  WaypointNode,
} from '../types';

// Starts on the road/sidewalk outside the '독자' red-brick entrance, facing the open double doors (-Z)
export const CHARACTER_START_POSITION: [number, number, number] = [0.15, 0, 10.35];
export const CHARACTER_START_ROTATION_Y = Math.PI; // Facing North (-Z) into the store

export const GENRE_SHELVES: GenreShelfData[] = [
  {
    id: 'dokja_curation',
    name: '독자 추천 도서',
    englishName: 'DOKJA CURATION',
    subtitle: '책방지기가 직접 고른 독자 추천 도서',
    description: '책방지기가 직접 고르고 소개하는 독자 추천 도서 서가입니다.',
    locationLabel: '좌측 전면 추천 서가',
    signPosition: [-4.12, 1.98, 3.0],
    signRotationY: Math.PI / 2,
    interactionPoint: [-2.45, 0, 2.85],
    interactionFacingY: -Math.PI / 2,
    triggerRadius: 2.2,
    accentColor: '#d97736',
    realPhotoUrl: '/photos/left_wall_curation.jpg',
  },
  // 우측 메인 5열 책장: 책장을 바라볼 때 왼쪽(Z = 1.01)부터 오른쪽(Z = 4.87) 순서대로 배치
  {
    id: 'animation_comics',
    name: '애니메이션 & 만화',
    englishName: 'ANIMATION & COMICS',
    subtitle: '애니메이션 아트북과 만화 코너',
    description: '애니메이션 아트북과 그래픽노블, 만화가 모여 있는 서가입니다.',
    locationLabel: '메인 책장 왼쪽 1열',
    signPosition: [3.95, 2.38, 1.01],
    signRotationY: -Math.PI / 2,
    interactionPoint: [2.35, 0, 1.15],
    interactionFacingY: Math.PI / 2,
    triggerRadius: 1.85,
    accentColor: '#eab308',
    realPhotoUrl: '/photos/main_bookshelf_front.jpg',
  },
  {
    id: 'novel',
    name: '소설',
    englishName: 'LITERATURE & FICTION',
    subtitle: '한국문학과 세계문학 소설 코너',
    description: '깊은 여운을 남기는 장편소설과 문학 도서가 꽂혀 있는 서가입니다.',
    locationLabel: '메인 책장 왼쪽 2열',
    signPosition: [3.95, 2.38, 1.97],
    signRotationY: -Math.PI / 2,
    interactionPoint: [2.35, 0, 1.97],
    interactionFacingY: Math.PI / 2,
    triggerRadius: 1.85,
    accentColor: '#c85a28',
    realPhotoUrl: '/photos/main_bookshelf_front.jpg',
  },
  {
    id: 'marketing_indie',
    name: '마케팅, 독립출판물',
    englishName: 'MARKETING & INDEPENDENT',
    subtitle: '마케팅 인사이트와 독립출판물 코너',
    description: '감각적인 마케팅 도서와 개성 있는 독립출판물이 함께 놓인 서가입니다.',
    locationLabel: '메인 책장 중앙 3열',
    signPosition: [3.95, 2.38, 2.92],
    signRotationY: -Math.PI / 2,
    interactionPoint: [2.35, 0, 2.92],
    interactionFacingY: Math.PI / 2,
    triggerRadius: 1.85,
    accentColor: '#10b981',
    realPhotoUrl: '/photos/main_bookshelf_front.jpg',
  },
  {
    id: 'humanities',
    name: '인문학',
    englishName: 'HUMANITIES & PHILOSOPHY',
    subtitle: '철학·역사·인문교양 코너',
    description: '삶과 세계를 깊이 들여다보는 철학·인문 도서가 모인 서가입니다.',
    locationLabel: '메인 책장 왼쪽 4열',
    signPosition: [3.95, 2.38, 3.88],
    signRotationY: -Math.PI / 2,
    interactionPoint: [2.35, 0, 3.88],
    interactionFacingY: Math.PI / 2,
    triggerRadius: 1.85,
    accentColor: '#6366f1',
    realPhotoUrl: '/photos/main_bookshelf_front.jpg',
  },
  {
    id: 'art_arch_travel',
    name: '예술, 건축, 여행',
    englishName: 'ART, ARCHITECTURE & TRAVEL',
    subtitle: '예술 화집과 건축, 여행 에세이 코너',
    description: '미술과 건축 아카이브, 낯선 도시의 여행기를 만날 수 있는 서가입니다.',
    locationLabel: '메인 책장 오른쪽 끝 5열',
    signPosition: [3.95, 2.38, 4.87],
    signRotationY: -Math.PI / 2,
    interactionPoint: [2.35, 0, 4.75],
    interactionFacingY: Math.PI / 2,
    triggerRadius: 1.85,
    accentColor: '#ec4899',
    realPhotoUrl: '/photos/entrance_interior.jpg',
  },
];

// 장르당 대표 도서 1권씩 진열 (클릭 시 표지와 2줄 소개 표시)
export const REPRESENTATIVE_BOOKS: BookItem[] = [
  // 좌측 벽면: 독자 추천 도서 — 클릭 시 박근태 『동경전 (東京傳)』 표시
  {
    id: 'book_tokyo_den',
    isbn: '979-11-971204-2-8',
    title: '동경전 (東京傳)',
    author: '박근태',
    publisher: '도서출판 독자',
    publishedYear: '2024',
    genreId: 'dokja_curation',
    genreName: '독자 추천 도서',
    spineColor: '#ffffff',
    coverColor: '#ffffff',
    accentColor: '#334155',
    textColor: '#1c1917',
    shelfPosition: [-4.21, 1.21, 1.52],
    shelfRotation: [0, Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [-2.65, 0, 1.65],
    interactionFacingY: -Math.PI / 2,
    summary:
      '도쿄의 고요한 거리와 일상의 풍경, 빛이 머무는 찰나의 순간들을 담담한 시선으로 포착한 박근태 작가의 사진집입니다.\n오랜 시간 마주해 온 도시의 결을 진솔한 사진 아카이브로 한 권에 담아냈습니다.',
    curatorNote: '독자서점 박근태 책방지기의 사진집 『동경전 (東京傳)』입니다.',
    excerpt: [
      '“오래된 도시의 골목을 걷는 일은 한 권의 두꺼운 책을 천천히 넘기는 일과 닮아 있다.\n간판의 바랜 글씨와 저녁 무렵 켜지는 외등 사이로 우리가 잊고 지냈던 시간의 결이 조용히 드러난다.”',
      '“2014년 첫 방문 이후 오랜 시간 마주해 온 도쿄의 거리와 사람들의 찰나.\n카메라 뷰파인더 너머로 붙잡은 고요한 빛의 기록들을 이 한 권에 모았다.”',
    ],
    tags: ['박근태', '동경전', '사진집'],
    realSpotDescription: '좌측 독자 추천 도서 서가',
  },

  // 1. 왼쪽 1열 (Z = 1.01): 애니메이션 & 만화 (대표 1권)
  {
    id: 'book_spirited_away',
    isbn: '978-89-527-8912-9',
    title: '센과 치히로의 행방불명 아트북',
    author: '미야자키 하야오 · 스튜디오 지브리',
    publisher: '대원씨아이',
    publishedYear: '2021',
    genreId: 'animation_comics',
    genreName: '애니메이션 & 만화',
    spineColor: '#bbf7d0',
    coverColor: '#e6f4ea',
    accentColor: '#15803d',
    textColor: '#14532d',
    shelfPosition: [4.06, 1.27, 1.01],
    shelfRotation: [0, -Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [2.55, 0, 1.15],
    interactionFacingY: Math.PI / 2,
    summary:
      '스튜디오 지브리의 수채화 배경 미술과 캐릭터 스케치 과정을 생생하게 담은 공식 아트북입니다.\n신비로운 온천장과 바다 위를 달리는 기차의 색채 설계를 한눈에 감상할 수 있습니다.',
    curatorNote: '애니메이션 & 만화 코너의 대표 아트북입니다.',
    excerpt: [
      '“한 번 일어난 일은 잊히지 않는단다. 단지 기억해내지 못할 뿐이지.”\n— 제니바가 치히로에게 건네는 말 중에서',
      '“수채화 물감으로 겹겹이 칠해 올린 유바바의 온천장과 바다 위를 달리는 기차의 풍경.\n수작업 애니메이션이 가진 영원한 생명력이 페이지마다 살아 숨 쉰다.”',
    ],
    tags: ['지브리', '아트북'],
    realSpotDescription: '메인 책장 왼쪽 1열 (애니메이션 & 만화)',
  },

  // 2. 왼쪽 2열 (Z = 1.97): 소설 (대표 1권)
  {
    id: 'book_human_acts',
    isbn: '978-89-364-3412-0',
    title: '소년이 온다',
    author: '한강',
    publisher: '창비',
    publishedYear: '2014',
    genreId: 'novel',
    genreName: '소설',
    spineColor: '#1e293b',
    coverColor: '#1e293b',
    accentColor: '#64748b',
    textColor: '#f8fafc',
    shelfPosition: [4.06, 1.27, 1.97],
    shelfRotation: [0, -Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [2.55, 0, 1.97],
    interactionFacingY: Math.PI / 2,
    summary:
      '1980년 5월의 광주와 남겨진 사람들의 시간을 시적이고 강렬한 문장으로 그려낸 장편소설입니다.\n상처 속에서도 끝내 꺼지지 않는 인간의 존엄과 기억의 빛을 조용히 응시합니다.',
    curatorNote: '소설 코너의 대표 장편소설입니다.',
    excerpt: [
      '“비가 올 것 같아.\n어떻게든 비가 오지 않기를 바랐는데.\n너는 눈을 감고, 차가운 계단 위에 누워 있는 친구들의 이름을 하나씩 불러본다.”',
      '“인간은 무엇인가. 인간이 무엇이지 않기 위해 우리는 무엇을 해야 하는가.\n작은 촛불 하나를 켜듯 문장들이 어둠 속을 걸어 나온다.”',
    ],
    tags: ['한국소설', '장편소설'],
    realSpotDescription: '메인 책장 왼쪽 2열 (소설)',
  },

  // 3. 왼쪽 3열 (Z = 2.92): 마케팅, 독립출판물 (대표 1권)
  {
    id: 'book_marketers_work',
    isbn: '979-11-6220-291-3',
    title: '마케터의 일',
    author: '장인성',
    publisher: '북스톤',
    publishedYear: '2018',
    genreId: 'marketing_indie',
    genreName: '마케팅, 독립출판물',
    spineColor: '#f59e0b',
    coverColor: '#fef3c7',
    accentColor: '#b45309',
    textColor: '#292524',
    shelfPosition: [4.06, 1.27, 2.92],
    shelfRotation: [0, -Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [2.55, 0, 2.92],
    interactionFacingY: Math.PI / 2,
    summary:
      '일상의 작은 관찰에서 출발해 사람의 마음을 움직이는 실전 마케팅 감각을 다룬 책입니다.\n거창한 이론 대신 현장에서 부딪히며 길어 올린 단단한 일의 태도와 시선을 전합니다.',
    curatorNote: '마케팅, 독립출판물 코너의 대표 도서입니다.',
    excerpt: [
      '“좋은 마케팅은 특별한 기술이 아니라 상대를 유심히 바라보고 진심으로 이해하려는 다정한 관찰에서 시작된다.”',
      '“내가 좋아하는 것을 남들도 좋아하게 만드는 일, 그 설레는 고민의 기록들이 매일의 일을 자라나게 한다.”',
    ],
    tags: ['마케팅', '일의태도'],
    realSpotDescription: '메인 책장 중앙 3열 (마케팅, 독립출판물)',
  },

  // 4. 왼쪽 4열 (Z = 3.88): 인문학 (대표 1권)
  {
    id: 'book_nietzsche_at_forty',
    isbn: '979-11-87142-56-0',
    title: '마흔에 읽는 니체',
    author: '장재형',
    publisher: '유노북스',
    publishedYear: '2018',
    genreId: 'humanities',
    genreName: '인문학',
    spineColor: '#e2e8f0',
    coverColor: '#f8fafc',
    accentColor: '#475569',
    textColor: '#1e293b',
    shelfPosition: [4.06, 1.27, 3.88],
    shelfRotation: [0, -Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [2.55, 0, 3.88],
    interactionFacingY: Math.PI / 2,
    summary:
      '흔들리는 삶의 한가운데서 나다운 삶을 긍정하는 니체의 철학을 쉽게 풀어낸 인문서입니다.\n운명을 사랑하라는 아모르 파티의 지혜로 오늘을 단단하게 살아갈 힘을 건넵니다.',
    curatorNote: '인문학 코너의 대표 철학 입문서입니다.',
    excerpt: [
      '“네 삶에 일어나는 모든 필연을 사랑하라(Amor Fati).\n고통마저도 나를 더 깊은 곳으로 이끄는 돛단배의 바람으로 삼을 때, 인간은 비로소 자기 삶의 주인이 된다.”',
      '“남들의 기준이 아닌 나만의 문장으로 오늘을 살아가는 것, 그것이 니체가 말하는 초인의 첫걸음이다.”',
    ],
    tags: ['인문학', '니체철학'],
    realSpotDescription: '메인 책장 왼쪽 4열 (인문학)',
  },

  // 5. 왼쪽 5열 (Z = 4.87): 예술, 건축, 여행 (대표 1권)
  {
    id: 'book_paris_art_travel',
    isbn: '979-11-88990-12-5',
    title: '파리는 그림',
    author: '양소영',
    publisher: '아트북스',
    publishedYear: '2021',
    genreId: 'art_arch_travel',
    genreName: '예술, 건축, 여행',
    spineColor: '#dbeafe',
    coverColor: '#eff6ff',
    accentColor: '#1d4ed8',
    textColor: '#1e3a8a',
    shelfPosition: [4.06, 1.27, 4.87],
    shelfRotation: [0, -Math.PI / 2, 0],
    displayType: 'face-out',
    interactionPoint: [2.55, 0, 4.75],
    interactionFacingY: Math.PI / 2,
    summary:
      '인상주의 화가들이 사랑한 파리의 거리와 고풍스러운 건축 풍경을 산책하듯 담아낸 책입니다.\n명화 한 점과 골목의 빛을 따라가며 예술과 건축, 여행이 만나는 순간을 전합니다.',
    curatorNote: '예술, 건축, 여행 코너의 대표 도서입니다.',
    excerpt: [
      '“조르주 쇠라가 수만 개의 색점으로 쌓아 올린 에펠탑.\n멀리서 바라볼 때 비로소 하나의 찬란한 빛으로 통합되는 점묘화처럼, 도시의 하루도 무수한 순간들의 합창이다.”',
      '“센강의 물결에 비친 가스등 불빛과 오래된 건축물 위로 내려앉는 오후가 책장을 펼치는 순간 눈앞에 펼쳐진다.”',
    ],
    tags: ['예술', '건축', '여행'],
    realSpotDescription: '메인 책장 오른쪽 5열 (예술, 건축, 여행)',
  },
];

export const SEAT_OBJECTS: SeatObjectData[] = [
  {
    id: 'seat_window_chair',
    name: '창가 독서 의자',
    type: 'chair',
    description: '창가 스탠드 조명 아래서 조용히 책을 읽을 수 있는 자리입니다.',
    seatPosition: [-3.55, 0, 5.12],
    seatFacingY: 0, // Facing +Z toward the window desk
    approachPoint: [-3.1, 0, 4.45],
    triggerRadius: 1.5,
  },
  {
    id: 'seat_yellow_stool',
    name: '서가 앞 노란 스툴',
    type: 'chair',
    description: '서가 앞에서 책을 꺼내 가볍게 앉아 펼쳐보기 좋은 스툴입니다.',
    seatPosition: [3.28, 0, 4.85],
    seatFacingY: -Math.PI / 2, // Facing -X into the room
    approachPoint: [2.55, 0, 4.75],
    triggerRadius: 1.4,
  },
  {
    id: 'seat_workshop_chair',
    name: '독서 테이블 의자',
    type: 'chair',
    description:
      '책방지기의 작업공간이자 손님들도 앉아 책을 읽을 수 있는 자리입니다. 편하게 앉아서 책을 보세요.',
    seatPosition: [0.35, 0, -3.45],
    seatFacingY: -Math.PI / 2, // Facing -X toward the central-back large table
    approachPoint: [0.95, 0, -3.45],
    triggerRadius: 1.5,
  },
];

export const TABLE_OBJECTS: TableObjectData[] = [
  {
    id: 'table_center_recommend',
    name: '추천 도서 테이블',
    description:
      '책방지기 추천 도서와 엽서, 독자서점 사용설명이 적혀있는 테이블입니다.',
    position: [2.65, 0, -0.05], // Flush against the right wall wood pillar (X = 1.45..3.85)
    bookPlacePosition: [2.05, 0.84, 0.22],
    approachPoint: [2.15, 0, 1.15],
    approachFacingY: Math.PI, // Facing -Z toward the table
    triggerRadius: 1.85,
    realPhotoUrl: '/photos/center_table.jpg',
  },
  {
    id: 'table_window_desk',
    name: '창가 독서 테이블',
    description: '창가 조명 아래서 조용히 독서하기 좋은 1인 책상입니다.',
    position: [-3.58, 0, 5.95],
    bookPlacePosition: [-3.35, 0.78, 5.78],
    approachPoint: [-3.1, 0, 4.45],
    approachFacingY: 0,
    triggerRadius: 1.75,
    linkedSeatId: 'seat_window_chair',
    realPhotoUrl: '/photos/entrance_interior.jpg',
  },
  {
    id: 'table_leather_workbench',
    name: '책방지기 작업공간 & 손님 독서 테이블',
    description:
      '책방지기의 작업공간이기도 하지만, 손님들이 앉아서 책을 읽어도 되는 공간입니다. 편하게 앉아서 책을 보세요.',
    position: [-0.85, 0, -3.55],
    bookPlacePosition: [-0.35, 0.84, -3.2],
    approachPoint: [0.95, 0, -3.35],
    approachFacingY: -Math.PI / 2,
    triggerRadius: 2.0,
    linkedSeatId: 'seat_workshop_chair',
    realPhotoUrl: '/photos/personal_study_table.jpg',
  },
];

export const SPACE_STORIES: SpaceStoryData[] = [
  {
    id: 'story_duck_mascot',
    title: '마스코트 오리와 전구 트리',
    subtitle: '독자서점의 작은 포토존',
    category: '공간 안내 · 포토존',
    description: '하얀 스툴 위 오리 인형과 따뜻한 전구 트리가 반겨주는 코너입니다.',
    details: [
      '시그니처 하얀 오리 인형',
      '은은한 웜화이트 전구 트리',
    ],
    position: [-3.65, 0.85, 0.65],
    approachPoint: [-2.45, 0, 1.45],
    approachFacingY: -Math.PI * 0.72,
    triggerRadius: 1.65,
    realPhotoUrl: '/photos/duck_and_divider.jpg',
  },
  {
    id: 'story_divider_cabinet',
    title: '파티션 장식장',
    subtitle: '책방지기의 빈티지 수집품 진열장',
    category: '공간 안내 · 컬렉션',
    description: '서점과 안쪽 공간을 나누며 빈티지 소품들을 전시한 오픈 장식장입니다.',
    details: [
      '빈티지 재봉틀과 클래식 가죽 가방',
      '음반 CD와 투명 스피커, 레고 컬렉션',
    ],
    position: [-2.95, 1.4, -0.05],
    approachPoint: [-2.15, 0, 1.35],
    approachFacingY: Math.PI,
    triggerRadius: 1.75,
    realPhotoUrl: '/photos/duck_and_divider.jpg',
  },
  {
    id: 'story_chandelier',
    title: '오렌지 천장과 크리스탈 샹들리에',
    subtitle: '독자서점의 따뜻한 조명',
    category: '공간 안내 · 조명',
    description: '테라코타 오렌지 천장과 샹들리에가 서점을 아늑하게 비춥니다.',
    details: [
      '테라코타 오렌지 천장과 6구 샹들리에',
      '붉은 페르시안 카펫 라운지',
    ],
    position: [0.3, 1.5, 3.1],
    approachPoint: [0.25, 0, 4.35],
    approachFacingY: Math.PI,
    triggerRadius: 1.5,
    realPhotoUrl: '/photos/overview_chandelier.jpg',
  },
  {
    id: 'story_camera_leather',
    title: '책방지기 진열장',
    subtitle: '가죽제품 · 인증서 아카이브 · 사진작가 책방지기의 카메라',
    category: '책방지기 진열장',
    description:
      '가죽 제품과 인증서 아카이브, 그리고 책방지기의 또 다른 직업인 사진작가로 활동하며 사용한 카메라가 진열되어 있습니다.',
    details: [
      '수제 가죽 제품과 각종 자격·인증서 아카이브',
      '책방지기가 사진작가로 활동하며 사용한 카메라 컬렉션',
    ],
    position: [4.15, 1.35, -5.38],
    approachPoint: [2.25, 0, -4.85],
    approachFacingY: Math.PI / 2,
    triggerRadius: 1.95,
    realPhotoUrl: '/photos/camera_leather_shelf.jpg',
  },
  {
    id: 'story_leather_workshop',
    title: '가죽공방 ‘딤프치’ 작업대',
    subtitle: '통가죽과 가죽공예 도구 작업 공간',
    category: '공간 안내 · 가죽공방',
    description: '통가죽과 가죽 지관통, 수공구들이 놓인 실제 가죽공예 작업 공간입니다.',
    details: [
      '벽면 통가죽 원피와 가죽 원단 롤·지관통',
      '가죽 작업대와 이동식 미싱·피할기',
    ],
    position: [-2.85, 1.4, -2.85],
    approachPoint: [0.85, 0, -2.25],
    approachFacingY: -Math.PI / 2,
    triggerRadius: 1.95,
    realPhotoUrl: '/photos/leather_workshop.jpg',
  },
  {
    id: 'story_personal_study',
    title: '책방지기 작업공간 & 손님 독서 테이블',
    subtitle: '편하게 앉아서 책을 읽어도 되는 열린 테이블',
    category: '공간 안내 · 독서 & 작업공간',
    description:
      '책방지기의 작업공간이기도 하지만, 손님들이 앉아서 책을 읽어도 되는 공간입니다. 편하게 앉아서 책을 보세요.',
    details: [
      '손님 누구나 편하게 앉아 책을 읽을 수 있는 원목 테이블',
      '초록 발커버를 신은 원목 의자 4개',
    ],
    position: [-0.75, 1.15, -4.05],
    approachPoint: [0.95, 0, -3.55],
    approachFacingY: -Math.PI / 2,
    triggerRadius: 1.95,
    realPhotoUrl: '/photos/personal_study_table.jpg',
  },
  {
    id: 'story_sink_and_mugs',
    title: '싱크대 · 커피바 & 2단 머그컵 컬렉션',
    subtitle: '싱크대·컵은 책방지기 전용 · 정수기는 사용 가능',
    category: '공간 안내 · 다과 공간',
    description:
      '싱크대와 머그컵은 책방지기 외 사용할 수 없습니다. 정수기는 편하게 사용 가능합니다.',
    details: [
      '싱크대와 머그컵은 책방지기 외 사용 불가',
      '정수기는 손님도 자유롭게 사용 가능',
    ],
    position: [-2.15, 1.45, -6.15],
    approachPoint: [0.65, 0, -4.65],
    approachFacingY: Math.PI * 0.85,
    triggerRadius: 2.1,
    realPhotoUrl: '/photos/sink_and_mugs.jpg',
  },
];

// Collision boxes matching furniture, walls, and the entrance doorway (sealed flush to walls so visitor can never clip behind or inside furniture)
export const OBSTACLE_BOXES: ObstacleBox[] = [
  // Storefront Left Wall (West of the entrance door at Z = 6.6)
  {
    id: 'obs_storefront_left_wall',
    name: '출입문 좌측 외벽 및 창가',
    minX: -4.7,
    maxX: -0.72,
    minZ: 6.28,
    maxZ: 7.05,
    height: 3.4,
    blocksCamera: false,
  },
  // Storefront Right Wall (East of the entrance door at Z = 6.6)
  {
    id: 'obs_storefront_right_wall',
    name: '출입문 우측 외벽 및 쇼윈도',
    minX: 1.05,
    maxX: 4.7,
    minZ: 6.28,
    maxZ: 7.05,
    height: 3.4,
    blocksCamera: false,
  },
  // Right wall main bookcase + back camera/leather/wine shelf (runs along X = 3.72..4.7)
  {
    id: 'obs_right_bookcase',
    name: '우측 메인 대형 서가',
    minX: 3.72,
    maxX: 4.7,
    minZ: -6.8,
    maxZ: 5.65,
    height: 3.2,
    blocksCamera: true,
  },
  // Entrance right corner plants & wine bottles (sealed flush to East & South walls)
  {
    id: 'obs_entrance_plants',
    name: '입구 화분 및 와인병 코너',
    minX: 2.2,
    maxX: 4.7,
    minZ: 5.48,
    maxZ: 6.5,
    height: 1.6,
    blocksCamera: false,
  },
  // Left wall front 3-tier book ledges (sealed seamlessly between divider shelf and window desk)
  {
    id: 'obs_left_ledges',
    name: '좌측 전면 큐레이션 서가',
    minX: -4.7,
    maxX: -3.82,
    minZ: 0.7,
    maxZ: 5.3,
    height: 2.8,
    blocksCamera: true,
  },
  // Window reading desk & yellow book cart (sealed flush to West & South walls)
  {
    id: 'obs_window_desk',
    name: '창가 독서 데스크 및 북카트',
    minX: -4.7,
    maxX: -1.42,
    minZ: 5.26,
    maxZ: 6.5,
    height: 1.1,
    blocksCamera: false,
  },
  // Duck mascot & divider open shelf (sealed flush to West wall)
  {
    id: 'obs_divider_shelf',
    name: '파티션 장식장 및 오리 마스코트',
    minX: -4.7,
    maxX: -1.5,
    minZ: -0.58,
    maxZ: 0.82,
    height: 2.7,
    blocksCamera: false,
  },
  // Right-wall attached recommendation table + industrial leather machine behind it (sealed flush to East wall)
  {
    id: 'obs_center_table_and_machine',
    name: '우측 벽 추천 도서 테이블 및 가죽 피할기',
    minX: 1.32,
    maxX: 4.7,
    minZ: -1.62,
    maxZ: 0.56,
    height: 1.2,
    blocksCamera: false,
  },
  // Back-right folding minivelo bicycle & leaning boards/props (sealed flush to East bookcase)
  {
    id: 'obs_minivelo_bike',
    name: '후면 미니벨로 자전거 및 소품 코너',
    minX: 2.42,
    maxX: 4.7,
    minZ: -2.92,
    maxZ: -1.55,
    height: 1.1,
    blocksCamera: false,
  },
  // Back-right floor props in front of 7-plank concrete-block archive shelf (dehumidifier, trash bins, aluminum step stool)
  {
    id: 'obs_archive_floor_props',
    name: '책방지기 진열장 앞 발판 벤치 및 소품',
    minX: 3.32,
    maxX: 4.7,
    minZ: -6.7,
    maxZ: -4.2,
    height: 0.8,
    blocksCamera: false,
  },
  // Back-left leather workbench, sewing table & central personal study table (sealed flush to West wall)
  {
    id: 'obs_leather_workbench',
    name: '딤프치 가죽공방 작업대 및 개인 서재 대형 테이블',
    minX: -4.7,
    maxX: 0.16,
    minZ: -5.3,
    maxZ: -1.6,
    height: 1.1,
    blocksCamera: false,
  },
  // Far back wall sink, coffee island counter & water dispenser zone (sealed flush to North & West walls)
  {
    id: 'obs_back_counter',
    name: '후면 싱크대 · 커피바 및 냉온수기',
    minX: -4.7,
    maxX: 2.18,
    minZ: -6.8,
    maxZ: -5.3,
    height: 1.5,
    blocksCamera: true,
  },
];

// Extended South to Z = 10.65 so the visitor starts on the road outside the entrance and walks smoothly inside
export const ROOM_BOUNDS = {
  minX: -3.72,
  maxX: 3.58,
  minZ: -5.45,
  maxZ: 10.65,
};

// Roadview-style quick navigation nodes on the road and interior floor
export const WAYPOINT_NODES: WaypointNode[] = [
  {
    id: 'wp_road_outside',
    label: '도로 (독자서점 입구 밖)',
    position: [0.15, 0, 10.35],
    zone: '도로/외관',
  },
  {
    id: 'wp_entrance',
    label: '출입문 안쪽 (내부 한눈에 보기)',
    position: [0.15, 0, 5.65],
    zone: '입구',
  },
  {
    id: 'wp_front_lounge',
    label: '전면 메인 홀 (샹들리에 아래)',
    position: [0.15, 0, 3.15],
    zone: '전면 홀',
  },
  {
    id: 'wp_left_curation',
    label: '독자 추천 도서 서가',
    position: [-2.45, 0, 2.85],
    zone: '독자 추천 도서',
  },
  {
    id: 'wp_main_bookshelf',
    label: '메인 5열 서가',
    position: [2.35, 0, 2.92],
    zone: '우측 전면 서가',
  },
  {
    id: 'wp_center_table',
    label: '추천 도서 테이블',
    position: [2.15, 0, 1.15],
    zone: '추천 테이블',
  },
  {
    id: 'wp_corridor',
    label: '중앙 통로 (안쪽 공간 입구)',
    position: [-0.25, 0, 0.05],
    zone: '중앙 통로',
  },
  {
    id: 'wp_back_bookshelf',
    label: '책방지기의 서재 공간 & 미니벨로',
    position: [1.75, 0, -2.35],
    zone: '책방지기의 서재',
  },
  {
    id: 'wp_leather_workshop',
    label: '개인 서재 & 딤프치 가죽 작업대',
    position: [0.95, 0, -3.45],
    zone: '개인 서재/공방',
  },
  {
    id: 'wp_sink_and_mugs',
    label: '안쪽 싱크대 · 머그컵 선반 & 카메라 선반',
    position: [0.95, 0, -4.65],
    zone: '싱크대/머그컵',
  },
];

export interface StampMissionData {
  id: string;
  stepNumber: number;
  icon: string;
  title: string;
  zone: string;
  clue: string;
  discoveredNote: string;
  targetPosition: [number, number]; // [X, Z]
  triggerRadius: number;
  linkedIds: string[];
  photoUrl: string;
}

export const STAMP_MISSIONS: StampMissionData[] = [
  {
    id: 'hidden_book_dokja',
    stepNumber: 1,
    icon: '📕',
    title: '황금 별 책갈피가 꽂힌 책',
    zone: '책장 선반',
    clue: '책장 속 주황 표지 & 노란 별 리본',
    discoveredNote: '책장 선반에서 황금 별 책갈피 책을 찾았습니다!',
    targetPosition: [4.12, 2.72],
    triggerRadius: 0,
    linkedIds: [],
    photoUrl: '/photos/left_plank_shelf.jpg',
  },
  {
    id: 'hidden_house_frame',
    stepNumber: 2,
    icon: '🖼️',
    title: '빨간 지붕 집 그림 액자',
    zone: '나무벽 액자',
    clue: '나무 판자벽에 걸린 작은 풍경화',
    discoveredNote: '나무벽 액자 속 빨간 지붕 집 그림을 찾았습니다!',
    targetPosition: [-4.35, 1.15],
    triggerRadius: 0,
    linkedIds: [],
    photoUrl: '/photos/left_monitor_wall.jpg',
  },
  {
    id: 'hidden_butterfly_frame',
    stepNumber: 3,
    icon: '🦋',
    title: '파란 나비 표본 액자',
    zone: '서가 기둥 액자',
    clue: '우측 책장 중앙 나무 기둥의 액자',
    discoveredNote: '서가 기둥에 걸린 파란 나비 액자를 찾았습니다!',
    targetPosition: [3.8, -0.12],
    triggerRadius: 0,
    linkedIds: [],
    photoUrl: '/photos/right_bookshelf.jpg',
  },
  {
    id: 'hidden_hat_duck',
    stepNumber: 4,
    icon: '🦆',
    title: '노란 모자 쓴 꼬마 오리',
    zone: '추천 테이블 소품',
    clue: '추천 테이블 위 나무 트레이 안',
    discoveredNote: '추천 테이블 소품 사이에서 노란 모자 오리를 찾았습니다!',
    targetPosition: [3.2, 0.75],
    triggerRadius: 0,
    linkedIds: [],
    photoUrl: '/photos/center_table.jpg',
  },
  {
    id: 'hidden_mumu_dog',
    stepNumber: 5,
    icon: '🐶',
    title: '숨어 있는 까만 강아지 무무',
    zone: '칸막이 책장 구석',
    clue: '칸막이 선반 아래 칸에 숨은 강아지',
    discoveredNote: '칸막이 책장 구석에 숨은 까만 강아지 무무를 찾았습니다!',
    targetPosition: [-3.05, -0.05],
    triggerRadius: 0,
    linkedIds: [],
    photoUrl: '/photos/duck_and_divider.jpg',
  },
];
