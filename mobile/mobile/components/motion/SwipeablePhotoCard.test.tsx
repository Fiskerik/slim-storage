import { useState } from "react";
import { Image, Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { GestureHandlerRootView, State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SwipeablePhotoCard, type SwipeAction, type SwipeActionCommand } from "./SwipeablePhotoCard";
import type { NativePhoto } from "../../lib/native-photo-source";

// Keep shared values stable across rerenders and explicitly finish animations.
// This exercises races that an immediately-completing animation mock hides.
const mockFinishes: ((finished: boolean) => void)[] = [];
const mockTiming = jest.fn((value, _config, finish) => { mockFinishes.push(finish); return value; });
const mockSpring = jest.fn((value) => value);
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useReducedMotion: () => mockReducedMotion,
  useSharedValue: (value: unknown) => jest.requireActual<typeof import("react")>("react").useRef({ value }).current,
  withTiming: (...args: Parameters<typeof mockTiming>) => mockTiming(...args),
  withSpring: (...args: Parameters<typeof mockSpring>) => mockSpring(...args),
}));

const photo = { id: "a", uri: "file:///a.jpg", sizeMB: 5 } as NativePhoto;
const renderCard = (item: NativePhoto) => <Image testID="source-photo" source={{ uri: item.uri }} />;
const onAction = jest.fn<boolean | void, [SwipeAction]>();
const onComplete = jest.fn();
type CardProps = Partial<React.ComponentProps<typeof SwipeablePhotoCard>>;
const card = (props: CardProps = {}) => <GestureHandlerRootView>
  <SwipeablePhotoCard photo={photo} canTrim onAction={onAction} onCommandComplete={onComplete} onOpenFull={() => {}} renderCard={renderCard} {...props} />
</GestureHandlerRootView>;

function swipe(x: number, y: number, canceled = false) {
  fireGestureHandler(getByGestureTestId("photo-swipe"), [
    { state: State.BEGAN, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, translationX: x, translationY: y },
    { state: canceled ? State.CANCELLED : State.END, translationX: x, translationY: y },
  ]);
}

beforeEach(() => {
  mockFinishes.length = 0;
  mockReducedMotion = false;
  mockTiming.mockClear();
  mockSpring.mockClear();
  onAction.mockReset();
  onComplete.mockClear();
});

