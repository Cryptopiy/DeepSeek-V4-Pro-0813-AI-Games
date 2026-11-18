import { ObstacleKind } from './types';

export interface ObstacleDef {
  kind: ObstacleKind;
  label: string;
  description: string;
  massKg: number; // Infinity => immovable
  movable: boolean;
  half: { x: number; z: number };
  height: number;
  restitution: number;
  friction: number;
  rigidity: number; // 0..1 — how much of the crash energy the car absorbs
  color: string;
  accent: string;
}

export const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  'concrete-wall': {
    kind: 'concrete-wall',
    label: 'Concrete wall',
    description: 'Effectively immovable, very rigid',
    massKg: Infinity,
    movable: false,
    half: { x: 0.6, z: 7 },
    height: 2.2,
    restitution: 0.05,
    friction: 0.55,
    rigidity: 1.0,
    color: '#8b8f94',
    accent: '#f2c230',
  },
  'heavy-barrier': {
    kind: 'heavy-barrier',
    label: 'Heavy barrier',
    description: 'Movable but very massive (4 t)',
    massKg: 4000,
    movable: true,
    half: { x: 0.7, z: 1.6 },
    height: 1.1,
    restitution: 0.12,
    friction: 0.45,
    rigidity: 0.7,
    color: '#5c6bc0',
    accent: '#ffb300',
  },
  'light-barrier': {
    kind: 'light-barrier',
    label: 'Light barrier',
    description: 'Easily displaced (300 kg)',
    massKg: 300,
    movable: true,
    half: { x: 0.4, z: 1.3 },
    height: 0.9,
    restitution: 0.3,
    friction: 0.35,
    rigidity: 0.25,
    color: '#e4e7ec',
    accent: '#e0342b',
  },
};

export const OBSTACLE_ORDER: ObstacleKind[] = [
  'concrete-wall',
  'heavy-barrier',
  'light-barrier',
];
