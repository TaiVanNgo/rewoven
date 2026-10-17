export type WrenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const wrenTiming = {
  travel: 0.65,
  minimum: 1200,
  exit: 0.3,
  return: 0.35,
} as const;

/** Center the illustration in the visible part of the main workspace. */
export function getWrenStage(
  workspace: WrenRect,
  viewport: { width: number; height: number },
): WrenRect {
  const left = Math.max(0, Math.min(workspace.left, viewport.width));
  const right = Math.max(
    left,
    Math.min(workspace.left + workspace.width, viewport.width),
  );
  const top = Math.max(0, Math.min(workspace.top, viewport.height));
  const bottom = Math.max(
    top,
    Math.min(workspace.top + workspace.height, viewport.height),
  );
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  // Leave room for the loading label and safe margins on short/narrow screens.
  const size = Math.max(0, Math.min(440, width - 32, height - 100));
  return {
    left: left + (width - size) / 2,
    top: top + (height - size - 44) / 2,
    width: size,
    height: size,
  };
}

export function isWrenVisible(
  rect: WrenRect,
  viewport: { width: number; height: number },
) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.left + rect.width <= viewport.width &&
    rect.top + rect.height <= viewport.height
  );
}

export function getWrenExitDelay(
  startedAt: number,
  now: number,
  reducedMotion: boolean,
) {
  return reducedMotion
    ? 0
    : Math.max(0, wrenTiming.minimum - (now - startedAt));
}
