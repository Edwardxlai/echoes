type PositionedDetailProps = {
  x: number;
  y: number;
  scale?: number;
};

type MountainProps = PositionedDetailProps & {
  face?: string;
  shade?: string;
  snow?: boolean;
};

export function Mountain({
  x,
  y,
  scale = 1,
  face = "#e7e7df",
  shade = "#bdc7c2",
  snow = false,
}: MountainProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={5} cy={27} rx={27} ry={6.5} fill="var(--map-land-shadow)" />
      <path d="M0 0 27 28 0 23Z" fill={shade} />
      <path d="M0 0 0 23-27 28Z" fill={face} />
      <path d="M0 0-7 8-3 8-10 14 0 10 7 15 5 8Z" fill="#fffdf7" opacity={snow ? 0.9 : 0.46} />
      <path d="M-20 25 0 23 20 27" fill="none" stroke="#fff" strokeWidth={1.1} opacity={0.42} />
    </g>
  );
}

type TreeProps = PositionedDetailProps & {
  light?: string;
  dark?: string;
};

export function Tree({
  x,
  y,
  scale = 1,
  light = "#8fb49a",
  dark = "#688f7b",
}: TreeProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={3} cy={14} rx={8} ry={3} fill="var(--map-land-shadow)" />
      <path d="M0 4v11" stroke="#94856f" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0-8-10 7 0 4Z" fill={light} />
      <path d="M0-8 10 7 0 4Z" fill={dark} />
      <path d="M0-2-8 11 0 8Z" fill={light} />
      <path d="M0-2 8 11 0 8Z" fill={dark} />
    </g>
  );
}

type TreeClusterProps = PositionedDetailProps & {
  light?: string;
  dark?: string;
};

export function TreeCluster({ x, y, scale = 1, light, dark }: TreeClusterProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <Tree x={-16} y={5} scale={0.82} light={light} dark={dark} />
      <Tree x={2} y={-2} scale={1.08} light={light} dark={dark} />
      <Tree x={19} y={8} scale={0.72} light={light} dark={dark} />
      <Tree x={-1} y={13} scale={0.7} light={light} dark={dark} />
    </g>
  );
}

export function Road({
  d,
  color = "#a99c84",
  width = 2.2,
  opacity = 0.72,
}: {
  d: string;
  color?: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      <path d={d} stroke="#fffaf0" strokeWidth={width + 3.8} />
      <path d={d} stroke={color} strokeWidth={width} strokeDasharray="5 4" />
    </g>
  );
}

export function River({
  d,
  width = 7,
  opacity = 0.82,
}: {
  d: string;
  width?: number;
  opacity?: number;
}) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
      <path d={d} stroke="#afd4d8" strokeWidth={width + 2.5} />
      <path d={d} stroke="#dff1ef" strokeWidth={Math.max(1.2, width * 0.25)} opacity={0.9} />
    </g>
  );
}

export function CloudBank({
  x,
  y,
  scale = 1,
  opacity = 0.54,
}: PositionedDetailProps & { opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="var(--map-fog)" opacity={opacity}>
      <ellipse cx={-30} cy={5} rx={30} ry={12} />
      <ellipse cx={0} cy={0} rx={38} ry={16} />
      <ellipse cx={34} cy={7} rx={28} ry={11} />
      <ellipse cx={7} cy={10} rx={52} ry={12} opacity={0.72} />
    </g>
  );
}

export function EchoBeacon({
  x,
  y,
  scale = 1,
  glowId,
}: PositionedDetailProps & { glowId?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={3} cy={16} rx={11} ry={3.5} fill="var(--map-land-shadow)" />
      <path d="M0 14V-2" stroke="#8f816b" strokeWidth={2.2} strokeLinecap="round" />
      <circle
        cx={0}
        cy={-4}
        r={6.5}
        fill="var(--amber-hot)"
        filter={glowId ? `url(#${glowId})` : undefined}
      />
      <circle cx={0} cy={-4} r={2.4} fill="#fff7d8" />
      <path
        d="M-11-4a11 7 0 0 0 22 0M-17-4a17 11 0 0 0 34 0"
        fill="none"
        stroke="var(--amber-hot)"
        strokeWidth={1.1}
        opacity={0.54}
        strokeLinecap="round"
      />
    </g>
  );
}

export function WaterRipple({
  x,
  y,
  scale = 1,
  opacity = 0.5,
}: PositionedDetailProps & { opacity?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke="#f8ffff"
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={opacity}
    >
      <path d="M-28 0c8-5 17-5 25 0s17 5 25 0" />
      <path d="M-18 9c6-3 12-3 18 0s12 3 18 0" opacity={0.72} />
    </g>
  );
}
