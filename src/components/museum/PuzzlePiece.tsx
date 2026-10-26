import styles from './museum.module.css';

export type EdgeKind = 'flat' | 'tab' | 'blank';

export type PuzzleSlot = 'tl' | 'tr' | 'wide';

type PuzzlePieceProps = {
  year: number;
  word: string;
  fill: string;
  ink: string;
  slot: PuzzleSlot;
  north: EdgeKind;
  east: EdgeKind;
  south: EdgeKind;
  west: EdgeKind;
  active: boolean;
  animate?: boolean;
  exiting?: boolean;
  onSelect: () => void;
};

export default function PuzzlePiece({
  year,
  word,
  fill,
  ink,
  slot,
  north,
  east,
  south,
  west,
  active,
  animate = true,
  exiting = false,
  onSelect,
}: PuzzlePieceProps) {
  const titleId = `puzzle-${year}`;
  const wide = slot === 'wide';
  const path = wide ? museumPath() : piecePath(north, east, south, west);

  return (
    <button
      type="button"
      className={`${styles.piece} ${styles[slot]} ${active ? styles.pieceActive : ''} ${exiting ? styles.pieceOut : ''} ${!exiting && animate ? styles.pieceIn : ''}`}
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      aria-label={`${word}, ${year} projects`}
    >
      <svg
        viewBox={wide ? '-18 -18 236 108' : '-18 -18 136 136'}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>{`${word} ${year}`}</title>
        <path d={path} fill={fill} />
        <text
          x={wide ? '100' : '50'}
          y={wide ? '38' : '46'}
          textAnchor="middle"
          fill={ink}
          fontSize={wide ? '17' : '18'}
          fontWeight="700"
          letterSpacing="0.08em"
        >
          {word}
        </text>
        <text
          x={wide ? '100' : '50'}
          y={wide ? '56' : '66'}
          textAnchor="middle"
          fill={ink}
          fillOpacity="0.55"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.04em"
        >
          {year}
        </text>
      </svg>
    </button>
  );
}

function piecePath(
  north: EdgeKind,
  east: EdgeKind,
  south: EdgeKind,
  west: EdgeKind,
): string {
  return [
    'M 0 0',
    hEdge(0, 100, 0, -1, north),
    vEdge(0, 100, 100, 1, east),
    hEdge(100, 0, 100, 1, south),
    vEdge(100, 0, 0, -1, west),
    'Z',
  ].join(' ');
}

function museumPath(): string {
  return [
    'M 0 0',
    hKnob(0, 200, 0, -1, 'blank', 50),
    hKnob(50, 200, 0, -1, 'blank', 150),
    'L 200 0',
    'L 200 72',
    'L 0 72',
    'Z',
  ].join(' ');
}

function hKnob(
  xFrom: number,
  xTo: number,
  y: number,
  outward: number,
  kind: EdgeKind,
  mid: number,
): string {
  const dir = xTo > xFrom ? 1 : -1;
  const sign = (kind === 'tab' ? 1 : -1) * outward;
  const start = mid - dir * 12;
  const end = mid + dir * 12;
  return [
    `L ${start} ${y}`,
    `C ${start} ${y + sign * 5}, ${mid - dir * 17} ${y + sign * 16}, ${mid} ${y + sign * 16}`,
    `C ${mid + dir * 17} ${y + sign * 16}, ${end} ${y + sign * 5}, ${end} ${y}`,
  ].join(' ');
}

function hEdge(
  xFrom: number,
  xTo: number,
  y: number,
  outward: number,
  kind: EdgeKind,
): string {
  if (kind === 'flat') return `L ${xTo} ${y}`;
  const dir = xTo > xFrom ? 1 : -1;
  const sign = (kind === 'tab' ? 1 : -1) * outward;
  const mid = (xFrom + xTo) / 2;
  const start = mid - dir * 12;
  const end = mid + dir * 12;
  return [
    `L ${start} ${y}`,
    `C ${start} ${y + sign * 5}, ${mid - dir * 17} ${y + sign * 16}, ${mid} ${y + sign * 16}`,
    `C ${mid + dir * 17} ${y + sign * 16}, ${end} ${y + sign * 5}, ${end} ${y}`,
    `L ${xTo} ${y}`,
  ].join(' ');
}

function vEdge(
  yFrom: number,
  yTo: number,
  x: number,
  outward: number,
  kind: EdgeKind,
): string {
  if (kind === 'flat') return `L ${x} ${yTo}`;
  const dir = yTo > yFrom ? 1 : -1;
  const sign = (kind === 'tab' ? 1 : -1) * outward;
  const mid = (yFrom + yTo) / 2;
  const start = mid - dir * 12;
  const end = mid + dir * 12;
  return [
    `L ${x} ${start}`,
    `C ${x + sign * 5} ${start}, ${x + sign * 16} ${mid - dir * 17}, ${x + sign * 16} ${mid}`,
    `C ${x + sign * 16} ${mid + dir * 17}, ${x + sign * 5} ${end}, ${x} ${end}`,
    `L ${x} ${yTo}`,
  ].join(' ');
}
