import { createColors } from "picocolors";

type Colors = ReturnType<typeof createColors>;

let current: Colors = createColors();

/** Force colour on/off; pass `undefined` to auto-detect (TTY + NO_COLOR). */
export function configureColor(enabled: boolean | undefined): void {
  current = createColors(enabled);
}

export function colors(): Colors {
  return current;
}
