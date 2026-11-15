"use client";
import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="num text-lg">--:--:--</div>;
  return (
    <div className="text-right leading-tight">
      <div className="num text-lg font-semibold">{formatInTimeZone(now, "America/New_York", "h:mm:ss a")} ET</div>
      <div className="text-[11px] text-muted">{formatInTimeZone(now, "America/New_York", "EEEE, MMMM d, yyyy")}</div>
    </div>
  );
}
