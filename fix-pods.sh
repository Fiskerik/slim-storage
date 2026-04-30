#!/bin/bash
# Hitta Podfile var den än befinner sig i projektet
PODFILE_PATH=$(find . -name "Podfile" -print -quit)

if [ -f "$PODFILE_PATH" ]; then
  echo "Hittade Podfile på: $PODFILE_PATH"
  # Kolla om raden redan finns för att undvika dubbletter
  if ! grep -q "use_modular_headers!" "$PODFILE_PATH"; then
    echo "use_modular_headers!" >> "$PODFILE_PATH"
    echo "Modular headers tillagda."
  else
    echo "Modular headers fanns redan."
  fi
else
  echo "Kunde inte hitta någon Podfile! Kontrollerar struktur..."
  ls -R
fi