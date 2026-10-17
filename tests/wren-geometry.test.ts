import { describe, expect, test } from "bun:test";
import {
  getWrenExitDelay,
  getWrenStage,
  isWrenVisible,
} from "../src/features/queries/wren-geometry";

describe("Wren's visible workspace", () => {
  test("centers beside the sidebar, rather than in the full browser", () => {
    const stage = getWrenStage(
      { left: 330, top: 28, width: 1000, height: 1000 },
      { width: 1440, height: 900 },
    );
    expect(stage.width).toBe(440);
    expect(stage.left + stage.width / 2).toBe(830);
    expect(stage.top + (stage.height + 44) / 2).toBe(464);
  });
  test("fits narrow and short viewports, including the status label", () => {
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 800, height: 320 },
    ]) {
      const stage = getWrenStage(
        { left: 16, top: 100, width: viewport.width - 32, height: 1000 },
        viewport,
      );
      expect(isWrenVisible(stage, viewport)).toBe(true);
      expect(stage.top + stage.height + 44).toBeLessThanOrEqual(
        viewport.height,
      );
    }
  });
  test("clips scrolled workspace bounds before centering", () => {
    const stage = getWrenStage(
      { left: 20, top: -600, width: 350, height: 1800 },
      { width: 390, height: 700 },
    );
    expect(stage.left + stage.width / 2).toBe(195);
    expect(stage.top + (stage.height + 44) / 2).toBe(350);
  });
  test("uses a fade instead of flying from an offscreen or clipped portrait", () => {
    const viewport = { width: 390, height: 700 };
    expect(
      isWrenVisible({ left: 50, top: 800, width: 220, height: 220 }, viewport),
    ).toBe(false);
    expect(
      isWrenVisible({ left: 50, top: -20, width: 220, height: 220 }, viewport),
    ).toBe(false);
    expect(
      isWrenVisible({ left: 50, top: 200, width: 220, height: 220 }, viewport),
    ).toBe(true);
  });
  test("never produces a negative size when the workspace is outside the viewport", () => {
    expect(
      getWrenStage(
        { left: 0, top: 900, width: 300, height: 600 },
        { width: 320, height: 640 },
      ).width,
    ).toBe(0);
  });
});

test("fast requests finish a brief gesture; slow requests and reduced motion add no hold", () => {
  expect(getWrenExitDelay(1000, 1100, false)).toBe(1100);
  expect(getWrenExitDelay(1000, 2400, false)).toBe(0);
  expect(getWrenExitDelay(1000, 1100, true)).toBe(0);
});
