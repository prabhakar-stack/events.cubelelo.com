"use client";

const PATHS: Record<string, string> = {
  "333":
    "M4 4h6v6H4zm8 0h6v6h-6zm-8 8h6v6H4zm8 0h6v6h-6zM4 20h6v6H4zm8 0h6v6h-6zm8-16h6v6h-6zm0 8h6v6h-6zm0 8h6v6h-6z",
  "222":
    "M4 4h10v10H4zm14 0h10v10H14zM4 18h10v10H4zm14 0h10v10H14z",
  "444":
    "M2 2h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 8h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 14h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 20h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5z",
  "555":
    "M1 1h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 6h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 11h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 16h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 21h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4z",
  "666":
    "M1 1h3.3v3.3H1zm4.3 0h3.3v3.3H5.3zm4.4 0h3.3v3.3H9.7zm4.3 0H17.3v3.3H14zm4.4 0h3.3v3.3h-3.3zm4.3 0h3.3v3.3h-3.3zM1 5.3h3.3v3.4H1zm4.3 0h3.3v3.4H5.3zm4.4 0h3.3v3.4H9.7zm4.3 0H17.3v3.4H14zm4.4 0h3.3v3.4h-3.3zm4.3 0h3.3v3.4h-3.3zM1 9.7h3.3V13H1zm4.3 0h3.3V13H5.3zm4.4 0h3.3V13H9.7zm4.3 0H17.3V13H14zm4.4 0h3.3V13h-3.3zm4.3 0h3.3V13h-3.3zM1 14h3.3v3.3H1zm4.3 0h3.3v3.3H5.3zm4.4 0h3.3v3.3H9.7zm4.3 0H17.3v3.3H14zm4.4 0h3.3v3.3h-3.3zm4.3 0h3.3v3.3h-3.3zM1 18.4h3.3v3.3H1zm4.3 0h3.3v3.3H5.3zm4.4 0h3.3v3.3H9.7zm4.3 0H17.3v3.3H14zm4.4 0h3.3v3.3h-3.3zm4.3 0h3.3v3.3h-3.3zM1 22.7h3.3V26H1zm4.3 0h3.3V26H5.3zm4.4 0h3.3V26H9.7zm4.3 0H17.3V26H14zm4.4 0h3.3V26h-3.3zm4.3 0h3.3V26h-3.3z",
  "777":
    "M1 1h2.7v2.7H1zm3.7 0h2.7v2.7H4.7zm3.6 0H11v2.7H8.3zm3.7 0h2.7v2.7H12zm3.6 0h2.7v2.7h-2.7zm3.7 0h2.7v2.7h-2.7zm3.7 0H26v2.7h-2.7zM1 4.7h2.7v2.6H1zm3.7 0h2.7v2.6H4.7zm3.6 0H11v2.6H8.3zm3.7 0h2.7v2.6H12zm3.6 0h2.7v2.6h-2.7zm3.7 0h2.7v2.6h-2.7zm3.7 0H26v2.6h-2.7zM1 8.3h2.7V11H1zm3.7 0h2.7V11H4.7zm3.6 0H11V11H8.3zm3.7 0h2.7V11H12zm3.6 0h2.7V11h-2.7zm3.7 0h2.7V11h-2.7zm3.7 0H26V11h-2.7zM1 12h2.7v2.7H1zm3.7 0h2.7v2.7H4.7zm3.6 0H11v2.7H8.3zm3.7 0h2.7v2.7H12zm3.6 0h2.7v2.7h-2.7zm3.7 0h2.7v2.7h-2.7zm3.7 0H26v2.7h-2.7zM1 15.7h2.7v2.6H1zm3.7 0h2.7v2.6H4.7zm3.6 0H11v2.6H8.3zm3.7 0h2.7v2.6H12zm3.6 0h2.7v2.6h-2.7zm3.7 0h2.7v2.6h-2.7zm3.7 0H26v2.6h-2.7zM1 19.3h2.7V22H1zm3.7 0h2.7V22H4.7zm3.6 0H11V22H8.3zm3.7 0h2.7V22H12zm3.6 0h2.7V22h-2.7zm3.7 0h2.7V22h-2.7zm3.7 0H26V22h-2.7zM1 23h2.7v2.7H1zm3.7 0h2.7v2.7H4.7zm3.6 0H11v2.7H8.3zm3.7 0h2.7v2.7H12zm3.6 0h2.7v2.7h-2.7zm3.7 0h2.7v2.7h-2.7zm3.7 0H26v2.7h-2.7z",
  pyram:
    "M14 2L2 26h24L14 2zm0 6l8 16H6l8-16z",
  skewb:
    "M14 2l12 12-12 12L2 14 14 2zm0 5L6 14l8 8 8-8-8-7z",
  minx:
    "M14 1l8.5 6.2 3.2 10-6.6 8.8H8.9l-6.6-8.8 3.2-10L14 1z",
  sq1:
    "M4 4h20v20H4V4zm2 2v16h16V6H6z",
  clock:
    "M14 2C7.4 2 2 7.4 2 14s5.4 12 12 12 12-5.4 12-12S20.6 2 14 2zm0 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm-1 3v7l5 3 1-1.7-4-2.3V8h-2z",
  "333oh":
    "M8 2C5.8 2 4 3.8 4 6v4.6L2 12v6l2 1.4V24c0 2.2 1.8 4 4 4h12c2.2 0 4-1.8 4-4V6c0-2.2-1.8-4-4-4H8zm1 5h3v3H9V7zm5 0h3v3h-3V7zM9 12h3v3H9v-3zm5 0h3v3h-3v-3zm-5 5h3v3H9v-3zm5 0h3v3h-3v-3z",
  "333bf":
    "M4 4h6v6H4zm8 0h6v6h-6zm8 0h6v6h-6zM4 12h6v6H4zm8 0h6v6h-6zm8 0h6v6h-6zM4 20h6v6H4zm8 0h6v6h-6zm8 0h6v6h-6zM2 28h24v2H2z",
  "444bf":
    "M2 2h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 8h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 14h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM2 20h5v5H2zm6 0h5v5H8zm6 0h5v5h-5zm6 0h5v5h-5zM1 27h26v2H1z",
  "555bf":
    "M1 1h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 6h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 11h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 16h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM1 21h4v4H1zm5 0h4v4H6zm5 0h4v4h-4zm5 0h4v4h-4zm5 0h4v4h-4zM0 27h28v2H0z",
  "333mbf":
    "M3 4h6v6H3zm8 0h6v6h-6zm8 0h6v6h-6zM3 12h6v6H3zm8 0h6v6h-6zm8 0h6v6h-6zM3 20h6v6H3zm8 0h6v6h-6zm8 0h6v6h-6zM1 28h26v2H1zM3 2h6v1H3zm8 0h6v1h-6zm8 0h6v1h-6z",
  fto:
    "M14 2L2 26h24L14 2zm0 4l4.5 8H9.5L14 6zm-5 10h10l-5 8-5-8z",
  "333fm":
    "M4 4h6v6H4zm8 0h6v6h-6zm-8 8h6v6H4zm8 0h6v6h-6zM4 20h6v6H4zm8 0h6v6h-6zm8-16h6v6h-6zm0 8h6v6h-6zm0 8h6v6h-6zM22 1l4 4-14 14-4-1 1-4L22 1z",
};

const VIEWBOX: Record<string, string> = {
  "333": "0 0 28 28",
  "222": "0 0 28 28",
  "444": "0 0 27 27",
  "555": "0 0 26 26",
  "666": "0 0 27 27",
  "777": "0 0 27 27",
  pyram: "0 0 28 28",
  skewb: "0 0 28 28",
  minx: "0 0 28 28",
  sq1: "0 0 28 28",
  clock: "0 0 28 28",
  "333oh": "0 0 28 28",
  "333bf": "0 0 28 32",
  "444bf": "0 0 27 31",
  "555bf": "0 0 28 31",
  "333mbf": "0 0 28 32",
  fto: "0 0 28 28",
  "333fm": "0 0 28 28",
};

interface EventIconProps {
  eventId: string;
  size?: number;
  className?: string;
}

export function EventIcon({ eventId, size = 20, className = "" }: EventIconProps) {
  const path = PATHS[eventId];
  if (!path) {
    return <span className={className} style={{ width: size, height: size, display: "inline-block" }}>🧩</span>;
  }

  return (
    <svg
      viewBox={VIEWBOX[eventId] ?? "0 0 28 28"}
      width={size}
      height={size}
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
