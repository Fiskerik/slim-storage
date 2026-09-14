import path from "node:path";
import { actionCode, exitDuration, resolveSwipeAction } from "./swipeActions";

it("compiles every helper called by the gesture/exit worklets for the UI runtime", () => {
  // Native worklet serialization is not exercised by Jest's Reanimated mock.
  const { transformFileSync } = jest.requireActual("@babel/core");
  const compiled = transformFileSync(path.join(__dirname, "swipeActions.ts"), {
    babelrc: false,
    configFile: false,
    presets: ["@babel/preset-typescript"],
    plugins: ["react-native-worklets/plugin", "@babel/plugin-transform-modules-commonjs"],
  });
  const compiledModule = { exports: {} as Record<string, { __workletHash?: number }> };
  // Only execute our own compiled, local policy module.
  new Function("module", "exports", compiled.code)(compiledModule, compiledModule.exports);
  for (const helper of [resolveSwipeAction, actionCode, exitDuration]) {
    expect(typeof compiledModule.exports[helper.name].__workletHash).toBe("number");
  }
});
