import { withDangerousMod, type ConfigPlugin } from "@expo/config-plugins";
import fs from "node:fs";
import path from "node:path";

type IOSPermissionMessages = {
  usage: string;
  add: string;
};

const IOS_LOCALES: Record<string, IOSPermissionMessages> = {
  en: {
    usage: "TrimSwipe needs access to your photo library so you can review and clean up your camera roll.",
    add: "TrimSwipe needs permission to save optimized versions of your photos.",
  },
  "zh-Hans": {
    usage: "TrimSwipe 需要访问您的照片图库，以便您查看和整理相机胶卷。",
    add: "TrimSwipe 需要权限来保存照片的优化版本。",
  },
  "zh-Hant": {
    usage: "TrimSwipe 需要存取您的照片圖庫，讓您檢視並整理相機膠卷。",
    add: "TrimSwipe 需要權限來儲存照片的最佳化版本。",
  },
  es: {
    usage: "TrimSwipe necesita acceso a tu fototeca para que puedas revisar y limpiar el carrete.",
    add: "TrimSwipe necesita permiso para guardar versiones optimizadas de tus fotos.",
  },
  hi: {
    usage: "TrimSwipe को आपकी फ़ोटो लाइब्रेरी तक पहुँच चाहिए, ताकि आप अपने कैमरा रोल की समीक्षा और सफ़ाई कर सकें।",
    add: "TrimSwipe को आपकी फ़ोटो के अनुकूलित संस्करण सहेजने की अनुमति चाहिए।",
  },
  ar: {
    usage: "يحتاج TrimSwipe إلى الوصول إلى مكتبة الصور لديك لكي تتمكن من مراجعة ألبوم الكاميرا وتنظيفه.",
    add: "يحتاج TrimSwipe إلى إذن لحفظ نسخ محسّنة من صورك.",
  },
  "pt-BR": {
    usage: "O TrimSwipe precisa de acesso à sua fototeca para que você possa revisar e limpar o rolo da câmera.",
    add: "O TrimSwipe precisa de permissão para salvar versões otimizadas das suas fotos.",
  },
  fr: {
    usage: "TrimSwipe a besoin d’accéder à votre photothèque pour que vous puissiez consulter et trier vos photos.",
    add: "TrimSwipe a besoin de l’autorisation d’enregistrer des versions optimisées de vos photos.",
  },
  de: {
    usage: "TrimSwipe benötigt Zugriff auf deine Fotomediathek, damit du deine Aufnahmen prüfen und aufräumen kannst.",
    add: "TrimSwipe benötigt die Erlaubnis, optimierte Versionen deiner Fotos zu speichern.",
  },
  ja: {
    usage: "TrimSwipe は、写真を確認して整理できるように、写真ライブラリへのアクセスを必要とします。",
    add: "TrimSwipe は、最適化した写真のバージョンを保存するための許可を必要とします。",
  },
  ko: {
    usage: "TrimSwipe가 사진을 검토하고 정리할 수 있도록 사진 보관함에 접근해야 합니다.",
    add: "TrimSwipe가 최적화된 사진 버전을 저장하려면 권한이 필요합니다.",
  },
  ru: {
    usage: "TrimSwipe нужен доступ к вашей медиатеке, чтобы вы могли просматривать и очищать фотографии.",
    add: "TrimSwipe нужно разрешение, чтобы сохранять оптимизированные версии ваших фотографий.",
  },
  id: {
    usage: "TrimSwipe memerlukan akses ke perpustakaan foto agar Anda dapat meninjau dan membersihkan foto Anda.",
    add: "TrimSwipe memerlukan izin untuk menyimpan versi foto Anda yang telah dioptimalkan.",
  },
  tr: {
    usage: "TrimSwipe, fotoğraflarınızı inceleyip düzenleyebilmeniz için fotoğraf arşivinize erişim ister.",
    add: "TrimSwipe, fotoğraflarınızın optimize edilmiş sürümlerini kaydetmek için izin ister.",
  },
  it: {
    usage: "TrimSwipe richiede l’accesso alla libreria foto per consentirti di rivedere e organizzare le tue foto.",
    add: "TrimSwipe richiede l’autorizzazione per salvare versioni ottimizzate delle tue foto.",
  },
  vi: {
    usage: "TrimSwipe cần truy cập thư viện ảnh để bạn có thể xem lại và dọn dẹp ảnh của mình.",
    add: "TrimSwipe cần quyền lưu các phiên bản ảnh đã được tối ưu hóa.",
  },
  cs: {
    usage: "TrimSwipe potřebuje přístup k vaší knihovně fotek, abyste mohli své fotky procházet a uklízet.",
    add: "TrimSwipe potřebuje oprávnění k ukládání optimalizovaných verzí vašich fotek.",
  },
  nl: {
    usage: "TrimSwipe heeft toegang tot je fotobibliotheek nodig, zodat je je foto’s kunt bekijken en opruimen.",
    add: "TrimSwipe heeft toestemming nodig om geoptimaliseerde versies van je foto’s op te slaan.",
  },
  fi: {
    usage: "TrimSwipe tarvitsee pääsyn kuvakirjastoosi, jotta voit tarkistaa ja siivota kuviasi.",
    add: "TrimSwipe tarvitsee luvan tallentaa kuvistasi optimoituja versioita.",
  },
  ms: {
    usage: "TrimSwipe memerlukan akses kepada pustaka foto anda supaya anda boleh menyemak dan mengemas foto anda.",
    add: "TrimSwipe memerlukan kebenaran untuk menyimpan versi foto anda yang dioptimumkan.",
  },
  no: {
    usage: "TrimSwipe trenger tilgang til bildebiblioteket ditt, slik at du kan gå gjennom og rydde opp i bildene dine.",
    add: "TrimSwipe trenger tillatelse til å lagre optimaliserte versjoner av bildene dine.",
  },
  pl: {
    usage: "TrimSwipe potrzebuje dostępu do biblioteki zdjęć, aby umożliwić Ci przeglądanie i porządkowanie zdjęć.",
    add: "TrimSwipe potrzebuje zezwolenia na zapisywanie zoptymalizowanych wersji Twoich zdjęć.",
  },
  sv: {
    usage: "TrimSwipe behöver tillgång till ditt bildbibliotek så att du kan granska och rensa bland dina bilder.",
    add: "TrimSwipe behöver tillåtelse att spara optimerade versioner av dina bilder.",
  },
  th: {
    usage: "TrimSwipe ต้องการเข้าถึงคลังรูปภาพเพื่อให้คุณตรวจสอบและจัดระเบียบรูปภาพได้",
    add: "TrimSwipe ต้องการสิทธิ์เพื่อบันทึกภาพถ่ายเวอร์ชันที่ปรับให้เหมาะสม",
  },
  uk: {
    usage: "TrimSwipe потребує доступу до вашої фототеки, щоб ви могли переглядати й упорядковувати фотографії.",
    add: "TrimSwipe потребує дозволу, щоб зберігати оптимізовані версії ваших фотографій.",
  },
  da: {
    usage: "TrimSwipe skal have adgang til dit fotobibliotek, så du kan gennemgå og rydde op i dine billeder.",
    add: "TrimSwipe skal have tilladelse til at gemme optimerede versioner af dine billeder.",
  },
  ta: {
    usage: "உங்கள் புகைப்படங்களை மதிப்பாய்வு செய்து ஒழுங்குபடுத்த TrimSwipe-க்கு உங்கள் புகைப்பட நூலகத்தை அணுக வேண்டும்.",
    add: "உங்கள் புகைப்படங்களின் மேம்படுத்தப்பட்ட பதிப்புகளைச் சேமிக்க TrimSwipe-க்கு அனுமதி தேவை.",
  },
};

const withLocalizedPermissions: ConfigPlugin = (config) => withDangerousMod(config, ["ios", async (iosConfig) => {
  const iosRoot = path.join(iosConfig.modRequest.platformProjectRoot, "TrimSwipe");
  for (const [locale, messages] of Object.entries(IOS_LOCALES)) {
    const directory = path.join(iosRoot, `${locale}.lproj`);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "InfoPlist.strings"),
      `"NSPhotoLibraryUsageDescription" = "${messages.usage}";\n"NSPhotoLibraryAddUsageDescription" = "${messages.add}";\n`,
      "utf8",
    );
  }
  return iosConfig;
}]);

export default withLocalizedPermissions;
