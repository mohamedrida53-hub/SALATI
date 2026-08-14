/* =========================================================
   Traducciones de SALATI — catalán, castellano, inglés y árabe.

   Uso:
     t('tab.qibla')                    → texto suelto
     t('tasbih.of', { n: 33 })         → con variables {n}
     applyStatic()                     → recorre data-i18n del DOM
     onLangChange(fn)                  → repintar al cambiar de idioma

   El árabe se muestra de momento en LTR: la app no tiene aún la hoja
   de estilos invertida. Los textos árabes sí llevan su propia fuente.
   ========================================================= */

import { STORAGE_KEYS } from './config.js';

/* Leemos y escribimos localStorage aquí mismo en vez de tirar de utils.js:
   utils.js necesita i18n para la rosa de los vientos y las fechas, y así
   evitamos un import circular entre los dos módulos. */
const readLang = () => { try { return localStorage.getItem(STORAGE_KEYS.lang); } catch { return null; } };
const writeLang = (v) => { try { localStorage.setItem(STORAGE_KEYS.lang, v); } catch { /* modo privado */ } };

export const LANGS = [
  { code: 'ca', name: 'Català',   locale: 'ca-ES', flag: 'flag-ca', dir: 'ltr' },
  { code: 'es', name: 'Castellano', locale: 'es-ES', flag: 'flag-es', dir: 'ltr' },
  { code: 'en', name: 'English',  locale: 'en-GB', flag: 'flag-gb', dir: 'ltr' },
  { code: 'ar', name: 'العربية',   locale: 'ar',    flag: 'flag-sa', dir: 'ltr' },
];

export const DEFAULT_LANG = 'es';

