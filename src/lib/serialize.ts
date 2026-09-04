import type { Decimal } from "@prisma/client-runtime-utils";

export function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d.toString());
}
