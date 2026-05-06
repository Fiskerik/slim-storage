#!/usr/bin/env bash

echo "=== EAS Pre-Install Hook ==="

if [[ "$EAS_BUILD_PLATFORM" == "ios" ]]; then
  echo "Installing cmake and pkg-config for ReactNativeStaticServer..."
  brew install cmake pkg-config
  echo "CMake version: $(cmake --version)"
fi