const STRINGS = {
  /* ---------------- Cabecera y navegación ---------------- */
  'app.locSearching': {
    ca: 'Cercant ubicació…', es: 'Buscando ubicación…',
    en: 'Finding your location…', ar: 'جارٍ تحديد الموقع…',
  },
  'app.locChoose': {
    ca: 'Tria una ubicació', es: 'Elegir ubicación',
    en: 'Choose a location', ar: 'اختر موقعًا',
  },
  'app.langLabel': { ca: 'Idioma', es: 'Idioma', en: 'Language', ar: 'اللغة' },

  /* ---------------- Diálogo de ubicación ---------------- */
  'loc.title': { ca: 'Tria una ubicació', es: 'Elegir ubicación', en: 'Choose a location', ar: 'اختر موقعًا' },
  'loc.lede': {
    ca: 'Escriu una ciutat i país, o fes servir el GPS del dispositiu.',
    es: 'Escribe una ciudad y país, o usa el GPS del dispositivo.',
    en: 'Type a city and country, or use your device’s GPS.',
    ar: 'اكتب مدينة وبلدًا، أو استخدم نظام تحديد المواقع في جهازك.',
  },
  'loc.city': { ca: 'Ciutat', es: 'Ciudad', en: 'City', ar: 'المدينة' },
  'loc.useGps': { ca: 'Fes servir el GPS', es: 'Usar mi GPS', en: 'Use my GPS', ar: 'استخدم GPS' },
  'loc.search': { ca: 'Cerca la ciutat', es: 'Buscar ciudad', en: 'Search city', ar: 'ابحث عن المدينة' },
  'loc.use': { ca: 'Fes servir aquesta ciutat', es: 'Usar esta ciudad', en: 'Use this city', ar: 'استخدم هذه المدينة' },
  'loc.results': { ca: 'Ciutats trobades', es: 'Ciudades encontradas', en: 'Cities found', ar: 'المدن الموجودة' },
  'loc.typeMore': {
    ca: 'Escriu almenys 3 lletres…', es: 'Escribe al menos 3 letras…',
    en: 'Type at least 3 letters…', ar: 'اكتب 3 أحرف على الأقل…',
  },
  'loc.searching': { ca: 'Cercant…', es: 'Buscando…', en: 'Searching…', ar: 'جارٍ البحث…' },
  'loc.pickOne': {
    ca: 'Tria una ciutat de la llista perquè els horaris siguin exactes.',
    es: 'Elige una ciudad de la lista para que los horarios sean exactos.',
    en: 'Pick a city from the list so the times are accurate.',
    ar: 'اختر مدينة من القائمة لتكون المواقيت دقيقة.',
  },
  'loc.noMatches': {
    ca: 'Cap resultat. Prova amb el nom en l’idioma local.',
    es: 'Sin resultados. Prueba con el nombre en el idioma local.',
    en: 'No matches. Try the name in the local language.',
    ar: 'لا نتائج. جرّب الاسم باللغة المحلية.',
  },
  'loc.close': { ca: 'Tanca', es: 'Cerrar', en: 'Close', ar: 'إغلاق' },
  'loc.denied': {
    ca: 'Has denegat l’accés a la teva ubicació. Pots cercar la ciutat a mà.',
    es: 'Has denegado el acceso a tu ubicación. Puedes buscar tu ciudad a mano.',
    en: 'You denied access to your location. You can search for your city instead.',
    ar: 'لقد رفضت الوصول إلى موقعك. يمكنك البحث عن مدينتك يدويًا.',
  },
  'loc.unavailable': {
    ca: 'No s’ha pogut determinar la teva posició. Prova de cercar la ciutat.',
    es: 'No se ha podido determinar tu posición. Prueba a buscar tu ciudad.',
    en: 'Your position could not be determined. Try searching for your city.',
    ar: 'تعذّر تحديد موقعك. جرّب البحث عن مدينتك.',
  },
  'loc.timeout': {
    ca: 'La cerca d’ubicació ha trigat massa. Prova de cercar la ciutat.',
    es: 'La búsqueda de ubicación ha tardado demasiado. Prueba a buscar tu ciudad.',
    en: 'Finding your location took too long. Try searching for your city.',
    ar: 'استغرق تحديد الموقع وقتًا طويلاً. جرّب البحث عن مدينتك.',
  },
  'loc.noSecure': {
    ca: 'Aquest navegador no et pot geolocalitzar (cal HTTPS). Cerca la ciutat a mà.',
    es: 'Este navegador no puede geolocalizarte (hace falta HTTPS). Busca tu ciudad a mano.',
    en: 'This browser cannot locate you (HTTPS is required). Search for your city instead.',
    ar: 'لا يمكن لهذا المتصفح تحديد موقعك (يتطلب HTTPS). ابحث عن مدينتك يدويًا.',
  },
  'loc.noGeo': {
    ca: 'Aquest navegador no ofereix geolocalització.',
    es: 'Este navegador no ofrece geolocalización.',
    en: 'This browser does not provide geolocation.',
    ar: 'هذا المتصفح لا يوفر تحديد الموقع.',
  },
  'loc.generic': {
    ca: 'No s’ha pogut obtenir la teva ubicació.',
    es: 'No se ha podido obtener tu ubicación.',
    en: 'Your location could not be obtained.',
    ar: 'تعذّر الحصول على موقعك.',
  },

  /* ---------------- Estados de carga y error ---------------- */
  'state.loadingTimes': { ca: 'Carregant horaris', es: 'Cargando horarios', en: 'Loading times', ar: 'جارٍ تحميل المواقيت' },
  'state.loadingTimesMsg': {
    ca: 'Consultant l’API d’Aladhan…', es: 'Consultando la API de Aladhan…',
    en: 'Querying the Aladhan API…', ar: 'جارٍ الاستعلام من واجهة Aladhan…',
  },
  'state.pickCity': { ca: 'Tria la teva ciutat', es: 'Elige tu ciudad', en: 'Choose your city', ar: 'اختر مدينتك' },
  'state.needLocation': { ca: 'Tria una ubicació', es: 'Elige una ubicación', en: 'Choose a location', ar: 'اختر موقعًا' },
  'state.needLocationMsg': {
    ca: 'Els horaris depenen de les teves coordenades.',
    es: 'Los horarios dependen de tus coordenadas.',
    en: 'Prayer times depend on your coordinates.',
    ar: 'تعتمد المواقيت على إحداثياتك.',
  },
  'state.timesFailed': {
    ca: 'No s’han pogut carregar els horaris.',
    es: 'No se han podido cargar los horarios.',
    en: 'Prayer times could not be loaded.',
    ar: 'تعذّر تحميل المواقيت.',
  },
  'state.retry': { ca: 'Torna-ho a provar', es: 'Reintentar', en: 'Try again', ar: 'إعادة المحاولة' },
  'state.offlineCached': {
    ca: 'Sense connexió: es mostren els horaris desats d’avui.',
    es: 'Sin conexión: mostrando los horarios guardados de hoy.',
    en: 'Offline: showing today’s saved times.',
    ar: 'دون اتصال: تُعرض مواقيت اليوم المحفوظة.',
  },
  'state.offlineGeneric': {
    ca: 'Sense connexió: es mostren les últimes dades desades.',
    es: 'Sin conexión: se muestran los últimos datos guardados.',
    en: 'Offline: showing the last saved data.',
    ar: 'دون اتصال: تُعرض آخر البيانات المحفوظة.',
  },
  'state.installed': { ca: 'SALATI instal·lada.', es: 'SALATI instalada.', en: 'SALATI installed.', ar: 'تم تثبيت صلاتي.' },
  'state.newVersion': {
    ca: 'Nova versió a punt: recarrega per aplicar-la.',
    es: 'Nueva versión lista: recarga para aplicarla.',
    en: 'New version ready: reload to apply it.',
    ar: 'إصدار جديد جاهز: أعد التحميل لتطبيقه.',
  },
  'state.alertsOff': { ca: 'Avisos desactivats.', es: 'Avisos desactivados.', en: 'Alerts turned off.', ar: 'تم إيقاف التنبيهات.' },
  'state.alertsOn': {
    ca: '{on}: {n} resos avui, amb l’app oberta.',
    es: '{on}: {n} rezos hoy, con la app abierta.',
    en: '{on}: {n} prayers today, while the app is open.',
    ar: '{on}: {n} صلوات اليوم، والتطبيق مفتوح.',
  },
  'state.alertsOnNext': {
    ca: '{on}: des del pròxim Fajr, amb l’app oberta.',
    es: '{on}: desde el próximo Fajr, con la app abierta.',
    en: '{on}: from the next Fajr, while the app is open.',
    ar: '{on}: من الفجر القادم، والتطبيق مفتوح.',
  },

  /* ---------------- Corán ---------------- */
  'quran.loading': { ca: 'Carregant sures', es: 'Cargando suras', en: 'Loading surahs', ar: 'جارٍ تحميل السور' },
  'quran.loadingMsg': {
    ca: 'Consultant l’API de Quran.com…', es: 'Consultando la API de Quran.com…',
    en: 'Querying the Quran.com API…', ar: 'جارٍ الاستعلام من واجهة Quran.com…',
  },
  'quran.failed': {
    ca: 'No s’han pogut carregar les sures',
    es: 'No se han podido cargar las suras',
    en: 'Surahs could not be loaded', ar: 'تعذّر تحميل السور',
  },
  'quran.noResults': { ca: 'Sense resultats', es: 'Sin resultados', en: 'No results', ar: 'لا توجد نتائج' },
  'quran.noResultsMsg': {
    ca: 'Cap sura coincideix amb «{q}».', es: 'Ninguna sura coincide con «{q}».',
    en: 'No surah matches “{q}”.', ar: 'لا توجد سورة تطابق «{q}».',
  },
  'quran.loadingVerses': { ca: 'Carregant versos', es: 'Cargando versos', en: 'Loading verses', ar: 'جارٍ تحميل الآيات' },
  'quran.versesFailed': {
    ca: 'No s’han pogut carregar els versos',
    es: 'No se han podido cargar los versos',
    en: 'Verses could not be loaded', ar: 'تعذّر تحميل الآيات',
  },
  'quran.back': { ca: 'Sures', es: 'Suras', en: 'Surahs', ar: 'السور' },
  'quran.verses': { ca: '{n} versets', es: '{n} versos', en: '{n} verses', ar: '{n} آيات' },
  'quran.makkah': { ca: 'la Meca', es: 'La Meca', en: 'Mecca', ar: 'مكية' },
  'quran.madinah': { ca: 'Medina', es: 'Medina', en: 'Medina', ar: 'مدنية' },
  'app.sections': { ca: 'Seccions', es: 'Secciones', en: 'Sections', ar: 'الأقسام' },

  /* ---------------- Panel de configuración ---------------- */
  'cfg.open':  { ca: 'Configuració', es: 'Configuración', en: 'Settings', ar: 'الإعدادات' },
  'cfg.title': { ca: 'Configuració', es: 'Configuración', en: 'Settings', ar: 'الإعدادات' },
  'cfg.close': { ca: 'Tanca', es: 'Cerrar', en: 'Close', ar: 'إغلاق' },
  /* ---------------- Instalación manual en iOS ---------------- */
  'ios.title': {
    ca: 'Instal·la-la al teu iPhone', es: 'Instalar en tu iPhone',
    en: 'Install on your iPhone', ar: 'التثبيت على iPhone',
  },
  'ios.lede': {
    ca: 'Safari no ofereix un botó d’instal·lació, però en tres passos tindràs SALATI a la pantalla d’inici, com qualsevol altra app.',
    es: 'Safari no ofrece un botón de instalación, pero en tres pasos tendrás SALATI en tu pantalla de inicio, como cualquier otra app.',
    en: 'Safari has no install button, but three steps will put SALATI on your home screen, just like any other app.',
    ar: 'لا يوفر Safari زر تثبيت، لكن ثلاث خطوات تضع صلاتي على شاشتك الرئيسية كأي تطبيق آخر.',
  },
  'ios.step1': {
    ca: 'Prem el botó de Compartir a la barra inferior: un quadrat amb una fletxa cap amunt.',
    es: 'Pulsa el botón de Compartir en la barra inferior: un cuadrado con una flecha hacia arriba.',
    en: 'Tap the Share button in the bottom bar: a square with an arrow pointing up.',
    ar: 'اضغط زر المشاركة في الشريط السفلي: مربع بسهم متجه للأعلى.',
  },
  'ios.step2': {
    ca: 'Baixa per la llista i tria «Afegir a pantalla d’inici».',
    es: 'Desplázate por la lista y elige «Añadir a pantalla de inicio».',
    en: 'Scroll the list and choose “Add to Home Screen”.',
    ar: 'مرّر القائمة واختر «إضافة إلى الشاشة الرئيسية».',
  },
  'ios.step3': {
    ca: 'Confirma amb «Afegir». Ja la pots obrir des de la icona, a pantalla completa.',
    es: 'Confirma con «Añadir». Ya puedes abrirla desde el icono, a pantalla completa.',
    en: 'Confirm with “Add”. You can now open it from the icon, full screen.',
    ar: 'أكّد بالضغط على «إضافة». يمكنك الآن فتحه من الأيقونة بملء الشاشة.',
  },
  'ios.safariOnly': {
    ca: 'Aquesta opció només existeix a Safari. Si fas servir Chrome o Firefox a l’iPhone, obre aquesta pàgina amb Safari.',
    es: 'Esta opción solo existe en Safari. Si usas Chrome o Firefox en el iPhone, abre esta página con Safari.',
    en: 'This option only exists in Safari. If you use Chrome or Firefox on iPhone, open this page in Safari.',
    ar: 'هذا الخيار متاح في Safari فقط. إذا كنت تستخدم Chrome أو Firefox على iPhone، افتح هذه الصفحة في Safari.',
  },

  'cfg.donate': {
    ca: 'Dona suport al projecte',
    es: 'Apoyar el proyecto',
    en: 'Support the project',
    ar: 'ادعم المشروع',
  },
  'cfg.feedback': {
    ca: 'Suggeriments o report d’errors',
    es: 'Sugerencias o reporte de errores',
    en: 'Suggestions or bug reports',
    ar: 'اقتراحات أو الإبلاغ عن أخطاء',
  },
  'cfg.theme': { ca: 'Aparença', es: 'Apariencia', en: 'Appearance', ar: 'المظهر' },
  'cfg.themeHelp': {
    ca: 'Tria el mode clar o fosc. Amb «Sistema» s’adapta sola a la configuració del teu dispositiu.',
    es: 'Elige el modo claro u oscuro. Con «Sistema» se adapta sola a la configuración de tu dispositivo.',
    en: 'Choose light or dark mode. With “System” it follows your device settings automatically.',
    ar: 'اختر الوضع الفاتح أو الداكن. مع «النظام» يتبع إعدادات جهازك تلقائيًا.',
  },
  'cfg.themeAuto':  { ca: 'Sistema', es: 'Sistema', en: 'System', ar: 'النظام' },
  'cfg.themeLight': { ca: 'Clar', es: 'Claro', en: 'Light', ar: 'فاتح' },
  'cfg.themeDark':  { ca: 'Fosc', es: 'Oscuro', en: 'Dark', ar: 'داكن' },

  'cfg.adhanHelp': {
    ca: 'Activa aquesta opció perquè l’aplicació reprodueixi automàticament la crida a l’oració quan arribi l’hora exacta de cada res.',
    es: 'Activa esta opción para que la aplicación reproduzca automáticamente la llamada a la oración cuando sea la hora exacta de cada rezo.',
    en: 'Turn this on and the app will automatically play the call to prayer at the exact time of each prayer.',
    ar: 'فعّل هذا الخيار ليشغّل التطبيق الأذان تلقائيًا عند حلول وقت كل صلاة.',
  },
  'cfg.notifyHelp': {
    ca: 'Rep un avís del sistema a l’hora de cada res, sense so. Útil si tens el mòbil en silenci o no vols que soni l’adhan.',
    es: 'Recibe un aviso del sistema a la hora de cada rezo, sin sonido. Útil si tienes el móvil en silencio o no quieres que suene el adhan.',
    en: 'Get a silent system notification at each prayer time. Useful if your phone is on mute or you would rather not hear the adhan.',
    ar: 'استلم إشعارًا صامتًا من النظام عند وقت كل صلاة. مفيد إذا كان هاتفك صامتًا أو لا ترغب بسماع الأذان.',
  },
  'cfg.testHelp': {
    ca: 'Escolta l’adhan ara mateix per comprovar el volum. En prémer també s’autoritza el navegador a reproduir so més tard.',
    es: 'Escucha el adhan ahora mismo para comprobar el volumen. Al pulsar también se autoriza al navegador a reproducir sonido más tarde.',
    en: 'Play the adhan right now to check the volume. Pressing it also allows the browser to play sound later on.',
    ar: 'استمع إلى الأذان الآن للتحقق من مستوى الصوت. الضغط يسمح أيضًا للمتصفح بتشغيل الصوت لاحقًا.',
  },

  'tab.prayer':  { ca: 'Resos',    es: 'Rezos',    en: 'Prayers',  ar: 'الصلوات' },
  'tab.qibla':   { ca: 'Qibla',    es: 'Qibla',    en: 'Qibla',    ar: 'القبلة' },
  'tab.quran':   { ca: 'Alcorà',   es: 'Corán',    en: 'Quran',    ar: 'القرآن' },
  'tab.tasbih':  { ca: 'Tasbih',   es: 'Tasbih',   en: 'Tasbih',   ar: 'التسبيح' },
  'tab.mosques': { ca: 'Mesquites', es: 'Mezquitas', en: 'Mosques', ar: 'المساجد' },
  'tab.calendar': { ca: 'Calendari', es: 'Calendario', en: 'Calendar', ar: 'التقويم' },

  /* ---------------- Calendario ---------------- */
  'cal.prev':  { ca: 'Mes anterior', es: 'Mes anterior', en: 'Previous month', ar: 'الشهر السابق' },
  'cal.next':  { ca: 'Mes següent', es: 'Mes siguiente', en: 'Next month', ar: 'الشهر التالي' },
  'cal.today': { ca: 'Avui', es: 'Hoy', en: 'Today', ar: 'اليوم' },
  'cal.gridLabel': { ca: 'Dies del mes', es: 'Días del mes', en: 'Days of the month', ar: 'أيام الشهر' },
  'cal.legendFeast': { ca: 'Festivitat', es: 'Festividad', en: 'Feast', ar: 'عيد' },
  'cal.unsupported': {
    ca: 'El teu navegador no pot convertir dates hijri.',
    es: 'Tu navegador no puede convertir fechas hijri.',
    en: 'Your browser cannot convert Hijri dates.',
    ar: 'متصفحك لا يستطيع تحويل التواريخ الهجرية.',
  },
  'cal.legendDay': { ca: 'Dia important', es: 'Día importante', en: 'Important day', ar: 'يوم مهم' },

  'cal.newYear': {
    ca: 'Cap d’Any islàmic', es: 'Año Nuevo islámico',
    en: 'Islamic New Year', ar: 'رأس السنة الهجرية',
  },
  'cal.ashura':  { ca: 'Aixura', es: 'Ashura', en: 'Ashura', ar: 'عاشوراء' },
  'cal.ramadan': {
    ca: 'Inici del Ramadà', es: 'Inicio del Ramadán',
    en: 'Start of Ramadan', ar: 'بداية رمضان',
  },
  'cal.eidFitr': { ca: 'Eid al-Fitr', es: 'Eid al-Fitr', en: 'Eid al-Fitr', ar: 'عيد الفطر' },
  'cal.arafat':  { ca: 'Dia d’Arafat', es: 'Día de Arafat', en: 'Day of Arafah', ar: 'يوم عرفة' },
  'cal.eidAdha': { ca: 'Eid al-Adha', es: 'Eid al-Adha', en: 'Eid al-Adha', ar: 'عيد الأضحى' },

  /* ---------------- Rezos ---------------- */
  'prayer.next':      { ca: 'Pròxim res', es: 'Próximo rezo', en: 'Next prayer', ar: 'الصلاة القادمة' },
  'prayer.todayAt':   { ca: 'Avui a les {time}', es: 'Hoy a las {time}', en: 'Today at {time}', ar: 'اليوم في {time}' },
  'prayer.tomorrowAt': { ca: 'Demà a les {time}', es: 'Mañana a las {time}', en: 'Tomorrow at {time}', ar: 'غدًا في {time}' },
  'prayer.timesLabel': { ca: 'Horaris d’avui', es: 'Horarios de hoy', en: 'Today’s times', ar: 'مواقيت اليوم' },
  'prayer.adhanToggle': { ca: 'Adhan', es: 'Adhan', en: 'Adhan', ar: 'الأذان' },
  'prayer.notifyToggle': { ca: 'Notificacions', es: 'Notificaciones', en: 'Notifications', ar: 'الإشعارات' },
  'prayer.adhanAria': {
    ca: 'Fes sonar l’adhan a l’hora de cada res',
    es: 'Hacer sonar el adhan a la hora de cada rezo',
    en: 'Play the adhan at each prayer time',
    ar: 'تشغيل الأذان عند وقت كل صلاة',
  },
  'prayer.notifyAria': {
    ca: 'Rep una notificació a l’hora de cada res',
    es: 'Recibir una notificación a la hora de cada rezo',
    en: 'Get a notification at each prayer time',
    ar: 'تلقّي إشعار عند وقت كل صلاة',
  },
  'prayer.testTitle': { ca: 'Prova l’adhan', es: 'Probar adhan', en: 'Test adhan', ar: 'اختبار الأذان' },
  'prayer.testBtn': { ca: 'Escoltar', es: 'Escuchar', en: 'Play', ar: 'استمع' },
  'prayer.installTitle': { ca: 'Instal·la SALATI', es: 'Instalar SALATI', en: 'Install SALATI', ar: 'تثبيت صلاتي' },
  'prayer.installBtn': { ca: 'Instal·lar', es: 'Instalar', en: 'Install', ar: 'تثبيت' },
  'prayer.metaMethod': { ca: 'Mètode: {name}.', es: 'Método: {name}.', en: 'Method: {name}.', ar: 'الطريقة: {name}.' },
  'prayer.metaZone': { ca: 'Hores a {zone}.', es: 'Horas en {zone}.', en: 'Times in {zone}.', ar: 'التوقيت في {zone}.' },

  'notify.iosNeedsInstall': {
    ca: 'A l’iPhone els avisos només funcionen amb l’app instal·lada a la pantalla d’inici. Fes-ho des de «Instal·lar SALATI».',
    es: 'En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio. Hazlo desde «Instalar SALATI».',
    en: 'On iPhone, alerts only work when the app is installed on the home screen. Use “Install SALATI” first.',
    ar: 'على iPhone تعمل التنبيهات فقط عند تثبيت التطبيق على الشاشة الرئيسية. استخدم «تثبيت صلاتي» أولاً.',
  },
  'notify.body': {
    ca: 'És l’hora del {name} ({time})', es: 'Es la hora de {name} ({time})',
    en: 'It’s time for {name} ({time})', ar: 'حان وقت {name} ({time})',
  },

  /* ---------------- Qibla ---------------- */
  'qibla.enable': { ca: 'Activa la brúixola', es: 'Activar brújula', en: 'Enable compass', ar: 'تفعيل البوصلة' },
  'qibla.factBearing': { ca: 'Direcció de la Qibla', es: 'Dirección de la Qibla', en: 'Qibla direction', ar: 'اتجاه القبلة' },
  'qibla.factDistance': { ca: 'Distància', es: 'Distancia', en: 'Distance', ar: 'المسافة' },
  'qibla.factPlace': { ca: 'La teva ubicació', es: 'Tu ubicación', en: 'Your location', ar: 'موقعك' },
  'qibla.hintTurn': {
    ca: 'Aguanta el mòbil horitzontal i gira fins que la Kaaba quedi a dalt.',
    es: 'Sostén el móvil en horizontal y gira hasta que la Kaaba quede arriba.',
    en: 'Hold the phone flat and turn until the Kaaba is at the top.',
    ar: 'أمسك الهاتف أفقيًا ودر حتى تصبح الكعبة في الأعلى.',
  },
  'qibla.hintAligned': {
    ca: 'Ja estàs mirant cap a la Meca.',
    es: 'Ya estás mirando hacia La Meca.',
    en: 'You are now facing Mecca.',
    ar: 'أنت الآن تتجه نحو مكة.',
  },
  'qibla.hintFlat': {
    ca: 'Mantén el telèfon pla per a més precisió.',
    es: 'Mantén el teléfono plano para mayor precisión.',
    en: 'Keep the phone flat for better accuracy.',
    ar: 'أبقِ الهاتف مسطحًا للحصول على دقة أفضل.',
  },
  'qibla.hintPermission': {
    ca: 'El teu dispositiu demana permís per als sensors d’orientació.',
    es: 'Tu dispositivo pide permiso para usar los sensores de orientación.',
    en: 'Your device needs permission to use the orientation sensors.',
    ar: 'يطلب جهازك الإذن لاستخدام مستشعرات الاتجاه.',
  },
  'qibla.hintNoCompass': {
    ca: 'El teu dispositiu no permet girar la brúixola. Orienta’t buscant el {dir} ({deg}°).',
    es: 'Tu dispositivo no permite girar la brújula. Oriéntate buscando el {dir} ({deg}°).',
    en: 'Your device cannot rotate the compass. Face {dir} ({deg}°) instead.',
    ar: 'جهازك لا يستطيع تدوير البوصلة. اتجه نحو {dir} ({deg}°).',
  },
  'qibla.noLocTitle': { ca: 'Falta la teva ubicació', es: 'Falta tu ubicación', en: 'Location missing', ar: 'الموقع غير محدد' },
  'qibla.noLocMsg': {
    ca: 'La direcció de la Qibla es calcula a partir de les teves coordenades.',
    es: 'La dirección de la Qibla se calcula desde tus coordenadas.',
    en: 'The Qibla direction is calculated from your coordinates.',
    ar: 'يُحسب اتجاه القبلة من إحداثياتك.',
  },
  'qibla.noLocAction': { ca: 'Tria una ubicació', es: 'Elegir ubicación', en: 'Choose a location', ar: 'اختر موقعًا' },

  /* ---------------- Tasbih ---------------- */
  'tasbih.targets': { ca: 'Meta de la ronda', es: 'Meta de la ronda', en: 'Round target', ar: 'هدف الجولة' },
  'tasbih.of': { ca: 'de {n}', es: 'de {n}', en: 'of {n}', ar: 'من {n}' },
  'tasbih.free': { ca: 'sense límit', es: 'sin límite', en: 'no limit', ar: 'بلا حد' },
  'tasbih.roundsOne': { ca: '1 ronda completada', es: '1 ronda completada', en: '1 round completed', ar: 'جولة واحدة مكتملة' },
  'tasbih.roundsMany': { ca: '{n} rondes completades', es: '{n} rondas completadas', en: '{n} rounds completed', ar: '{n} جولات مكتملة' },
  'tasbih.undo': { ca: 'Desfés', es: 'Deshacer', en: 'Undo', ar: 'تراجع' },
  'tasbih.undoAria': { ca: 'Desfés l’últim compte', es: 'Deshacer la última cuenta', en: 'Undo the last count', ar: 'التراجع عن العد الأخير' },
  'tasbih.reset': { ca: 'Reinicia', es: 'Reiniciar', en: 'Reset', ar: 'إعادة' },
  'tasbih.resetAria': { ca: 'Reinicia el comptador', es: 'Reiniciar el contador', en: 'Reset the counter', ar: 'إعادة ضبط العداد' },
  'tasbih.resetDone': { ca: 'Comptador a zero.', es: 'Contador a cero.', en: 'Counter reset to zero.', ar: 'تمت إعادة العداد إلى الصفر.' },
  'tasbih.padAria': {
    ca: 'Comptador de tasbih: {count}{of}. Prem per comptar.',
    es: 'Contador de tasbih: {count}{of}. Pulsa para contar.',
    en: 'Tasbih counter: {count}{of}. Tap to count.',
    ar: 'عداد التسبيح: {count}{of}. اضغط للعد.',
  },

  /* ---------------- Mezquitas ---------------- */
  'mosques.title': { ca: 'Mesquites a prop', es: 'Mezquitas cercanas', en: 'Nearby mosques', ar: 'المساجد القريبة' },
  'mosques.searching': { ca: 'Cercant mesquites…', es: 'Buscando mezquitas…', en: 'Searching for mosques…', ar: 'جارٍ البحث عن المساجد…' },
  'mosques.none': {
    ca: 'No s’ha trobat cap mesquita en {km} km.',
    es: 'No se ha encontrado ninguna mezquita en {km} km.',
    en: 'No mosques found within {km} km.',
    ar: 'لم يُعثر على مساجد ضمن {km} كم.',
  },
  'mosques.found': {
    ca: '{n} mesquites en {km} km.', es: '{n} mezquitas en {km} km.',
    en: '{n} mosques within {km} km.', ar: '{n} مسجدًا ضمن {km} كم.',
  },
  'mosques.errorTitle': { ca: 'No s’han pogut carregar', es: 'No se han podido cargar', en: 'Could not load', ar: 'تعذّر التحميل' },
  'mosques.errorMsg': {
    ca: 'El servei de mapes no respon. Torna-ho a provar d’aquí a una estona.',
    es: 'El servicio de mapas no responde. Vuelve a intentarlo en un momento.',
    en: 'The map service is not responding. Try again in a moment.',
    ar: 'خدمة الخرائط لا تستجيب. حاول مرة أخرى بعد قليل.',
  },
  'mosques.errorSlow': {
    ca: 'El servei de mapes ha trigat massa. Prova amb un radi més petit.',
    es: 'El servicio de mapas ha tardado demasiado. Prueba con un radio más pequeño.',
    en: 'The map service took too long. Try a smaller radius.',
    ar: 'استغرقت خدمة الخرائط وقتًا طويلاً. جرّب نطاقًا أصغر.',
  },
  'mosques.retry': { ca: 'Torna-ho a provar', es: 'Reintentar', en: 'Try again', ar: 'إعادة المحاولة' },
  'mosques.noLocTitle': { ca: 'Falta la teva ubicació', es: 'Falta tu ubicación', en: 'Location missing', ar: 'الموقع غير محدد' },
  'mosques.noLocMsg': {
    ca: 'Necessitem les teves coordenades per trobar mesquites a prop.',
    es: 'Necesitamos tus coordenadas para encontrar mezquitas cerca.',
    en: 'We need your coordinates to find nearby mosques.',
    ar: 'نحتاج إحداثياتك للعثور على المساجد القريبة.',
  },
  'mosques.you': { ca: 'Ets aquí', es: 'Estás aquí', en: 'You are here', ar: 'أنت هنا' },
  'mosques.unnamed': { ca: 'Mesquita sense nom', es: 'Mezquita sin nombre', en: 'Unnamed mosque', ar: 'مسجد بدون اسم' },
  'mosques.directions': { ca: 'Com arribar-hi', es: 'Cómo llegar', en: 'Directions', ar: 'الاتجاهات' },
  'mosques.radius': { ca: 'Radi de cerca', es: 'Radio de búsqueda', en: 'Search radius', ar: 'نطاق البحث' },
  'mosques.recenter': { ca: 'Centra el mapa', es: 'Centrar el mapa', en: 'Recentre the map', ar: 'توسيط الخريطة' },
  'mosques.listLabel': { ca: 'Mesquites trobades', es: 'Mezquitas encontradas', en: 'Mosques found', ar: 'المساجد المعثور عليها' },
};

