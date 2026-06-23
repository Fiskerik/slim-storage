const { createRunOncePlugin, withAppBuildGradle } = require("expo/config-plugins");

const PLAY_SERVICES_DEPENDENCIES = [
  "com.google.android.gms:play-services-appset:16.0.2",
  "com.google.android.gms:play-services-ads-identifier:18.0.1",
  "com.google.android.gms:play-services-basement:18.3.0",
];

function addDependency(contents, dependency) {
  if (contents.includes(dependency)) return contents;

  return contents.replace(
    /dependencies\s*\{/,
    (match) => `${match}\n    implementation '${dependency}'`
  );
}

function withLevelPlay(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;

    config.modResults.contents = PLAY_SERVICES_DEPENDENCIES.reduce(
      addDependency,
      config.modResults.contents
    );

    return config;
  });
}

module.exports = createRunOncePlugin(withLevelPlay, "with-levelplay", "1.0.0");
