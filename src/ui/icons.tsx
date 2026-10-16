import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function HomeIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  );
}

export function CardsIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="7" y="3" width="13" height="16" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h10" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="var(--flame)"
        d="M12 2c1 3.2-1.3 4.8-2.6 6.6C8.1 10.4 7 12 7 14.3A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5.2c0-2-1-3.3-1.7-4.3-.3 1.4-1 2.2-1.9 2.5.6-3.4-.1-7.4-1.4-10.5z"
      />
      <path
        fill="var(--cue)"
        d="M12 21a3.2 3.2 0 0 1-3.2-3.3c0-1.6 1.2-2.6 2-3.6.4.9 1 1.3 1.6 1.4-.2-1.2.3-2.3.9-3 .9 1.3 2 2.9 2 5.2A3.2 3.2 0 0 1 12 21z"
      />
    </svg>
  );
}

export function FlameOffIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="var(--line)"
        d="M12 2c1 3.2-1.3 4.8-2.6 6.6C8.1 10.4 7 12 7 14.3A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5.2c0-2-1-3.3-1.7-4.3-.3 1.4-1 2.2-1.9 2.5.6-3.4-.1-7.4-1.4-10.5z"
      />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="var(--cue)"
        stroke="var(--cue-deep)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        d="M13.5 2 4 13.5h7L10 22l10-12h-7z"
      />
    </svg>
  );
}

export function SoundIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function TurtleIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 15a8 6 0 0 1 16 0z" />
      <path d="M20 15h1.5a1.5 1.5 0 0 0 0-3H20M6 15l-1 3M18 15l1 3M9 9.5l3 5.5 3-5.5" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      {...props}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"
      />
    </svg>
  );
}

export function EarIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 20a3 3 0 0 1-4-1" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3" />
    </svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M4 18v-5c0-4 2-7 6-8l.8 1.6C8.5 7.6 7.6 9.2 7.5 11H10v7zm10 0v-5c0-4 2-7 6-8l.8 1.6c-2.3 1-3.2 2.6-3.3 4.4H20v7z"
      />
    </svg>
  );
}

export function ChestIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v9H3z" />
      <path d="M3 11h18M10 11v3h4v-3" />
    </svg>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      {...props}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      {...props}
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3.4 20.6 21 12 3.4 3.4 3.4 10l12.6 2-12.6 2z" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function CoffeeIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" />
    </svg>
  );
}

export function BedIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" />
      <circle cx="7" cy="11" r="2" />
    </svg>
  );
}

export function BeerIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 7h10v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7a3 3 0 0 1 5-2 3 3 0 0 1 5 2" />
    </svg>
  );
}

export function BriefIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  );
}

export function ScaleIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3v18M5 21h14M4 8h16M7 8l-3 7a3 3 0 0 0 6 0zM17 8l-3 7a3 3 0 0 0 6 0z" />
    </svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      {...props}
    >
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 6l2 2M15 8l2 2" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8" />
    </svg>
  );
}

export function MarkerIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m14 4 6 6-8.5 8.5H6v-5.5z" />
      <path d="M4 21h8M11 7l6 6" />
    </svg>
  );
}

export function DocIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
    </svg>
  );
}

export const ICONS = {
  home: HomeIcon,
  film: FilmIcon,
  cards: CardsIcon,
  chat: ChatIcon,
  chart: ChartIcon,
  flame: FlameIcon,
  flameOff: FlameOffIcon,
  bolt: BoltIcon,
  sound: SoundIcon,
  turtle: TurtleIcon,
  play: PlayIcon,
  check: CheckIcon,
  x: XIcon,
  lock: LockIcon,
  star: StarIcon,
  ear: EarIcon,
  quote: QuoteIcon,
  chest: ChestIcon,
  pen: PenIcon,
  back: BackIcon,
  search: SearchIcon,
  plus: PlusIcon,
  mic: MicIcon,
  send: SendIcon,
  target: TargetIcon,
  coffee: CoffeeIcon,
  bed: BedIcon,
  beer: BeerIcon,
  brief: BriefIcon,
  scale: ScaleIcon,
  key: KeyIcon,
  upload: UploadIcon,
  trophy: TrophyIcon,
  marker: MarkerIcon,
  doc: DocIcon,
  spark: SparkIcon,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = ICONS[name];
  return <Component {...props} />;
}

export function BellIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2.5h-15z" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      {...props}
    >
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="19" cy="12" r="2.2" />
    </svg>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 4v14M4 14l4 4 4-4M16 20V6M12 10l4-4 4 4" />
    </svg>
  );
}
