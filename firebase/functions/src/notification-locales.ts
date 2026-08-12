/**
 * Notification copy kept in the functions bundle so pushes can be rendered in
 * the language selected in the app.  The locale is installation metadata, not
 * user-generated content; unknown/legacy values intentionally fall back to
 * English.
 */

export type SmartReminderTrigger =
  | "low-storage"
  | "streak-at-risk"
  | "new-photos"
  | "cleanup-opportunity"
  | "inactivity"
  | "weekly-progress";

type ReminderCopy = { title: string; body: string };

const ENGLISH_SMART: Record<SmartReminderTrigger, ReminderCopy> = {
  "low-storage": {
    title: "Your iPhone is running low on space",
    body: "A quick TrimSwipe session could free up room.",
  },
  "streak-at-risk": {
    title: "Keep your cleanup streak going",
    body: "A few quick swipes are enough for today.",
  },
  "new-photos": {
    title: "Your camera roll has grown",
    body: "TrimSwipe can help you clear a little space.",
  },
  "cleanup-opportunity": {
    title: "A useful cleanup is waiting",
    body: "TrimSwipe found photos you may want to review.",
  },
  inactivity: {
    title: "Ready for a fresh start?",
    body: "Your photo library may be ready for a quick refresh.",
  },
  "weekly-progress": {
    title: "Make a little progress this week",
    body: "Open TrimSwipe for a short cleanup session.",
  },
};

/**
 * Short, notification-sized copy. Keep each translation as a complete pair so
 * title/body never mix languages. Product terms (TrimSwipe) stay unchanged.
 */
