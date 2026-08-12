import { withDangerousMod, type ConfigPlugin } from "@expo/config-plugins";
import fs from "node:fs";
import path from "node:path";

const IOS_LOCALES: Record<string, string> = {
  en: "TrimSwipe needs access to your photo library so you can review and clean up your camera roll.",
  ar: "يحتاج TrimSwipe إلى الوصول إلى مكتبة الصور لمراجعة ألبوم الكاميرا وتنظيفه.",
  de: "TrimSwipe benötigt Zugriff auf deine Fotomediathek, damit du deine Aufnahmen prüfen und aufräumen kannst.",
  es: "TrimSwipe necesita acceso a tu fototeca para revisar y limpiar tu carrete.",
  fr: "TrimSwipe a besoin d’accéder à votre photothèque pour vous aider à la nettoyer.",
  it: "TrimSwipe richiede accesso alla libreria foto per aiutarti a pulire il rullino.",
  pt: "O TrimSwipe precisa de acesso à fototeca para você revisar e limpar suas fotos.",
  ja: "TrimSwipeが写真ライブラリにアクセスすると、写真を確認して整理できます。",
  ko: "TrimSwipe가 사진 보관함에 접근하면 사진을 검토하고 정리할 수 있습니다.",
  ru: "TrimSwipe нужен доступ к медиатеке, чтобы вы могли просматривать и очищать фотографии.",
  zh: "TrimSwipe需要访问照片图库，以便你查看和清理照片。",
  "zh-Hant": "TrimSwipe需要存取照片圖庫，讓你檢視並整理照片。",
  nl: "TrimSwipe heeft toegang tot je fotobibliotheek nodig om je foto's te beoordelen en op te ruimen.",
  sv: "TrimSwipe behöver tillgång till ditt bildbibliotek så att du kan granska och rensa dina bilder.",
  da: "TrimSwipe skal have adgang til dit fotobibliotek, så du kan gennemgå og rydde op i dine billeder.",
  no: "TrimSwipe trenger tilgang til bildebiblioteket ditt slik at du kan gå gjennom og rydde opp i bilder.",
  fi: "TrimSwipe tarvitsee pääsyn kuvakirjastoosi, jotta voit tarkistaa ja siivota kuvasi.",
  pl: "TrimSwipe potrzebuje dostępu do biblioteki zdjęć, aby umożliwić ich przeglądanie i porządkowanie.",
  cs: "TrimSwipe potřebuje přístup k fotkám, abyste je mohli procházet a uklízet.",
  tr: "TrimSwipe, fotoğraflarınızı inceleyip temizleyebilmeniz için fotoğraf arşivinize erişmek istiyor.",
  id: "TrimSwipe memerlukan akses ke perpustakaan foto agar Anda dapat meninjau dan membersihkannya.",
  ms: "TrimSwipe memerlukan akses ke pustaka foto anda untuk menyemak dan membersihkannya.",
  vi: "TrimSwipe cần truy cập thư viện ảnh để bạn xem lại và dọn dẹp ảnh.",
  th: "TrimSwipe ต้องเข้าถึงคลังรูปภาพเพื่อให้คุณตรวจสอบและจัดระเบียบรูปภาพได้",
  uk: "TrimSwipe потребує доступу до фототеки, щоб ви могли переглядати й упорядковувати фото.",
  hi: "TrimSwipe को आपकी फ़ोटो लाइब्रेरी का ऐक्सेस चाहिए ताकि आप फ़ोटो देख और साफ़ कर सकें।",
  ta: "TrimSwipe உங்கள் புகைப்பட நூலகத்தை அணுகி புகைப்படங்களை மதிப்பாய்வு செய்து சுத்தம் செய்ய வேண்டும்.",
};

const withLocalizedPermissions: ConfigPlugin = (config) => withDangerousMod(config, ["ios", async (config) => {
  const iosRoot = path.join(config.modRequest.platformProjectRoot, "TrimSwipe");
  for (const [locale, message] of Object.entries(IOS_LOCALES)) {
    const directory = path.join(iosRoot, `${locale}.lproj`);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "InfoPlist.strings"), `"NSPhotoLibraryUsageDescription" = "${message}";\n"NSPhotoLibraryAddUsageDescription" = "TrimSwipe may save optimized versions of your photos.";\n`, "utf8");
  }
  return config;
}]);

export default withLocalizedPermissions;
