/** The texture inside an area of effect: kind 0 and 1 are opposite diagonals, 2 is dots. */
export default function EffectPattern({ id, kind, color }: { id: string; kind: number; color: string }) {
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
      {kind === 0 && <path d="M-2 2 2 -2M0 8 8 0M6 10 10 6" stroke={color} strokeWidth="1.3" />}
      {kind === 1 && <path d="M-2 6 2 10M0 0 8 8M6 -2 10 2" stroke={color} strokeWidth="1.3" />}
      {kind === 2 && <circle cx="4" cy="4" r="1.3" fill={color} />}
    </pattern>
  );
}