describe("swipe transition", () => {
  it.each([
    ["keep", -150, 0, 180], ["trim", 0, -150, 220], ["delete", 150, 0, 260],
  ] as const)("buttons and gestures share the %s exit", async (action, x, y, duration) => {
    function ButtonHarness() {
      const [command, setCommand] = useState<SwipeActionCommand | null>(null);
      return <>
        <Pressable onPress={() => setCommand({ id: 1, action, photoId: photo.id })}><Text>Choose</Text></Pressable>
        {card({ command })}
      </>;
    }
    const buttonView = await render(<ButtonHarness />);
    await fireEvent.press(buttonView.getByText("Choose"));
    expect(mockTiming).toHaveBeenCalledTimes(1);
    const buttonConfig = mockTiming.mock.calls[0][1];
    expect(buttonConfig.duration).toBe(duration);
    expect(onAction).not.toHaveBeenCalled();
    await act(() => { mockFinishes[0](true); });
    expect(onAction).toHaveBeenCalledWith(action);
    await buttonView.unmount();

    mockTiming.mockClear();
    onAction.mockClear();
    mockFinishes.length = 0;
    await render(card());
    await act(() => { swipe(x, y); });
    expect(mockTiming.mock.calls[0][1]).toEqual(buttonConfig);
    expect(onAction).not.toHaveBeenCalled();
    await act(() => { mockFinishes[0](true); });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it.each([false, true])("returns a short/canceled gesture to rest (canceled=%s)", async (canceled) => {
    await render(card());
    await act(() => { swipe(canceled ? 180 : 80, 30, canceled); });
    expect(mockTiming).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(mockSpring).toHaveBeenCalledTimes(2);
    expect(mockSpring.mock.calls.every(([target]) => target === 0)).toBe(true);
  });

  it("locks rapid commands and simultaneous gesture/button input to one commit", async () => {
    const view = await render(card());
    await act(() => { swipe(160, 0); });
    await view.rerender(card({ command: { id: 1, action: "trim", photoId: "a" } }));
    await view.rerender(card({ command: { id: 2, action: "keep", photoId: "a" } }));
    await act(() => { swipe(-160, 0); });
    expect(mockTiming).toHaveBeenCalledTimes(1);
    await act(() => { mockFinishes[0](true); mockFinishes[0](true); });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("delete");
  });

  it("does not exit for unavailable Trim and permits the next choice", async () => {
    const view = await render(card({ canTrim: false, command: { id: 1, action: "trim" } }));
    expect(mockTiming).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    await view.rerender(card({ canTrim: false, command: { id: 2, action: "keep" } }));
    await act(() => { mockFinishes[0](true); });
    expect(onAction).toHaveBeenCalledWith("keep");
  });

  it("restores the card if a choice becomes unavailable during its exit", async () => {
    onAction.mockReturnValueOnce(false);
    const view = await render(card({ command: { id: 1, action: "trim" } }));
    await act(() => { mockFinishes[0](true); });
    await view.rerender(card({ command: { id: 2, action: "keep" } }));
    await act(() => { mockFinishes[1](true); });
    expect(onAction.mock.calls).toEqual([["trim"], ["keep"]]);
  });

  it("ignores canceled finishes and callbacks after unmount", async () => {
    const view = await render(card({ command: { id: 1, action: "delete" } }));
    await act(() => { mockFinishes[0](false); });
    expect(onAction).not.toHaveBeenCalled();
    await view.unmount();
    await act(() => { mockFinishes[0](true); });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("cannot apply an old exit to an Undo-restored/replacement photo", async () => {
    const view = await render(card({ command: { id: 1, action: "delete", photoId: "a" } }));
    const nextAction = jest.fn();
    await view.rerender(card({ photo: { ...photo, id: "restored" }, onAction: nextAction, command: { id: 1, action: "delete", photoId: "a" } }));
    await act(() => { mockFinishes[0](true); });
    expect(onAction).not.toHaveBeenCalled();
    expect(nextAction).not.toHaveBeenCalled();
    expect(mockTiming).toHaveBeenCalledTimes(1);
    await act(() => { swipe(-150, 0); mockFinishes[1](true); });
    expect(nextAction).toHaveBeenCalledWith("keep");
  });

  it("renders only one photo, with smoke pre-mounted before the delete", async () => {
    const view = await render(card());
    const countImages = (node: unknown): number => {
      if (!node || typeof node !== "object") return 0;
      const element = node as { type?: string; children?: unknown[] };
      return (element.type === "Image" ? 1 : 0) + (element.children ?? []).reduce<number>((count, child) => count + countImages(child), 0);
    };
    expect(countImages(view.toJSON())).toBe(1);
    expect(view.getAllByTestId("delete-smoke-mote")).toHaveLength(5);
    await act(() => { swipe(150, 0); });
    expect(countImages(view.toJSON())).toBe(1);
    expect(view.getAllByTestId("delete-smoke-mote")).toHaveLength(5);
  });

  it("reduced motion omits smoke/cut line and uses only a 140ms fade, preserving commit", async () => {
    mockReducedMotion = true;
    const props: CardProps = { command: { id: 1, action: "delete" } };
    const view = await render(card(props));
    await view.rerender(card(props));
    expect(view.queryByTestId("delete-smoke-mote")).toBeNull();
    expect(view.queryByTestId("trim-cut-line")).toBeNull();
    expect(view.getByTestId("swipe-photo")).toHaveStyle({ opacity: 0, transform: [] });
    expect(mockTiming.mock.calls[0][1].duration).toBe(140);
    await act(() => { mockFinishes[0](true); });
    expect(onAction).toHaveBeenCalledWith("delete");
  });
});
