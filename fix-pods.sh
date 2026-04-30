#!/bin/bash
# Gå in i ios-mappen
cd ios/App
# Lägg till den magiska raden i Podfile för att tillåta modul-mappar
echo "use_modular_headers!" >> Podfile
# Gå tillbaka
cd ../..