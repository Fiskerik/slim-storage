import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

const candidateRoots = [repoRoot, join(repoRoot, "mobile", "mobile"), process.cwd()];

const podspecRelativePath = join(
  "node_modules",
  "@dr.pogodin",
  "react-native-static-server",
  "ReactNativeStaticServer.podspec",
);

const patchArgs =
  "-DCMAKE_XCODE_ATTRIBUTE_CODE_SIGNING_ALLOWED=NO " +
  "-DCMAKE_XCODE_ATTRIBUTE_CODE_SIGNING_REQUIRED=NO " +
  '-DCMAKE_XCODE_ATTRIBUTE_DEVELOPMENT_TEAM=""';

const original =
  'EXTRA_CONFIG_ARGS="-DCMAKE_OSX_ARCHITECTURES=arm64;x86_64 ' +
  "-DCMAKE_OSX_DEPLOYMENT_TARGET=${IPHONEOS_DEPLOYMENT_TARGET} " +
  '-DCMAKE_SYSTEM_NAME=iOS -GXcode"';

const patched =
  'EXTRA_CONFIG_ARGS="-DCMAKE_OSX_ARCHITECTURES=arm64;x86_64 ' +
  "-DCMAKE_OSX_DEPLOYMENT_TARGET=${IPHONEOS_DEPLOYMENT_TARGET} " +
  "-DCMAKE_SYSTEM_NAME=iOS " +
  `${patchArgs} -GXcode\"`;

const uniquePodspecPaths = [
  ...new Set(candidateRoots.map((root) => join(root, podspecRelativePath))),
];
let patchedCount = 0;
let foundCount = 0;

for (const podspecPath of uniquePodspecPaths) {
  if (!existsSync(podspecPath)) continue;

  foundCount += 1;
  const contents = readFileSync(podspecPath, "utf8");

  if (contents.includes(patchArgs)) {
    console.log(`[patch-static-server-podspec] Already patched ${podspecPath}`);
    continue;
  }

  if (!contents.includes(original)) {
    throw new Error(
      `Unable to patch ${podspecPath}: expected CMake iOS EXTRA_CONFIG_ARGS line was not found.`,
    );
  }

  writeFileSync(podspecPath, contents.replace(original, patched));
  patchedCount += 1;
  console.log(`[patch-static-server-podspec] Patched ${podspecPath}`);
}

if (foundCount === 0) {
  console.log(
    "[patch-static-server-podspec] ReactNativeStaticServer podspec not installed; skipping.",
  );
} else {
  console.log(
    `[patch-static-server-podspec] Complete. Patched ${patchedCount}/${foundCount} podspec file(s).`,
  );
}
