#!/bin/bash
# Navigera till iOS-projektets plats
cd ios/App
# Lägg till global inställning för modulära headers i Podfile
echo "use_modular_headers!" >> Podfile
cd ../..