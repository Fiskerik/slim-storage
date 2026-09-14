import { Animated } from "react-native";
import { render } from "@testing-library/react-native";
import { AnimatedActionChip } from "./AnimatedActionChip";
import { AnimatedImpactBar } from "./AnimatedImpactBar";

let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated"),
  useReducedMotion: () => mockReducedMotion,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

beforeEach(() => { mockReducedMotion = false; });
afterEach(() => { jest.restoreAllMocks(); });

it("does not animate newly mounted list chips, but animates actual selection changes natively", async () => {
  const timing = jest.spyOn(Animated, "timing");
  const props = { action: "delete" as const, label: "Delete", onPress: () => {} };
  const view = await render(<AnimatedActionChip {...props} />);
  expect(timing).not.toHaveBeenCalled();
  await view.rerender(<AnimatedActionChip {...props} selected={false} />);
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ useNativeDriver: true, duration: 180 }));
  await view.rerender(<AnimatedActionChip {...props} selected={false} label="Updated label" />);
  expect(timing).toHaveBeenCalledTimes(1);
});

it.each([false, true])("impact bars never animate width on the JS thread (reduced=%s)", async (reduced) => {
  mockReducedMotion = reduced;
  const timing = jest.spyOn(Animated, "timing");
  await render(<AnimatedImpactBar progress={0.6} />);
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    useNativeDriver: true, duration: reduced ? 140 : 360,
  }));
});
