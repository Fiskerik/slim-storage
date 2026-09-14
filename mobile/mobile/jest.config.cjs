module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^react-native-reanimated$": "<rootDir>/node_modules/react-native-reanimated/lib/module/mock.js",
    "^react-native-worklets$": "<rootDir>/node_modules/react-native-worklets/lib/module/mock.js",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/scripts/"],
};
