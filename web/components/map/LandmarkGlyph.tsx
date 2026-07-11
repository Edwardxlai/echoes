/* Reusable 2.5D landmarks for the region map. Every glyph uses the same
   upper-left light direction and lands on a 100 x 100 local stage. */
export type GlyphKind = "city" | "tower" | "ruins" | "port";

export function LandmarkGlyph({ kind, accent }: { kind: GlyphKind; accent: string }) {
  switch (kind) {
    case "city":
      return (
        <g>
          <ellipse className="terrain-shadow" cx={52} cy={94} rx={42} ry={8} />
          <path d="m12 78 36-14 41 14-38 15Z" fill="#eee7d8" />
          <path d="m12 78 39 15 38-15v8L51 101 12 86Z" fill="#cbbfa9" opacity={0.82} />

          <path d="m20 54 7-4 15 4-7 5Z" fill="#f8f4e9" />
          <path d="M20 54v27l15 5V59Z" fill="#d8d4c8" />
          <path d="m35 59 7-5v27l-7 5Z" fill="#aaa798" />

          <path d="m40 31 8-5 18 5-8 6Z" fill="#fffaf0" />
          <path d="M40 31v48l18 6V37Z" fill="#d9d7cf" />
          <path d="m58 37 8-6v48l-8 6Z" fill="#9ea19a" />
          <path d="M45 43v7m0 7v7m7-18v7m0 7v7" stroke={accent} strokeWidth={2} opacity={0.76} />

          <path d="m65 49 7-4 15 5-7 5Z" fill="#f5f1e7" />
          <path d="M65 49v33l15 5V55Z" fill="#d0cec5" />
          <path d="m80 55 7-5v32l-7 5Z" fill="#999d98" />
          <path d="M70 62v6m0 5v6" stroke={accent} strokeWidth={2} opacity={0.68} />

          <path d="m29 84 10-6 8 5 7-5 9 8" fill="none" stroke={accent} strokeWidth={1.9} strokeLinecap="round" />
        </g>
      );
    case "tower":
      return (
        <g>
          <ellipse className="terrain-shadow" cx={51} cy={95} rx={37} ry={7.5} />
          <path d="m17 80 33-13 34 13-34 14Z" fill="#eee9dc" />
          <path d="m17 80 33 14 34-14v8L50 102 17 88Z" fill="#c9bea9" opacity={0.8} />

          <path d="m35 44 15-8 17 8-16 9Z" fill="#f9f6ed" />
          <path d="M35 44v38l16 7V53Z" fill="#d9d8d0" />
          <path d="m51 53 16-9v38l-16 7Z" fill="#9ca5a2" />
          <path d="m30 42 20-11 22 11-21 12Z" fill={accent} opacity={0.78} />
          <path d="m30 42 21 12 21-12v6L51 60 30 48Z" fill="#918f86" opacity={0.62} />

          <path d="m43 15 7-4 8 4-8 5Z" fill="#fffaf0" />
          <path d="M43 15v20l7 4V20Z" fill="#d8d7cf" />
          <path d="m50 20 8-5v20l-8 4Z" fill="#949d9b" />
          <path d="m38 15 12-13 13 13-13 7Z" fill={accent} opacity={0.88} />
          <path d="M27 34a27 17 0 0 0 47 0" fill="none" stroke={accent} strokeWidth={1.5} opacity={0.55} />
          <path d="M23 33a31 22 0 0 0 55 0" fill="none" stroke={accent} strokeWidth={1} opacity={0.34} />
        </g>
      );
    case "ruins":
      return (
        <g>
          <ellipse className="terrain-shadow" cx={51} cy={95} rx={43} ry={7.5} />
          <path d="m11 80 39-13 40 13-39 14Z" fill="#eee7db" />
          <path d="m11 80 40 14 39-14v8L51 101 11 88Z" fill="#c8bba8" opacity={0.78} />
          <path d="m18 71 31-10 33 10-32 11Z" fill="#d8d1c6" />

          <path d="m21 39 6-3 9 3-6 4Z" fill="#fbf7ee" />
          <path d="M21 39v39l9 3V43Z" fill="#d6d2c8" />
          <path d="m30 43 6-4v39l-6 3Z" fill="#a6a49b" />
          <path d="m20 38 4-7 7 3 5-2v7l-9-3Z" fill="#ddd8cc" />

          <path d="m42 27 6-4 10 4-7 4Z" fill="#fffaf1" />
          <path d="M42 27v47l9 4V31Z" fill="#d9d5cb" />
          <path d="m51 31 7-4v47l-7 4Z" fill="#9f9e98" />
          <path d="m42 27 3-7 6 3 7-4v8l-10-4Z" fill="#d8d2c7" />

          <path d="m65 44 6-4 10 4-7 4Z" fill="#f8f3e9" />
          <path d="M65 44v34l9 3V48Z" fill="#d0ccc2" />
          <path d="m74 48 7-4v34l-7 3Z" fill="#999b96" />
          <path d="M31 45h19c11 0 19 7 19 17" fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" opacity={0.74} />
          <path d="m24 68 14-5m26 8 18-6" stroke={accent} strokeWidth={1.5} opacity={0.5} />
        </g>
      );
    case "port":
      return (
        <g>
          <ellipse className="terrain-shadow" cx={51} cy={95} rx={45} ry={6.5} />
          <path d="M7 89c12-4 23-4 34 0s23 4 35 0 17-3 22-1" fill="none" stroke="#e9f6f4" strokeWidth={2.2} opacity={0.85} />
          <path d="m10 72 48-15 32 11-49 17Z" fill="#e9e2d5" />
          <path d="m10 72 31 13 49-17v9L41 94 10 81Z" fill="#bbb09f" />

          <path d="m20 54 14-7 22 7-15 8Z" fill="#fbf7ed" />
          <path d="M20 54v20l21 7V62Z" fill="#d5d2c9" />
          <path d="m41 62 15-8v20l-15 7Z" fill="#9da3a0" />
          <path d="m19 53 15-14 23 14-23-6Z" fill={accent} opacity={0.76} />

          <path d="M66 65V31h6v32" fill="none" stroke="#777c78" strokeWidth={3} />
          <path d="m69 31 17 8-17 5" fill="none" stroke="#777c78" strokeWidth={3} strokeLinejoin="round" />
          <path d="M84 39v15" stroke={accent} strokeWidth={1.8} />
          <rect x={80.5} y={53} width={7} height={6} rx={1} fill={accent} opacity={0.82} />

          <path d="m52 87 15-7 21 3-9 9-18 1Z" fill={accent} opacity={0.82} />
          <path d="M68 80V62l13 17Z" fill="#f8f4e9" />
          <path d="M68 62v20" stroke="#6f7774" strokeWidth={1.8} />
        </g>
      );
  }
}
