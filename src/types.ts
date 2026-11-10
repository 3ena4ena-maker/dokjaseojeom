export type CharacterActionState =
  | 'IDLE'
  | 'WALKING'
  | 'INTERACTING'
  | 'SITTING'
  | 'READING';

export type GenreId =
  | 'dokja_curation'
  | 'animation_comics'
  | 'novel'
  | 'marketing_indie'
  | 'humanities'
  | 'art_arch_travel';

export interface GenreShelfData {
  id: GenreId;
  name: string;
  englishName: string;
  subtitle: string;
  description: string;
  locationLabel: string;
  signPosition: [number, number, number];
  signRotationY: number;
  interactionPoint: [number, number, number];
  interactionFacingY: number;
  triggerRadius: number;
  accentColor: string;
  realPhotoUrl: string;
}

export interface BookItem {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedYear: string;
  genreId: GenreId;
  genreName: string;
  spineColor: string;
  coverColor: string;
  accentColor: string;
  textColor: string;
  shelfPosition: [number, number, number];
  shelfRotation: [number, number, number];
  displayType: 'face-out' | 'spine-out' | 'table-flat';
  interactionPoint: [number, number, number];
  interactionFacingY: number;
  summary: string;
  curatorNote: string;
  excerpt: [string, string]; // Left page, Right page when reading
  tags: string[];
  realSpotDescription: string;
}

export interface SeatObjectData {
  id: string;
  name: string;
  type: 'chair' | 'sofa';
  description: string;
  seatPosition: [number, number, number]; // Where character sits
  seatFacingY: number; // Direction character faces when seated
  approachPoint: [number, number, number]; // Where character walks before sitting
  triggerRadius: number;
}

export interface TableObjectData {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  bookPlacePosition: [number, number, number]; // Where a held book gets placed on the table
  approachPoint: [number, number, number];
  approachFacingY: number;
  triggerRadius: number;
  linkedSeatId?: string;
  realPhotoUrl: string;
}

export interface SpaceStoryData {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  details: string[];
  position: [number, number, number];
  approachPoint: [number, number, number];
  approachFacingY: number;
  triggerRadius: number;
  realPhotoUrl: string;
}

export interface ObstacleBox {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height?: number;
  blocksCamera?: boolean;
}

export interface WaypointNode {
  id: string;
  label: string;
  position: [number, number, number];
  zone: string;
}

export type ActivePromptType =
  | {
      kind: 'book';
      id: string;
      label: string;
      sublabel: string;
      keyHint: string;
      book: BookItem;
    }
  | {
      kind: 'shelf';
      id: GenreId;
      label: string;
      sublabel: string;
      keyHint: string;
      shelf: GenreShelfData;
    }
  | {
      kind: 'seat';
      id: string;
      label: string;
      sublabel: string;
      keyHint: string;
      seat: SeatObjectData;
    }
  | {
      kind: 'table';
      id: string;
      label: string;
      sublabel: string;
      keyHint: string;
      table: TableObjectData;
    }
  | {
      kind: 'story';
      id: string;
      label: string;
      sublabel: string;
      keyHint: string;
      story: SpaceStoryData;
    };
