type EdgeKind = 'flat' | 'tab' | 'blank';

/** Shared decorative mark; year navigation stays in semantic HTML. */
export default function MuseumMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-8 -8 216 188" aria-hidden="true" focusable="false">
      <path d={piecePath('flat', 'tab', 'tab', 'flat')} fill="#f5b83d" />
      <path d={piecePath('flat', 'flat', 'tab', 'blank')} transform="translate(100 0)" fill="#ffd879" />
      <path d={museumPath()} transform="translate(0 100)" fill="#e8a62a" />
      <g fill="#231c10" textAnchor="middle" fontWeight="750" letterSpacing="2">
        <text x="45" y="55" fontSize="18">HACK</text>
        <text x="155" y="55" fontSize="18">HIVE</text>
        <text x="100" y="148" fontSize="19">MUSEUM</text>
      </g>
    </svg>
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