/* Nombres de los rezos. La clave `sub` es la aclaración pequeña de la lista. */
export const PRAYER_NAMES = {
  Fajr:    { ca: 'Fajr', es: 'Fajr', en: 'Fajr', ar: 'الفجر' },
  Sunrise: { ca: 'Sortida del sol', es: 'Amanecer', en: 'Sunrise', ar: 'الشروق' },
  Dhuhr:   { ca: 'Dhuhr', es: 'Dhuhr', en: 'Dhuhr', ar: 'الظهر' },
  Asr:     { ca: 'Asr', es: 'Asr', en: 'Asr', ar: 'العصر' },
  Maghrib: { ca: 'Maghrib', es: 'Maghrib', en: 'Maghrib', ar: 'المغرب' },
  Isha:    { ca: 'Isha', es: 'Isha', en: 'Isha', ar: 'العشاء' },
};

export const PRAYER_SUBS = {
  Fajr:    { ca: 'Abans de l’alba', es: 'Antes del amanecer', en: 'Before dawn', ar: 'قبل الفجر' },
  Sunrise: { ca: 'Fi del temps de Fajr', es: 'Fin del tiempo de Fajr', en: 'End of Fajr time', ar: 'نهاية وقت الفجر' },
  Dhuhr:   { ca: 'Migdia', es: 'Mediodía', en: 'Midday', ar: 'الظهيرة' },
  Asr:     { ca: 'Tarda', es: 'Tarde', en: 'Afternoon', ar: 'بعد الظهر' },
  Maghrib: { ca: 'Posta de sol', es: 'Puesta del sol', en: 'Sunset', ar: 'الغروب' },
  Isha:    { ca: 'Nit', es: 'Noche', en: 'Night', ar: 'الليل' },
};

