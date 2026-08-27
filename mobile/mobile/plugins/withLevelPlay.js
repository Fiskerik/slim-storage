const {
  createRunOncePlugin,
  withAppBuildGradle,
  withPodfile,
} = require("expo/config-plugins");

const PLAY_SERVICES_DEPENDENCIES = [
  "com.google.android.gms:play-services-appset:16.0.2",
  "com.google.android.gms:play-services-ads-identifier:18.0.1",
  "com.google.android.gms:play-services-basement:18.3.0",
];
const IOS_MEDIATION_PODS = [
  {
    name: "IronSourceFacebookAdapter",
    declaration: "pod 'IronSourceFacebookAdapter', '5.4.0.0'",
  },
  {
    name: "IronSourceYandexAdapter",
    declaration: "pod 'IronSourceYandexAdapter', '5.12.0.0'",
  },
];

function addDependency(contents, dependency) {
  if (contents.includes(dependency)) return contents;
  return contents.replace(
    /dependencies\s*\{/,
    (match) => `${match}\n    implementation '${dependency}'`,
  );
}

function addIosMediationPods(contents) {
  const missingPods = IOS_MEDIATION_PODS.filter(
    ({ name }) => !contents.includes(`pod '${name}'`),
  );
  if (missingPods.length === 0) return contents;

  const expoModulesLine = /^(\s*)use_expo_modules!\s*$/m;
  if (!expoModulesLine.test(contents)) {
    throw new Error(
      "Unable to add the LevelPlay mediation adapters: use_expo_modules! was not found in the generated Podfile.",
    );
  }

  return contents.replace(
    expoModulesLine,
    (line, indentation) =>
      `${line}\n${missingPods
        .map(({ declaration }) => `${indentation}${declaration}`)
        .join("\n")}`,
  );
}

function withLevelPlay(config) {
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") return config;
    config.modResults.contents = PLAY_SERVICES_DEPENDENCIES.reduce(
      addDependency,
      config.modResults.contents,
    );
    return config;
  });

  return withPodfile(config, (config) => {
    config.modResults.contents = addIosMediationPods(config.modResults.contents);
    return config;
  });
}

const plugin = createRunOncePlugin(withLevelPlay, "with-levelplay", "1.2.0");
plugin.addIosMediationPods = addIosMediationPods;

module.exports = plugin;
