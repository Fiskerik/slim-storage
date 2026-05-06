const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  IOSConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withXcodeProject,
} = require("@expo/config-plugins");

const WEB_ASSETS_RELATIVE_PATH = "assets/www";
const ROOT_WEB_ASSETS_RELATIVE_PATH = "mobile/mobile/assets/www";
const IOS_WEB_FOLDER_NAME = "www";
const ANDROID_ASSETS_SOURCE_SET = "../../assets";

function copyDirectorySync(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Static web assets directory does not exist: ${source}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function resolveWebAssetsPath(projectRoot) {
  const localAssets = path.join(projectRoot, WEB_ASSETS_RELATIVE_PATH);
  if (fs.existsSync(localAssets)) return localAssets;

  const rootAssets = path.join(projectRoot, ROOT_WEB_ASSETS_RELATIVE_PATH);
  if (fs.existsSync(rootAssets)) return rootAssets;

  return localAssets;
}

function withAndroidCleartextForLocalhost(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$["android:usesCleartextTraffic"] = "true";
    return config;
  });
}

function withAndroidStaticAssets(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withStaticServerAssets only supports Groovy android/app/build.gradle files.");
    }

    const marker = "// TrimSwipe local web bundle assets for @dr.pogodin/react-native-static-server";
    if (config.modResults.contents.includes(marker)) {
      return config;
    }

    config.modResults.contents = config.modResults.contents.replace(
      /android\s*\{/,
      `android {\n    ${marker}\n    sourceSets {\n        main {\n            assets.srcDirs += ['${ANDROID_ASSETS_SOURCE_SET}']\n        }\n    }`,
    );

    return config;
  });
}

function withIosStaticAssets(config) {
  config = withDangerousMod(config, ["ios", (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const source = resolveWebAssetsPath(projectRoot);
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const destination = path.join(IOSConfig.Paths.getSourceRoot(projectRoot), IOS_WEB_FOLDER_NAME);

    copyDirectorySync(source, destination);
    console.log(`[withStaticServerAssets] Copied ${source} to ${destination}`);

    config.modResults = config.modResults || {};
    config.modResults.trimSwipeStaticAssets = {
      projectName,
      destination,
    };

    return config;
  }]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    
    // Hitta huvudmålet för appen
    const target = project.getTarget("com.apple.product-type.application");
    if (!target) {
      throw new Error("Unable to find the iOS application target for static web assets.");
    }

    // Försök hitta projektgruppen, annars använd huvudgruppen
    const group = project.pbxGroupByName(projectName) || project.getPBXGroupByKey(project.getFirstProject().firstProject.mainGroup);
    const filePath = `${projectName}/${IOS_WEB_FOLDER_NAME}`;

    if (!project.hasFile(filePath)) {
      // Vi lägger till mappen som en "Folder Reference" (blå mapp i Xcode)
      project.addResourceFile(
        filePath,
        {
          lastKnownFileType: "folder",
          target: target.uuid,
        },
        group.uuid // Tog bort ? för att säkerställa att vi har ett värde här nu
      );
    }

    return config;
  });
}

module.exports = function withStaticServerAssets(config) {
  config = withAndroidCleartextForLocalhost(config);
  config = withAndroidStaticAssets(config);
  config = withIosStaticAssets(config);
  return config;
};