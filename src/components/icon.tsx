type IconName =
  | "request"
  | "library"
  | "bookmark"
  | "collapse"
  | "expand"
  | "spark"
  | "chip"
  | "info"
  | "search"
  | "arrow"
  | "outward";

const paths: Record<IconName, string> = {
  request: "M14 20H5V4h14v8M8 8h8M8 12h5M8 16h3M19 15v6M16 18h6",
  library: "M4 4h16v4H4zM5 8v12h14V8M9 12h6",
  bookmark: "M6 6V3h13v16M4 6h12v16l-6-4-6 4z",
  collapse: "M5 5v14M17 7l-5 5 5 5",
  expand: "M19 5v14M7 7l5 5-5 5",
  spark: "M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9zM20 3v4M18 5h4",
  chip: "M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  info: "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  arrow: "M4 12h16M14 6l6 6-6 6",
  outward: "M7 17 17 7M7 7h10v10",
};

export function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
