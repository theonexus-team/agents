export function fmtUsd(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${n < 0 ? "-" : sign}$${formatted}`;
}

export function fmtPct(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function fmtHeld(openedAt: string, closedAt: string): string {
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h${rem}` : `${hours}h`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function fmtPrice(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 });
}
