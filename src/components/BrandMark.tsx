/** A small sprout on a soil line, drawn for this app. Inherits colour from the text colour. */
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 23h20" />
      <path d="M14 23V13" />
      <path d="M14 15c0-4-2.5-6.5-7-6.5 0 4 2.5 6.5 7 6.5Z" />
      <path d="M14 12c0-3.5 2.2-6 6.5-6 0 3.5-2.2 6-6.5 6Z" />
    </svg>
  );
}
