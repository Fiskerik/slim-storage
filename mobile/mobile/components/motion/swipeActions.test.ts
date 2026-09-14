import { actionCode, exitDuration, resolveSwipeAction, SWIPE_THRESHOLD } from "./swipeActions";

describe("swipe action policy", () => {
  it("keeps the established 110 point directions and threshold", () => {
    expect(resolveSwipeAction(-(SWIPE_THRESHOLD + 1), 0)).toBe("keep");
    expect(resolveSwipeAction(SWIPE_THRESHOLD + 1, 0)).toBe("delete");
    expect(resolveSwipeAction(0, -(SWIPE_THRESHOLD + 1))).toBe("trim");
    expect(resolveSwipeAction(SWIPE_THRESHOLD, 0)).toBeNull();
  });

  it("prioritizes a vertical trim only when the gesture is vertical", () => {
    expect(resolveSwipeAction(150, -180)).toBe("trim");
    expect(resolveSwipeAction(180, -150)).toBe("delete");
  });

  it("uses the same action codes and exit durations for every input path", () => {
    expect(actionCode("keep")).toBe(1);
    expect(actionCode("trim")).toBe(2);
    expect(actionCode("delete")).toBe(3);
    expect(exitDuration("delete", false)).toBe(260);
    expect(exitDuration("trim", false)).toBe(220);
    expect(exitDuration("keep", false)).toBe(180);
    expect(exitDuration("delete", true)).toBe(140);
  });
});