/* Rosa de los vientos de 16 puntos. El orden es N, NNE, NE… igual que antes. */
export const COMPASS_POINTS = {
  ca: ['Nord', 'Nord-nord-est', 'Nord-est', 'Est-nord-est', 'Est', 'Est-sud-est', 'Sud-est', 'Sud-sud-est',
       'Sud', 'Sud-sud-oest', 'Sud-oest', 'Oest-sud-oest', 'Oest', 'Oest-nord-oest', 'Nord-oest', 'Nord-nord-oest'],
  es: ['Norte', 'Nornoreste', 'Noreste', 'Estenoreste', 'Este', 'Estesudeste', 'Sudeste', 'Sursudeste',
       'Sur', 'Sursudoeste', 'Sudoeste', 'Oestesudoeste', 'Oeste', 'Oestenoroeste', 'Noroeste', 'Nornoroeste'],
  en: ['North', 'North-northeast', 'Northeast', 'East-northeast', 'East', 'East-southeast', 'Southeast', 'South-southeast',
       'South', 'South-southwest', 'Southwest', 'West-southwest', 'West', 'West-northwest', 'Northwest', 'North-northwest'],
  ar: ['الشمال', 'شمال شمال شرق', 'الشمال الشرقي', 'شرق شمال شرق', 'الشرق', 'شرق جنوب شرق', 'الجنوب الشرقي', 'جنوب جنوب شرق',
       'الجنوب', 'جنوب جنوب غرب', 'الجنوب الغربي', 'غرب جنوب غرب', 'الغرب', 'غرب شمال غرب', 'الشمال الغربي', 'شمال شمال غرب'],
};

