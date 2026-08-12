import { SystemName } from "@/lib/types";

// Modern line icons for the three tracked systems. Stroke inherits
// currentColor so callers can tint via `color` / text color utilities.
export function SystemIcon({
  system,
  size = 22,
  className,
}: {
  system: SystemName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (system === "cardiovascular") {
    return (
      <svg {...common}>
        <path d="M12 20.5C12 20.5 3.5 14.8 3.5 8.9 3.5 6.2 5.6 4 8.2 4c1.7 0 3.1.9 3.8 2.2C12.7 4.9 14.1 4 15.8 4c2.6 0 4.7 2.2 4.7 4.9 0 5.9-8.5 11.6-8.5 11.6Z" />
        <path d="M4 12.5h4l1.5-3 2.5 6 1.6-4 1.2 2h5" />
      </svg>
    );
  }

  if (system === "respiratory") {
    return (
      <svg {...common}>
        <path d="M12 3v7" />
        <path d="M12 10c-.4 2.2-1.6 3.5-3 4-1.6.6-2.6 2-2.6 3.8 0 1.6.6 3.2 2.3 3.2 1.5 0 2.4-1.1 2.7-2.7.3-1.7.4-4 .6-5.3" />
        <path d="M12 10c.4 2.2 1.6 3.5 3 4 1.6.6 2.6 2 2.6 3.8 0 1.6-.6 3.2-2.3 3.2-1.5 0-2.4-1.1-2.7-2.7-.3-1.7-.4-4-.6-5.3" />
      </svg>
    );
  }

  // neurological
  return (
    <svg {...common}>
      <path d="M9.5 3.2c-1.6 0-2.9 1.2-3.1 2.7-1.3.4-2.2 1.6-2.2 3 0 .6.2 1.2.5 1.7-.6.6-1 1.4-1 2.3 0 1.2.7 2.3 1.7 2.8.1 1.6 1.4 2.8 3 2.8.9 0 1.6-.4 2.1-1V4.6c-.5-.9-1.5-1.4-2.5-1.4Z" />
      <path d="M14.5 3.2c1.6 0 2.9 1.2 3.1 2.7 1.3.4 2.2 1.6 2.2 3 0 .6-.2 1.2-.5 1.7.6.6 1 1.4 1 2.3 0 1.2-.7 2.3-1.7 2.8-.1 1.6-1.4 2.8-3 2.8-.9 0-1.6-.4-2.1-1" />
      <path d="M12 6.5h1.5M12 10h2M12 13.5h1.5" />
    </svg>
  );
}