const SMART: Record<string, Record<SmartReminderTrigger, ReminderCopy>> = {
  en: ENGLISH_SMART,
  "zh-Hans": {
    "low-storage": { title: "iPhone 存储空间不足", body: "打开 TrimSwipe，快速清理一些空间。" },
    "streak-at-risk": { title: "保持清理连续记录", body: "今天再滑几张照片就够了。" },
    "new-photos": { title: "相册又增加了照片", body: "TrimSwipe 可以帮你释放一些空间。" },
    "cleanup-opportunity": { title: "有一项清理等着你", body: "TrimSwipe 找到了一些值得查看的照片。" },
    inactivity: { title: "准备好重新开始了吗？", body: "你的照片库可能适合快速整理一下。" },
    "weekly-progress": { title: "本周再完成一点进度", body: "打开 TrimSwipe，进行一次简短清理。" },
  },
  "zh-Hant": {
    "low-storage": { title: "iPhone 儲存空間不足", body: "打開 TrimSwipe，快速清理一些空間。" },
    "streak-at-risk": { title: "保持清理連續紀錄", body: "今天再滑幾張照片就夠了。" },
    "new-photos": { title: "相簿又增加了照片", body: "TrimSwipe 可以幫你釋放一些空間。" },
    "cleanup-opportunity": { title: "有一項清理等著你", body: "TrimSwipe 找到了一些值得查看的照片。" },
    inactivity: { title: "準備好重新開始了嗎？", body: "你的照片庫可能適合快速整理一下。" },
    "weekly-progress": { title: "本週再完成一點進度", body: "打開 TrimSwipe，進行一次簡短清理。" },
  },
  es: {
    "low-storage": { title: "Tu iPhone tiene poco espacio", body: "Una sesión rápida de TrimSwipe puede liberar espacio." },
    "streak-at-risk": { title: "Mantén tu racha de limpieza", body: "Unos cuantos deslizamientos bastan por hoy." },
    "new-photos": { title: "Tu carrete ha crecido", body: "TrimSwipe puede ayudarte a liberar un poco de espacio." },
    "cleanup-opportunity": { title: "Tienes una limpieza pendiente", body: "TrimSwipe encontró fotos que quizá quieras revisar." },
    inactivity: { title: "¿Listo para empezar de nuevo?", body: "Tu fototeca podría agradecer una limpieza rápida." },
    "weekly-progress": { title: "Avanza un poco esta semana", body: "Abre TrimSwipe para una sesión breve de limpieza." },
  },
  hi: {
    "low-storage": { title: "आपके iPhone में जगह कम है", body: "TrimSwipe का छोटा सा सत्र कुछ जगह खाली कर सकता है।" },
    "streak-at-risk": { title: "अपनी क्लीनअप स्ट्रीक बनाए रखें", body: "आज के लिए कुछ तेज़ स्वाइप ही काफी हैं।" },
    "new-photos": { title: "आपके कैमरा रोल में नई तस्वीरें हैं", body: "TrimSwipe कुछ जगह खाली करने में मदद कर सकता है।" },
    "cleanup-opportunity": { title: "क्लीनअप आपका इंतज़ार कर रहा है", body: "TrimSwipe को कुछ ऐसी तस्वीरें मिली हैं जिन्हें आप देखना चाहेंगे।" },
    inactivity: { title: "नई शुरुआत के लिए तैयार हैं?", body: "आपकी फोटो लाइब्रेरी जल्दी से व्यवस्थित की जा सकती है।" },
    "weekly-progress": { title: "इस हफ्ते थोड़ा और आगे बढ़ें", body: "छोटे क्लीनअप सत्र के लिए TrimSwipe खोलें।" },
  },
  ar: {
    "low-storage": { title: "مساحة iPhone لديك تكاد تنفد", body: "قد تساعد جلسة سريعة في TrimSwipe على توفير مساحة." },
    "streak-at-risk": { title: "حافظ على سلسلة التنظيف", body: "تكفيك بعض التمريرات السريعة اليوم." },
    "new-photos": { title: "أصبح لديك المزيد من الصور", body: "يمكن أن يساعدك TrimSwipe في توفير بعض المساحة." },
    "cleanup-opportunity": { title: "هناك تنظيف مفيد بانتظارك", body: "عثر TrimSwipe على صور قد ترغب في مراجعتها." },
    inactivity: { title: "هل أنت مستعد لبداية جديدة؟", body: "قد تكون مكتبة الصور لديك جاهزة لتنظيف سريع." },
    "weekly-progress": { title: "أحرز بعض التقدم هذا الأسبوع", body: "افتح TrimSwipe لجلسة تنظيف قصيرة." },
  },
  "pt-BR": {
    "low-storage": { title: "Seu iPhone está ficando sem espaço", body: "Uma sessão rápida do TrimSwipe pode liberar espaço." },
    "streak-at-risk": { title: "Mantenha sua sequência de limpeza", body: "Alguns deslizes rápidos já bastam por hoje." },
    "new-photos": { title: "Seu rolo de câmera aumentou", body: "O TrimSwipe pode ajudar a liberar um pouco de espaço." },
    "cleanup-opportunity": { title: "Há uma limpeza esperando por você", body: "O TrimSwipe encontrou fotos que você pode querer revisar." },
    inactivity: { title: "Pronto para recomeçar?", body: "Sua fototeca pode estar pronta para uma limpeza rápida." },
    "weekly-progress": { title: "Avance um pouco esta semana", body: "Abra o TrimSwipe para uma sessão curta de limpeza." },
  },
  fr: {
    "low-storage": { title: "Votre iPhone manque d’espace", body: "Une courte session TrimSwipe peut libérer de la place." },
    "streak-at-risk": { title: "Poursuivez votre série de nettoyage", body: "Quelques balayages rapides suffisent aujourd’hui." },
    "new-photos": { title: "Votre pellicule s’est agrandie", body: "TrimSwipe peut vous aider à libérer un peu d’espace." },
    "cleanup-opportunity": { title: "Un nettoyage utile vous attend", body: "TrimSwipe a trouvé des photos à vérifier." },
    inactivity: { title: "Prêt à repartir du bon pied ?", body: "Votre photothèque est peut-être prête pour un nettoyage rapide." },
    "weekly-progress": { title: "Progressez un peu cette semaine", body: "Ouvrez TrimSwipe pour une courte session de nettoyage." },
  },
  de: {
    "low-storage": { title: "Der Speicher deines iPhones wird knapp", body: "Eine kurze TrimSwipe-Sitzung kann Platz schaffen." },
    "streak-at-risk": { title: "Halte deine Aufräumserie aufrecht", body: "Ein paar schnelle Wischbewegungen reichen für heute." },
    "new-photos": { title: "Deine Fotomediathek ist gewachsen", body: "TrimSwipe hilft dir, etwas Speicher freizugeben." },
    "cleanup-opportunity": { title: "Eine nützliche Bereinigung wartet", body: "TrimSwipe hat Fotos zum Überprüfen gefunden." },
    inactivity: { title: "Bereit für einen Neuanfang?", body: "Deine Fotomediathek ist vielleicht bereit für eine schnelle Bereinigung." },
    "weekly-progress": { title: "Mach diese Woche ein wenig Fortschritt", body: "Öffne TrimSwipe für eine kurze Aufräumsitzung." },
  },
  ja: {
    "low-storage": { title: "iPhoneの空き容量が少なくなっています", body: "TrimSwipeですばやく整理して空き容量を増やせます。" },
    "streak-at-risk": { title: "整理の連続記録を続けましょう", body: "今日は数回スワイプするだけで十分です。" },
    "new-photos": { title: "カメラロールに写真が増えています", body: "TrimSwipeで空き容量を少し増やせます。" },
    "cleanup-opportunity": { title: "整理できる写真があります", body: "TrimSwipeが確認できる写真を見つけました。" },
    inactivity: { title: "新しく始めてみませんか？", body: "写真ライブラリをすばやく整理できます。" },
    "weekly-progress": { title: "今週も少し進めましょう", body: "TrimSwipeを開いて短い整理セッションを始めましょう。" },
  },
  ko: {
    "low-storage": { title: "iPhone 저장 공간이 부족합니다", body: "TrimSwipe로 잠깐 정리하면 공간을 확보할 수 있어요." },
    "streak-at-risk": { title: "정리 연속 기록을 이어가세요", body: "오늘은 몇 번만 빠르게 스와이프하면 충분해요." },
    "new-photos": { title: "카메라 롤에 사진이 늘었어요", body: "TrimSwipe가 공간을 조금 확보해 드려요." },
    "cleanup-opportunity": { title: "정리할 사진이 있어요", body: "TrimSwipe가 검토할 사진을 찾았어요." },
    inactivity: { title: "새롭게 시작해 볼까요?", body: "사진 보관함을 빠르게 정리할 수 있어요." },
    "weekly-progress": { title: "이번 주에도 조금 진행해 보세요", body: "TrimSwipe를 열어 짧게 정리해 보세요." },
  },
  ru: {
    "low-storage": { title: "На iPhone заканчивается место", body: "Быстрый сеанс TrimSwipe поможет освободить место." },
    "streak-at-risk": { title: "Продолжайте серию уборок", body: "Сегодня достаточно сделать несколько быстрых свайпов." },
    "new-photos": { title: "В фотоплёнке стало больше снимков", body: "TrimSwipe поможет освободить немного места." },
    "cleanup-opportunity": { title: "Вас ждёт полезная уборка", body: "TrimSwipe нашёл фотографии, которые стоит просмотреть." },
    inactivity: { title: "Готовы начать заново?", body: "Фототека готова к быстрой уборке." },
    "weekly-progress": { title: "Продвиньтесь ещё немного на этой неделе", body: "Откройте TrimSwipe для короткой уборки." },
  },
  id: {
    "low-storage": { title: "Penyimpanan iPhone hampir penuh", body: "Sesi singkat TrimSwipe dapat mengosongkan ruang." },
    "streak-at-risk": { title: "Pertahankan rangkaian pembersihan", body: "Cukup lakukan beberapa geseran cepat hari ini." },
    "new-photos": { title: "Foto di rol kamera bertambah", body: "TrimSwipe dapat membantu mengosongkan sedikit ruang." },
    "cleanup-opportunity": { title: "Ada pembersihan yang menunggu", body: "TrimSwipe menemukan foto yang mungkin ingin Anda tinjau." },
    inactivity: { title: "Siap memulai lagi?", body: "Perpustakaan foto Anda mungkin siap dirapikan." },
    "weekly-progress": { title: "Buat sedikit kemajuan minggu ini", body: "Buka TrimSwipe untuk sesi pembersihan singkat." },
  },
  tr: {
    "low-storage": { title: "iPhone saklama alanı azalıyor", body: "Kısa bir TrimSwipe oturumu yer açabilir." },
    "streak-at-risk": { title: "Temizlik serinizi sürdürün", body: "Bugün birkaç hızlı kaydırma yeterli." },
    "new-photos": { title: "Film rulonuz büyüdü", body: "TrimSwipe biraz yer açmanıza yardımcı olabilir." },
    "cleanup-opportunity": { title: "Yararlı bir temizlik sizi bekliyor", body: "TrimSwipe gözden geçirmek isteyebileceğiniz fotoğraflar buldu." },
    inactivity: { title: "Yeni bir başlangıca hazır mısınız?", body: "Fotoğraf arşiviniz hızlı bir temizliğe hazır olabilir." },
    "weekly-progress": { title: "Bu hafta biraz ilerleme kaydedin", body: "Kısa bir temizlik oturumu için TrimSwipe'i açın." },
  },
  it: {
    "low-storage": { title: "Lo spazio sul tuo iPhone sta per finire", body: "Una breve sessione di TrimSwipe può liberare spazio." },
    "streak-at-risk": { title: "Continua la tua serie di pulizie", body: "Per oggi bastano pochi swipe veloci." },
    "new-photos": { title: "Il tuo rullino è cresciuto", body: "TrimSwipe può aiutarti a liberare un po’ di spazio." },
    "cleanup-opportunity": { title: "Una pulizia utile ti aspetta", body: "TrimSwipe ha trovato foto che potresti voler controllare." },
    inactivity: { title: "Pronto per un nuovo inizio?", body: "La tua libreria foto potrebbe essere pronta per una pulizia rapida." },
    "weekly-progress": { title: "Fai qualche progresso questa settimana", body: "Apri TrimSwipe per una breve sessione di pulizia." },
  },
  vi: {
    "low-storage": { title: "iPhone của bạn sắp hết dung lượng", body: "Một phiên TrimSwipe nhanh có thể giải phóng thêm chỗ trống." },
    "streak-at-risk": { title: "Tiếp tục chuỗi dọn dẹp của bạn", body: "Hôm nay chỉ cần vuốt nhanh vài lần là đủ." },
    "new-photos": { title: "Thư viện ảnh của bạn đã tăng", body: "TrimSwipe có thể giúp bạn giải phóng một chút dung lượng." },
    "cleanup-opportunity": { title: "Có ảnh đang chờ được dọn dẹp", body: "TrimSwipe đã tìm thấy ảnh bạn có thể muốn xem lại." },
    inactivity: { title: "Sẵn sàng bắt đầu lại chưa?", body: "Thư viện ảnh của bạn có thể đã sẵn sàng để dọn nhanh." },
    "weekly-progress": { title: "Tiến thêm một chút trong tuần này", body: "Mở TrimSwipe để dọn dẹp nhanh." },
  },
  cs: {
    "low-storage": { title: "V iPhonu dochází místo", body: "Krátká relace v TrimSwipe může uvolnit místo." },
    "streak-at-risk": { title: "Udržte svou sérii čištění", body: "Dnes stačí několik rychlých přejetí." },
    "new-photos": { title: "Ve fotoaparátu přibyly fotografie", body: "TrimSwipe vám pomůže uvolnit trochu místa." },
    "cleanup-opportunity": { title: "Čeká na vás užitečné čištění", body: "TrimSwipe našel fotografie, které můžete zkontrolovat." },
    inactivity: { title: "Jste připraveni začít znovu?", body: "Vaše fotoknihovna možná potřebuje rychlé vyčištění." },
    "weekly-progress": { title: "Tento týden udělejte malý pokrok", body: "Otevřete TrimSwipe pro krátkou relaci čištění." },
  },
  nl: {
    "low-storage": { title: "De opslagruimte op je iPhone raakt op", body: "Een korte TrimSwipe-sessie kan ruimte vrijmaken." },
    "streak-at-risk": { title: "Houd je opruimreeks vol", body: "Een paar snelle veegbewegingen zijn vandaag genoeg." },
    "new-photos": { title: "Je filmrol is gegroeid", body: "TrimSwipe helpt je wat ruimte vrij te maken." },
    "cleanup-opportunity": { title: "Er wacht een nuttige opruimactie", body: "TrimSwipe vond foto’s die je kunt bekijken." },
    inactivity: { title: "Klaar voor een frisse start?", body: "Je fotobibliotheek is misschien toe aan een snelle opruimbeurt." },
    "weekly-progress": { title: "Maak deze week een beetje vooruitgang", body: "Open TrimSwipe voor een korte opruimsessie." },
  },
  fi: {
    "low-storage": { title: "iPhonen tallennustila on vähissä", body: "Nopea TrimSwipe-istunto voi vapauttaa tilaa." },
    "streak-at-risk": { title: "Jatka siivousputkeasi", body: "Muutama nopea pyyhkäisy riittää tänään." },
    "new-photos": { title: "Kameran rullaan on tullut lisää kuvia", body: "TrimSwipe auttaa vapauttamaan hieman tilaa." },
    "cleanup-opportunity": { title: "Hyödyllinen siivous odottaa", body: "TrimSwipe löysi kuvia, jotka kannattaa tarkistaa." },
    inactivity: { title: "Valmis uuteen alkuun?", body: "Kuvakirjastosi saattaa olla nopean siivouksen tarpeessa." },
    "weekly-progress": { title: "Edisty hieman tällä viikolla", body: "Avaa TrimSwipe lyhyttä siivoushetkeä varten." },
  },
  ms: {
    "low-storage": { title: "Ruang iPhone anda hampir penuh", body: "Sesi TrimSwipe yang pantas boleh mengosongkan ruang." },
    "streak-at-risk": { title: "Teruskan rentak pembersihan anda", body: "Beberapa leretan pantas sudah memadai hari ini." },
    "new-photos": { title: "Gulungan kamera anda bertambah", body: "TrimSwipe boleh membantu mengosongkan sedikit ruang." },
    "cleanup-opportunity": { title: "Pembersihan berguna sedang menanti", body: "TrimSwipe menemui foto yang mungkin anda mahu semak." },
    inactivity: { title: "Sedia untuk bermula semula?", body: "Pustaka foto anda mungkin sedia untuk dikemas kini." },
    "weekly-progress": { title: "Buat sedikit kemajuan minggu ini", body: "Buka TrimSwipe untuk sesi pembersihan ringkas." },
  },
  no: {
    "low-storage": { title: "Det er lite lagringsplass på iPhone", body: "En rask TrimSwipe-økt kan frigjøre plass." },
    "streak-at-risk": { title: "Hold rengjøringsrekken i gang", body: "Noen raske sveip er nok for i dag." },
    "new-photos": { title: "Kamerarullen har vokst", body: "TrimSwipe kan hjelpe deg med å frigjøre litt plass." },
    "cleanup-opportunity": { title: "En nyttig opprydding venter", body: "TrimSwipe fant bilder du kanskje vil gå gjennom." },
    inactivity: { title: "Klar for en ny start?", body: "Bildebiblioteket ditt kan være klart for en rask opprydding." },
    "weekly-progress": { title: "Gjør litt fremgang denne uken", body: "Åpne TrimSwipe for en kort oppryddingsøkt." },
  },
  pl: {
    "low-storage": { title: "Na iPhonie kończy się miejsce", body: "Krótka sesja TrimSwipe może zwolnić trochę miejsca." },
    "streak-at-risk": { title: "Podtrzymaj serię porządkowania", body: "Na dziś wystarczy kilka szybkich przesunięć." },
    "new-photos": { title: "W rolce aparatu przybyło zdjęć", body: "TrimSwipe pomoże zwolnić trochę miejsca." },
    "cleanup-opportunity": { title: "Czeka na Ciebie przydatne czyszczenie", body: "TrimSwipe znalazł zdjęcia, które możesz przejrzeć." },
    inactivity: { title: "Gotowy na nowy początek?", body: "Twoja biblioteka zdjęć może być gotowa na szybkie porządki." },
    "weekly-progress": { title: "Zrób mały postęp w tym tygodniu", body: "Otwórz TrimSwipe na krótką sesję porządkowania." },
  },
  sv: {
    "low-storage": { title: "Det börjar bli ont om lagringsutrymme", body: "En snabb TrimSwipe-session kan frigöra utrymme." },
    "streak-at-risk": { title: "Fortsätt din rensningssvit", body: "Några snabba svep räcker i dag." },
    "new-photos": { title: "Din kamerarulle har vuxit", body: "TrimSwipe kan hjälpa dig att frigöra lite utrymme." },
    "cleanup-opportunity": { title: "En bra rensning väntar", body: "TrimSwipe hittade foton som du kanske vill gå igenom." },
    inactivity: { title: "Redo för en nystart?", body: "Ditt bildbibliotek kanske är redo för en snabb rensning." },
    "weekly-progress": { title: "Gör lite framsteg den här veckan", body: "Öppna TrimSwipe för en kort rensningssession." },
  },
  th: {
    "low-storage": { title: "พื้นที่จัดเก็บข้อมูลใน iPhone ใกล้เต็ม", body: "ใช้ TrimSwipe สักครู่เพื่อเพิ่มพื้นที่ว่างได้" },
    "streak-at-risk": { title: "รักษาสถิติการทำความสะอาดต่อไป", body: "วันนี้ปัดรูปภาพเร็ว ๆ เพียงไม่กี่ครั้งก็พอ" },
    "new-photos": { title: "มีรูปภาพเพิ่มขึ้นในคลังของคุณ", body: "TrimSwipe ช่วยเพิ่มพื้นที่ว่างให้คุณได้" },
    "cleanup-opportunity": { title: "มีการทำความสะอาดรอคุณอยู่", body: "TrimSwipe พบรูปภาพที่คุณอาจต้องการตรวจสอบ" },
    inactivity: { title: "พร้อมเริ่มต้นใหม่หรือยัง", body: "คลังรูปภาพของคุณอาจพร้อมสำหรับการทำความสะอาดอย่างรวดเร็ว" },
    "weekly-progress": { title: "สร้างความคืบหน้าเล็กน้อยในสัปดาห์นี้", body: "เปิด TrimSwipe เพื่อทำความสะอาดสั้น ๆ" },
  },
  uk: {
    "low-storage": { title: "На iPhone закінчується вільне місце", body: "Швидкий сеанс TrimSwipe допоможе звільнити місце." },
    "streak-at-risk": { title: "Продовжуйте серію очищень", body: "Сьогодні достатньо кількох швидких свайпів." },
    "new-photos": { title: "У фотоплівці побільшало знімків", body: "TrimSwipe допоможе звільнити трохи місця." },
    "cleanup-opportunity": { title: "На вас чекає корисне очищення", body: "TrimSwipe знайшов фото, які можна переглянути." },
    inactivity: { title: "Готові почати спочатку?", body: "Ваша медіатека може бути готова до швидкого очищення." },
    "weekly-progress": { title: "Зробіть невеликий прогрес цього тижня", body: "Відкрийте TrimSwipe для короткого очищення." },
  },
  da: {
    "low-storage": { title: "Der er snart ikke mere plads på din iPhone", body: "En hurtig TrimSwipe-session kan frigøre plads." },
    "streak-at-risk": { title: "Fortsæt din oprydningsrække", body: "Et par hurtige swipes er nok i dag." },
    "new-photos": { title: "Din kamerarulle er vokset", body: "TrimSwipe kan hjælpe med at frigøre lidt plads." },
    "cleanup-opportunity": { title: "En nyttig oprydning venter", body: "TrimSwipe fandt billeder, du måske vil gennemgå." },
    inactivity: { title: "Klar til en frisk start?", body: "Dit fotobibliotek er måske klar til en hurtig oprydning." },
    "weekly-progress": { title: "Gør lidt fremskridt i denne uge", body: "Åbn TrimSwipe til en kort oprydningssession." },
  },
  ta: {
    "low-storage": { title: "உங்கள் iPhone சேமிப்பகம் குறைவாக உள்ளது", body: "TrimSwipe-இல் விரைவான அமர்வு இடத்தை விடுவிக்கலாம்." },
    "streak-at-risk": { title: "உங்கள் சுத்தம் செய்யும் தொடரைத் தொடருங்கள்", body: "இன்றைக்கு சில விரைவான ஸ்வைப் போதும்." },
    "new-photos": { title: "உங்கள் கேமரா ரோலில் படங்கள் அதிகரித்துள்ளன", body: "TrimSwipe சிறிது இடத்தை விடுவிக்க உதவும்." },
    "cleanup-opportunity": { title: "பயனுள்ள சுத்தம் காத்திருக்கிறது", body: "நீங்கள் பார்க்க விரும்பக்கூடிய படங்களை TrimSwipe கண்டறிந்தது." },
    inactivity: { title: "புதிய தொடக்கத்திற்குத் தயாரா?", body: "உங்கள் புகைப்பட நூலகம் விரைவான சுத்தத்திற்கு தயாராக இருக்கலாம்." },
    "weekly-progress": { title: "இந்த வாரம் சிறிது முன்னேறுங்கள்", body: "சிறிய சுத்த அமர்வுக்கு TrimSwipe-ஐத் திறக்கவும்." },
  },
};