export const HIJRI_MONTHS = {
  ca: ['Muharram', 'Sàfar', 'Rabí al-Àwwal', 'Rabí al-Thani', 'Jumada al-Ula', 'Jumada al-Thania',
       'Rajab', 'Xaban', 'Ramadà', 'Xawwal', 'Dhul-Qada', 'Dhul-Hijja'],
  es: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Yumada al-Ula', 'Yumada al-Thania',
       'Rayab', 'Shabán', 'Ramadán', 'Shawwal', 'Dhul Qada', 'Dhul Hiyya'],
  en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Thania',
       'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah'],
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
       'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
};

/* Sufijo del año hijri (1447 H / 1447 هـ). */
export const HIJRI_SUFFIX = { ca: 'H', es: 'H', en: 'AH', ar: 'هـ' };

/* ---------------- Estado ---------------- */

let lang = DEFAULT_LANG;
const listeners = new Set();

/** Idioma inicial: lo guardado, si no el del navegador, si no castellano. */
export function initI18n() {
  const saved = readLang();
  if (isSupported(saved)) {
    lang = saved;
  } else {
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    lang = isSupported(nav) ? nav : DEFAULT_LANG;
  }
  applyDocumentLang();
  return lang;
}

function isSupported(code) {
  return LANGS.some((l) => l.code === code);
}