function normalizedLocale(locale: string | undefined): string {
  const value = typeof locale === "string" ? locale.trim() : "";
  if (SMART[value]) return value;
  const language = value.split("-")[0].toLowerCase();
  if (language === "zh") return value.toLowerCase().includes("hant") ? "zh-Hant" : "zh-Hans";
  if (language === "pt") return "pt-BR";
  return SMART[language] ? language : "en";
}

export function getSmartReminderCopy(locale: string | undefined, trigger: SmartReminderTrigger): ReminderCopy {
  return (SMART[normalizedLocale(locale)] ?? ENGLISH_SMART)[trigger] ?? ENGLISH_SMART[trigger];
}

export function getScheduledReminderCopy(
  locale: string | undefined,
  label: string | undefined,
  targetMB: number | undefined,
): ReminderCopy {
  // A legacy installation can have a due timestamp without a schedule. Reuse
  // the localized cleanup copy rather than displaying a fabricated label.
  if (typeof label !== "string" || !label.trim()) {
    return getSmartReminderCopy(locale, "cleanup-opportunity");
  }
  const language = normalizedLocale(locale);
  const safeLabel = label.trim().slice(0, 64);
  const safeTarget = Number.isFinite(targetMB) ? Math.max(10, Math.round(targetMB as number)) : 50;
  const templates: Record<string, (label: string, mb: number) => ReminderCopy> = {
    en: (name, mb) => ({ title: "Time for a quick cleanup?", body: `${name}: your ${mb} MB cleanup goal is ready.` }),
    "zh-Hans": (name, mb) => ({ title: "该快速清理一下了？", body: `${name}：你的 ${mb} MB 清理目标已准备好。` }),
    "zh-Hant": (name, mb) => ({ title: "該快速清理一下了嗎？", body: `${name}：你的 ${mb} MB 清理目標已準備好。` }),
    es: (name, mb) => ({ title: "¿Hora de una limpieza rápida?", body: `${name}: tu objetivo de limpieza de ${mb} MB está listo.` }),
    hi: (name, mb) => ({ title: "त्वरित क्लीनअप का समय?", body: `${name}: आपका ${mb} MB क्लीनअप लक्ष्य तैयार है।` }),
    ar: (name, mb) => ({ title: "حان وقت لتنظيف سريع؟", body: `${name}: هدف التنظيف البالغ ${mb} ميغابايت جاهز.` }),
    "pt-BR": (name, mb) => ({ title: "Hora de uma limpeza rápida?", body: `${name}: sua meta de limpeza de ${mb} MB está pronta.` }),
    fr: (name, mb) => ({ title: "Une petite séance de nettoyage ?", body: `${name} : votre objectif de nettoyage de ${mb} Mo est prêt.` }),
    de: (name, mb) => ({ title: "Zeit für eine schnelle Bereinigung?", body: `${name}: Dein ${mb}-MB-Bereinigungsziel ist bereit.` }),
    ja: (name, mb) => ({ title: "すばやく整理しませんか？", body: `${name}：${mb} MBの整理目標の準備ができました。` }),
    ko: (name, mb) => ({ title: "빠르게 정리할 시간인가요?", body: `${name}: ${mb}MB 정리 목표가 준비됐어요.` }),
    ru: (name, mb) => ({ title: "Время для быстрой уборки?", body: `${name}: цель очистки на ${mb} МБ готова.` }),
    id: (name, mb) => ({ title: "Saatnya membersihkan dengan cepat?", body: `${name}: target pembersihan ${mb} MB Anda siap.` }),
    tr: (name, mb) => ({ title: "Hızlı bir temizlik zamanı mı?", body: `${name}: ${mb} MB temizlik hedefiniz hazır.` }),
    it: (name, mb) => ({ title: "È ora di una pulizia rapida?", body: `${name}: il tuo obiettivo di pulizia di ${mb} MB è pronto.` }),
    vi: (name, mb) => ({ title: "Đã đến lúc dọn dẹp nhanh?", body: `${name}: mục tiêu dọn dẹp ${mb} MB của bạn đã sẵn sàng.` }),
    cs: (name, mb) => ({ title: "Čas na rychlé čištění?", body: `${name}: váš cíl čištění ${mb} MB je připraven.` }),
    nl: (name, mb) => ({ title: "Tijd voor een snelle opruimbeurt?", body: `${name}: je opruimdoel van ${mb} MB staat klaar.` }),
    fi: (name, mb) => ({ title: "Nopean siivouksen aika?", body: `${name}: ${mb} Mt:n siivoustavoitteesi on valmis.` }),
    ms: (name, mb) => ({ title: "Masa untuk pembersihan pantas?", body: `${name}: sasaran pembersihan ${mb} MB anda sudah sedia.` }),
    no: (name, mb) => ({ title: "Tid for en rask opprydding?", body: `${name}: Rengjøringsmålet på ${mb} MB er klart.` }),
    pl: (name, mb) => ({ title: "Czas na szybkie porządki?", body: `${name}: cel czyszczenia ${mb} MB jest gotowy.` }),
    sv: (name, mb) => ({ title: "Dags för en snabb rensning?", body: `${name}: ditt rensningsmål på ${mb} MB är redo.` }),
    th: (name, mb) => ({ title: "ถึงเวลาทำความสะอาดอย่างรวดเร็วหรือยัง", body: `${name}: เป้าหมายการทำความสะอาด ${mb} MB ของคุณพร้อมแล้ว` }),
    uk: (name, mb) => ({ title: "Час швидко прибрати?", body: `${name}: ваша ціль очищення ${mb} МБ готова.` }),
    da: (name, mb) => ({ title: "Tid til en hurtig oprydning?", body: `${name}: Dit oprydningsmål på ${mb} MB er klar.` }),
    ta: (name, mb) => ({ title: "விரைவான சுத்தம் செய்யும் நேரமா?", body: `${name}: உங்கள் ${mb} MB சுத்த இலக்கு தயாராக உள்ளது.` }),
  };
  return (templates[language] ?? templates.en)(safeLabel, safeTarget);
}