export function getLang() {
  return lang;
}

export function getLocale() {
  return LANGS.find((l) => l.code === lang)?.locale ?? 'es-ES';
}

export function setLang(code) {
  if (!isSupported(code) || code === lang) return;
  lang = code;
  writeLang(lang);
  applyDocumentLang();
  applyStatic();
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyDocumentLang() {
  const meta = LANGS.find((l) => l.code === lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = meta?.dir ?? 'ltr';
  // Marca para que la CSS pueda ajustar la tipografía árabe.
  document.documentElement.dataset.lang = lang;
}

/* ---------------- Traducción ---------------- */

export function t(key, vars = null) {
  const entry = STRINGS[key];
  // Si falta la traducción caemos al castellano antes que a la clave cruda.
  const raw = entry?.[lang] ?? entry?.[DEFAULT_LANG] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function prayerName(key) {
  return PRAYER_NAMES[key]?.[lang] ?? PRAYER_NAMES[key]?.[DEFAULT_LANG] ?? key;
}

export function prayerSub(key) {
  return PRAYER_SUBS[key]?.[lang] ?? PRAYER_SUBS[key]?.[DEFAULT_LANG] ?? '';
}

export function compassPoints() {
  return COMPASS_POINTS[lang] ?? COMPASS_POINTS[DEFAULT_LANG];
}

export function hijriMonths() {
  return HIJRI_MONTHS[lang] ?? HIJRI_MONTHS[DEFAULT_LANG];
}

export function hijriSuffix() {
  return HIJRI_SUFFIX[lang] ?? HIJRI_SUFFIX[DEFAULT_LANG];
}

/* ---------------- Traducción del HTML estático ---------------- */

/**
 * Recorre el DOM y rellena todo lo marcado en el HTML:
 *   data-i18n="clave"            → textContent
 *   data-i18n-aria="clave"       → aria-label
 *   data-i18n-title="clave"      → title
 *   data-i18n-placeholder="clave"→ placeholder
 */
export function applyStatic(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(node.dataset.i18nTitle));
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  }
}
