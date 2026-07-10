/**
 * i18n.js — DoloPaws language system (English / Italiano).
 *
 * How it works:
 *  - Language resolution: saved choice (localStorage) → browser language
 *    (Italian browsers get Italian) → English.
 *  - Static HTML translates via data-i18n attributes on page load.
 *  - JS-generated text calls t('key') / t('key', {vars}) at render time.
 *  - Curated trail content uses trField(trail, 'desc') which prefers the
 *    Italian field (descIt/tipsIt) when the language is Italian.
 *  - Imported OSM trails have machine-templated English descriptions;
 *    translateImportedDesc() converts the known templates on the fly.
 *  - Switching language saves the choice and reloads the page, so every
 *    script re-renders in the new language. Simple beats clever here.
 *
 * Load this file BEFORE any other site script on every page.
 */

(function(){
  'use strict';

  const STORAGE_KEY = 'dolopaws-lang';

  const I18N = {
  en: {
    'nav.home': 'Home',
    'nav.browse': 'Browse our trails',
    'nav.myTrails': 'My trails',
    'nav.guide': 'Dog safety guide',
    'nav.login': 'Log in',
    'nav.account': 'My account',
    'auth.hint': 'Save trails to your account so they follow you across devices.',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot': 'Forgot password?',
    'auth.or': 'or',
    'auth.google': 'Continue with Google',
    'auth.noAccount': "Don't have an account?",
    'auth.signup': 'Sign up',
    'hero.h1': 'The Dolomites trail guide for dogs and their humans',
    'hero.sub': "The trail guide that asks about your dog before your fitness level. Every route is ranked for paw safety, shade, water access, and terrain risk, matched to your dog's build and tolerance.",
    'hero.cta': "Create your dog's profile →",
    'trust.scored': 'Scored on 6 real safety factors',
    'trust.built': 'Built by people who hike here',
    'trust.updated': 'Updated as conditions change',
    'trust.breeds': 'Scores adapt to your dog\'s breed and build',
    'guest.trailCount': '{n} dog-friendly trails mapped',
    'guest.franceBanner': 'Ooh là là: our paws just crossed into the French Alps',
    'guest.lockedPopup': 'Create your dog\'s profile to open trail pages',
    'quote.text': '“A walk is never just a walk when it\'s shared with a dog; it becomes an act of companionship, curiosity, and joy”',
    'trail.insightsTitle': 'Good to know',
    'browse.lockedCta': 'Log in to see trail details',
    'browse.guestNote': 'Showing {shown} of {total} trails. Log in or create a free profile to see them all.',
    'trail.source': 'Source',
    'teaser.h2': "These trails are already scored. Add your dog's details to reveal their exact match.",
    'teaser.unlock': 'Preview our trails →',
    'home.welcome': 'Welcome back',
    'home.welcomeFor': 'Welcome back. Trail matches for {name}',
    'home.newMatches': '{n} new matches since your last visit.',
    'home.newMatch1': '1 new match since your last visit.',
    'home.rankedFor': "Ranked for {name}'s saved profile.",
    'home.addDetails': 'Add your dog’s details to personalize this list.',
    'home.editProfile': 'Edit profile →',
    'home.savedTrails': 'Saved trails',
    'home.allTrailsBtn': '← All trails',
    'home.adjust': "Adjust for today's conditions →",
    'home.nTrails': '{n} trails',
    'home.nSaved': '{n} saved trails',
    'home.nSaved1': '1 saved trail',
    'home.noSavedArea': 'No saved trails in {area}. Try a different area, or go back to all trails.',
    'home.noSaved': 'You haven\'t saved any trails yet. Click "Save" on a trail below to keep it here.',
    'home.noTrailsArea': 'No trails in {area}. Try a different area.',
    'adjust.title': 'Adjusting for today only',
    'adjust.note': "This won't change your saved profile — just today's list.",
    'adjust.terrain': 'Terrain today',
    'adjust.t0': 'Paved / packed dirt only',
    'adjust.t1': 'Gravel & mixed rock OK',
    'adjust.t2': 'Loose rock / scree OK',
    'adjust.distance': 'Distance today',
    'adjust.d5': 'Up to 5 km',
    'adjust.d10': 'Up to 10 km',
    'adjust.dNo': 'No limit',
    'adjust.energy': 'Energy level today',
    'adjust.eLow': '🐌 Low',
    'adjust.eMedium': '🐕 Medium',
    'adjust.eHigh': '🚀 High',
    'adjust.close': '✕ Close',
    'areas.all': 'All areas',
    'filter.all': 'All',
    'filter.verified': 'Verified',
    'filter.imported': 'Imported',
    'map.layers': 'Layers',
    'map.closeLayers': 'Close ✕',
    'chips.routes': '🥾 Trail routes',
    'chips.lifts': '🚡 Lift stations & names',
    'chips.fountains': '💧 Fountains',
    'chips.huts': '🏔️ Mountain huts',
    'chips.food': '🍽️ Food & drink',
    'chips.dog': '🐾 Dog-friendly only',
    'chips.dogOn': '🐾 Showing dog-friendly only',
    'legend.low': 'Low-risk',
    'legend.moderate': 'Moderate',
    'legend.caution': 'Caution',
    'legend.liftConfirmed': 'Confirmed summer lift',
    'legend.liftUnknown': 'Lift, season unconfirmed',
    'legend.water': 'Drinking water',
    'legend.hut': 'Mountain hut',
    'legend.food': 'Food & drink',
    'legend.dogOn': '🐾 dog-friendly filter on',
    'safety.low': 'Low-risk terrain',
    'safety.moderate': 'Moderate, some caution',
    'safety.caution': 'Caution: exposed sections',
    'badge.verified': 'VERIFIED BY DOLOPAWS',
    'badge.imported': 'IMPORTED',
    'badge.new': 'NEW MATCH',
    'badge.verifiedS': '✓ Verified',
    'badge.importedS': 'Imported',
    'card.save': 'Save',
    'card.saved': 'Saved',
    'card.match': '{n}% match',
    'card.details': 'Trail details →',
    'card.routeShape': '↑ actual route shape, from real trail data',
    'card.trailRef': 'Trail {ref}',
    'card.paid': 'Paid access',
    'page.prev': '← Previous',
    'page.next': 'Next →',
    'page.of': 'Page {a} of {b}',
    'browse.h1': 'All our trails',
    'browse.h1Guest': 'A preview of our trails',
    'browse.subGuest': 'A taste of what DoloPaws covers: {shown} of {total} trails. <a href="account.html" style="color:var(--accent);font-weight:700;">Create your dog\'s profile</a> to unlock every trail, safety scores, and matches picked for your dog.',
    'browse.sub': 'A quick look at every trail we cover. <a href="account.html" style="color:var(--accent);font-weight:700;">Create your dog\'s profile</a> to see safety scores, terrain detail, and matches picked for them.',
    'browse.eyebrow': 'Dolomites &amp; Savoy',
    'hike.start': '🐾 Start hike',
    'hike.end': '✕ End hike',
    'hike.getting': 'Getting your position…',
    'hike.kmOf': 'Km {a} of {b}',
    'hike.waterIn': '💧 in {d} km',
    'hike.hutIn': '🏠 {name} in {d} km',
    'hike.ahead': '🔀 ahead: {what}',
    'hike.far': "You're {d} km from this route",
    'hike.offRoute': '⚠️ You seem to have left the marked route',
    'hike.gps': 'GPS accuracy ±{m} m',
    'hike.offline': 'Offline: the map may grey out, but your position, distances and warnings keep working. GPS needs no internet.',
    'hike.permission': 'Location permission needed.<br><span style="font-weight:400;">Enable it for dolopaws.com in your browser settings, then tap Start hike again.</span>',
    'hike.waiting': 'Waiting for GPS signal…',
    'flag.guard-dogs-livestock': 'Livestock guard dogs on route',
    'flag.dangerous-terrain': 'Terrain dangerous for dogs',
    'flag.not-dog-friendly': 'Not dog-friendly',
    'flag.water-dry': 'Water source dry',
    'flag.lift-refused-dog': 'Lift refused a dog',
    'flag.other': 'Other',
    'reports.title': 'Trail reports from the community',
    'reports.button': '⚠️ Report something',
    'reports.intro': "Recent dog-safety observations from hikers. These appear alongside DoloPaws' verified rating and never replace it.",
    'reports.empty': 'No community reports for this trail yet. Hiked it recently? Let other dog owners know if you spotted anything.',
    'reports.stale': 'from last season, unconfirmed',
    'reports.remove': 'Remove',
    'reports.report': 'Report',
    'reports.reported': ' · reported ✓',
    'reports.confirmRemove': 'Remove your report?',
    'reports.reportedBy': ' · reported by {who}',
    'reports.modalTitle': 'Report something on this trail',
    'reports.modalHint': "Help the next dog owner. Your report shows alongside DoloPaws' verified rating and never replaces it.",
    'reports.knowWhere': 'I know roughly where it was',
    'reports.atKm': 'at km <b data-kmval>0</b> of {max}',
    'reports.placeholder': 'Anything the next hiker should know? (optional, max 300 characters)',
    'reports.pickType': 'Pick what kind of report this is.',
    'reports.post': 'Post report',
    'reports.posting': 'Posting…',
    'reports.error': 'Could not save — try again.',
    'reports.community': 'Community report',
    'trail.notFound': 'Trail not found',
    'trail.notFoundSub': 'This trail may have moved — try browsing all trails instead.',
    'trail.coords': 'Trailhead coordinates:',
    'trail.fact.distance': 'Distance',
    'trail.fact.ascent': 'Ascent',
    'trail.fact.descent': 'Descent',
    'trail.fact.high': 'Highest point',
    'trail.fact.low': 'Lowest point',
    'trail.fact.duration': 'Duration',
    'trail.tag.loop': '🔁 Loop route',
    'trail.tag.rest': '🍽️ Rest stops on route',
    'trail.tag.family': '👨‍👩‍👧 Family-friendly',
    'trail.tag.geo': '🪨 Geological interest',
    'trail.tag.free': '🎟️ Free access',
    'trail.weatherNow': 'Weather at the trailhead right now:',
    'trail.weatherWind': 'wind',
    'trail.weatherVia': 'Live forecast via Open-Meteo',
    'trail.weatherUnavail': 'Live weather unavailable right now.',
    'trail.hikedWeek': '🐾 {n} dogs hiked this trail this week',
    'trail.hikedWeek1': '🐾 1 dog hiked this trail this week',
    'trail.route': 'Trail route ({label})',
    'trail.tip': 'Tip: {tip}',
    'trail.dirStart': '🚩 {label} (km 0), the flag marker on the map.',
    'trail.dirStartAt': '🚩 Start at {name} (km 0), the flag marker on the map.',
    'trail.dirPass': 'pass {name}',
    'trail.dirThen': ', then ',
    'trail.dirEnd': 'Continue back to the start, completing the loop at km {n}.',
    'trail.verifiedBox': '🐾 <strong>Verified by DoloPaws</strong> — route, terrain, water points and dog-specific details individually checked against independent sources.',
    'trail.dir.title': 'Trail directions',
    'trail.about.title': 'About this trail',
    'trail.details.title': 'Trail details',
    'legendTrail.rifugio': '🏠 Rifugio',
    'legendTrail.water': '💧 Drinking water',
    'legendTrail.switch': '🔀 Trail switch',
    'legendTrail.start': '🚩 Recommended start',
    'legendTrail.dir': '➤ Direction of travel',
    'guide.eyebrow': 'Dog safety guide',
    'guide.h1': 'Hiking with your dog at altitude',
    'guide.checking': 'Checking your login status…',
    'guide.notLogged': "You're not logged in.",
    'guide.subline': "The things that cause the most trouble on alpine trails are not the elevation. They are paws, heat, pace, and knowing your dog's build.",
    'guide.loggedOutMsg': 'This guide is available to logged-in accounts only.',
    'guide.goHome': 'Go to homepage to log in',
    'guide.disclaimer': "This guide is general information, not veterinary advice. If your dog shows signs of heat stress, injury, or exhaustion on trail, prioritize getting them to shade, water, and — if symptoms don't resolve quickly — a vet.",
    'trail.rifugiHead': '🏔️ Rifugi on the way',
    'trail.waterHead': '💧 Drinking water',
    'trail.restHead': '🪑 Resting stations',
    'trail.noRifugi': 'No rifugi along this route.',
    'trail.noWater': 'No drinking water sources recorded along this route — bring enough for your dog.',
    'trail.restNote': 'Not tracked separately yet — rifugi above often double as rest stops.',
    'trail.importedBox': '🗺️ <strong>Imported trail</strong> — route, elevation, fountains and rifugi come from verified map data, but DoloPaws hasn\'t field-reviewed this trail yet.',
    'trail.viewSource': 'View source route on Waymarked Trails ↗',
    'auth.createTitle': 'Create your account',
    'auth.haveAccount': 'Already have an account?',
    'auth.forgotFirst': 'Enter your email above first, then click "Forgot password?"',
    'areas.allValleys': 'All valleys',
    'region.dolomites': 'Dolomites',
    'region.savoy': 'Savoy',
    'region.theDolomites': 'the Dolomites',
    'home.noSavedValley': 'No saved trails in {label}. Try a different valley, or go back to all trails.',
    'home.noTrailsValley': 'No trails in {label}. Try a different valley or filter.',
    'footer.line': 'DoloPaws | A personalised trail guide for dogs and their humans.',
  },
  it: {
    'nav.home': 'Home',
    'nav.browse': 'Esplora i sentieri',
    'nav.myTrails': 'I miei sentieri',
    'nav.guide': 'Guida sicurezza cani',
    'nav.login': 'Accedi',
    'nav.account': 'Il mio account',
    'auth.hint': 'Salva i sentieri sul tuo account e ritrovali su tutti i tuoi dispositivi.',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot': 'Password dimenticata?',
    'auth.or': 'oppure',
    'auth.google': 'Continua con Google',
    'auth.noAccount': 'Non hai un account?',
    'auth.signup': 'Registrati',
    'hero.h1': 'La guida ai sentieri delle Dolomiti per i cani e i loro umani',
    'hero.sub': "La guida che chiede prima del tuo cane, poi della tua forma fisica. Ogni itinerario è valutato per sicurezza delle zampe, ombra, accesso all'acqua e rischio del terreno, su misura per la corporatura e la tolleranza del tuo cane.",
    'hero.cta': 'Crea il profilo del tuo cane →',
    'trust.scored': 'Valutati su 6 fattori reali di sicurezza',
    'trust.built': 'Creato da chi queste montagne le vive',
    'trust.updated': 'Aggiornato al cambiare delle condizioni',
    'trust.breeds': 'I punteggi si adattano a razza e corporatura del tuo cane',
    'guest.trailCount': '{n} sentieri dog-friendly mappati',
    'guest.franceBanner': 'Ooh là là: le nostre zampe hanno appena varcato le Alpi francesi',
    'guest.lockedPopup': 'Crea il profilo del tuo cane per aprire le pagine dei sentieri',
    'quote.text': '“Una passeggiata non è mai solo una passeggiata quando la condividi con un cane; diventa un gesto di complicità, curiosità e gioia”',
    'trail.insightsTitle': 'Da sapere',
    'browse.lockedCta': 'Accedi per vedere i dettagli',
    'browse.guestNote': 'Mostriamo {shown} di {total} sentieri. Accedi o crea un profilo gratuito per vederli tutti.',
    'trail.source': 'Fonte',
    'teaser.h2': 'Questi sentieri sono già valutati. Aggiungi i dati del tuo cane per scoprire la loro compatibilità esatta.',
    'teaser.unlock': 'Anteprima dei sentieri →',
    'home.welcome': 'Bentornati',
    'home.welcomeFor': 'Bentornati. I sentieri su misura per {name}',
    'home.newMatches': '{n} nuovi match dalla tua ultima visita.',
    'home.newMatch1': '1 nuovo match dalla tua ultima visita.',
    'home.rankedFor': 'In ordine di compatibilità per il profilo di {name}.',
    'home.addDetails': 'Aggiungi i dati del tuo cane per personalizzare la lista.',
    'home.editProfile': 'Modifica profilo →',
    'home.savedTrails': 'Sentieri salvati',
    'home.allTrailsBtn': '← Tutti i sentieri',
    'home.adjust': 'Adatta alle condizioni di oggi →',
    'home.nTrails': '{n} sentieri',
    'home.nSaved': '{n} sentieri salvati',
    'home.nSaved1': '1 sentiero salvato',
    'home.noSavedArea': 'Nessun sentiero salvato in {area}. Prova un\'altra zona o torna a tutti i sentieri.',
    'home.noSaved': 'Non hai ancora salvato nessun sentiero. Tocca "Salva" su un sentiero qui sotto per ritrovarlo qui.',
    'home.noTrailsArea': 'Nessun sentiero in {area}. Prova un\'altra zona.',
    'adjust.title': 'Solo per oggi',
    'adjust.note': 'Non modifica il profilo salvato — solo la lista di oggi.',
    'adjust.terrain': 'Terreno oggi',
    'adjust.t0': 'Solo asfalto / sterrato compatto',
    'adjust.t1': 'Ghiaia e roccia mista OK',
    'adjust.t2': 'Roccia instabile / ghiaione OK',
    'adjust.distance': 'Distanza oggi',
    'adjust.d5': 'Fino a 5 km',
    'adjust.d10': 'Fino a 10 km',
    'adjust.dNo': 'Senza limite',
    'adjust.energy': 'Livello di energia oggi',
    'adjust.eLow': '🐌 Basso',
    'adjust.eMedium': '🐕 Medio',
    'adjust.eHigh': '🚀 Alto',
    'adjust.close': '✕ Chiudi',
    'areas.all': 'Tutte le zone',
    'filter.all': 'Tutti',
    'filter.verified': 'Verificati',
    'filter.imported': 'Importati',
    'map.layers': 'Livelli',
    'map.closeLayers': 'Chiudi ✕',
    'chips.routes': '🥾 Tracciati escursionistici',
    'chips.lifts': '🚡 Impianti di risalita',
    'chips.fountains': '💧 Fontane',
    'chips.huts': '🏔️ Rifugi',
    'chips.food': '🍽️ Cibo e bevande',
    'chips.dog': '🐾 Solo dog-friendly',
    'chips.dogOn': '🐾 Solo posti dog-friendly',
    'legend.low': 'Rischio basso',
    'legend.moderate': 'Moderato',
    'legend.caution': 'Attenzione',
    'legend.liftConfirmed': 'Impianto estivo confermato',
    'legend.liftUnknown': 'Impianto, stagione da confermare',
    'legend.water': 'Acqua potabile',
    'legend.hut': 'Rifugio',
    'legend.food': 'Cibo e bevande',
    'legend.dogOn': '🐾 filtro dog-friendly attivo',
    'safety.low': 'Terreno a basso rischio',
    'safety.moderate': 'Moderato, un po\' di cautela',
    'safety.caution': 'Attenzione: tratti esposti',
    'badge.verified': 'VERIFICATO DA DOLOPAWS',
    'badge.imported': 'IMPORTATO',
    'badge.new': 'NUOVO MATCH',
    'badge.verifiedS': '✓ Verificato',
    'badge.importedS': 'Importato',
    'card.save': 'Salva',
    'card.saved': 'Salvato',
    'card.match': 'compatibilità {n}%',
    'card.details': 'Dettagli sentiero →',
    'card.routeShape': '↑ forma reale del percorso, da dati GPS',
    'card.trailRef': 'Sentiero {ref}',
    'card.paid': 'Accesso a pagamento',
    'page.prev': '← Precedente',
    'page.next': 'Successiva →',
    'page.of': 'Pagina {a} di {b}',
    'browse.h1': 'Tutti i nostri sentieri',
    'browse.h1Guest': 'Un\'anteprima dei nostri sentieri',
    'browse.subGuest': 'Un assaggio di ciò che copre DoloPaws: {shown} di {total} sentieri. <a href="account.html" style="color:var(--accent);font-weight:700;">Crea il profilo del tuo cane</a> per sbloccare tutti i sentieri, le valutazioni di sicurezza e i match scelti per lui.',
    'browse.sub': 'Uno sguardo rapido a tutti i sentieri che copriamo. <a href="account.html" style="color:var(--accent);font-weight:700;">Crea il profilo del tuo cane</a> per vedere valutazioni di sicurezza, dettagli del terreno e sentieri scelti per lui.',
    'browse.eyebrow': 'Dolomiti e Savoia',
    'hike.start': '🐾 Inizia escursione',
    'hike.end': '✕ Termina',
    'hike.getting': 'Rilevamento posizione…',
    'hike.kmOf': 'Km {a} di {b}',
    'hike.waterIn': '💧 tra {d} km',
    'hike.hutIn': '🏠 {name} tra {d} km',
    'hike.ahead': '🔀 a breve: {what}',
    'hike.far': 'Sei a {d} km da questo percorso',
    'hike.offRoute': '⚠️ Sembra che tu abbia lasciato il sentiero segnato',
    'hike.gps': 'Precisione GPS ±{m} m',
    'hike.offline': 'Offline: la mappa può diventare grigia, ma posizione, distanze e avvisi continuano a funzionare. Il GPS non richiede internet.',
    'hike.permission': 'Serve il permesso di localizzazione.<br><span style="font-weight:400;">Attivalo per dolopaws.com nelle impostazioni del browser, poi tocca di nuovo Inizia escursione.</span>',
    'hike.waiting': 'In attesa del segnale GPS…',
    'flag.guard-dogs-livestock': 'Cani da guardiania al pascolo',
    'flag.dangerous-terrain': 'Terreno pericoloso per i cani',
    'flag.not-dog-friendly': 'Non dog-friendly',
    'flag.water-dry': 'Fonte d\'acqua asciutta',
    'flag.lift-refused-dog': 'Impianto ha rifiutato un cane',
    'flag.other': 'Altro',
    'reports.title': 'Segnalazioni della community',
    'reports.button': '⚠️ Segnala qualcosa',
    'reports.intro': 'Osservazioni recenti degli escursionisti sulla sicurezza per i cani. Compaiono accanto alla valutazione verificata di DoloPaws e non la sostituiscono mai.',
    'reports.empty': 'Nessuna segnalazione per questo sentiero. Ci sei stato di recente? Fai sapere agli altri se hai notato qualcosa.',
    'reports.stale': 'della scorsa stagione, non confermata',
    'reports.remove': 'Rimuovi',
    'reports.report': 'Segnala',
    'reports.reported': ' · segnalato ✓',
    'reports.confirmRemove': 'Rimuovere la tua segnalazione?',
    'reports.reportedBy': ' · segnalato da {who}',
    'reports.modalTitle': 'Segnala qualcosa su questo sentiero',
    'reports.modalHint': 'Aiuta il prossimo escursionista. La tua segnalazione appare accanto alla valutazione verificata di DoloPaws e non la sostituisce mai.',
    'reports.knowWhere': 'So più o meno dov\'era',
    'reports.atKm': 'al km <b data-kmval>0</b> di {max}',
    'reports.placeholder': 'Qualcosa che il prossimo escursionista dovrebbe sapere? (facoltativo, max 300 caratteri)',
    'reports.pickType': 'Scegli il tipo di segnalazione.',
    'reports.post': 'Pubblica segnalazione',
    'reports.posting': 'Invio…',
    'reports.error': 'Salvataggio non riuscito — riprova.',
    'reports.community': 'Segnalazione della community',
    'trail.notFound': 'Sentiero non trovato',
    'trail.notFoundSub': 'Questo sentiero potrebbe essere stato spostato — prova a esplorare tutti i sentieri.',
    'trail.coords': 'Coordinate del punto di partenza:',
    'trail.fact.distance': 'Distanza',
    'trail.fact.ascent': 'Salita',
    'trail.fact.descent': 'Discesa',
    'trail.fact.high': 'Punto più alto',
    'trail.fact.low': 'Punto più basso',
    'trail.fact.duration': 'Durata',
    'trail.tag.loop': '🔁 Percorso ad anello',
    'trail.tag.rest': '🍽️ Punti di ristoro lungo il percorso',
    'trail.tag.family': '👨‍👩‍👧 Per famiglie',
    'trail.tag.geo': '🪨 Interesse geologico',
    'trail.tag.free': '🎟️ Accesso gratuito',
    'trail.weatherNow': 'Meteo alla partenza in questo momento:',
    'trail.weatherWind': 'vento',
    'trail.weatherVia': 'Previsioni live via Open-Meteo',
    'trail.weatherUnavail': 'Meteo live non disponibile al momento.',
    'trail.hikedWeek': '🐾 {n} cani hanno percorso questo sentiero questa settimana',
    'trail.hikedWeek1': '🐾 1 cane ha percorso questo sentiero questa settimana',
    'trail.route': 'Tracciato ({label})',
    'trail.tip': 'Consiglio: {tip}',
    'trail.dirStart': '🚩 {label} (km 0), la bandierina sulla mappa.',
    'trail.dirStartAt': '🚩 Partenza da {name} (km 0), la bandierina sulla mappa.',
    'trail.dirPass': 'passa {name}',
    'trail.dirThen': ', poi ',
    'trail.dirEnd': 'Prosegui fino al punto di partenza, chiudendo l\'anello al km {n}.',
    'trail.verifiedBox': '🐾 <strong>Verificato da DoloPaws</strong> — percorso, terreno, punti acqua e dettagli specifici per i cani controllati singolarmente su fonti indipendenti.',
    'trail.dir.title': 'Indicazioni',
    'trail.about.title': 'Il sentiero',
    'trail.details.title': 'Dettagli',
    'legendTrail.rifugio': '🏠 Rifugio',
    'legendTrail.water': '💧 Acqua potabile',
    'legendTrail.switch': '🔀 Cambio sentiero',
    'legendTrail.start': '🚩 Partenza consigliata',
    'legendTrail.dir': '➤ Senso di marcia',
    'guide.eyebrow': 'Guida sicurezza cani',
    'guide.h1': 'In montagna con il tuo cane, in quota',
    'guide.checking': 'Verifica dell\'accesso…',
    'guide.notLogged': 'Non hai effettuato l\'accesso.',
    'guide.subline': 'I problemi più frequenti sui sentieri alpini non dipendono dall\'altitudine. Dipendono da zampe, caldo, ritmo e dal conoscere la corporatura del tuo cane.',
    'guide.loggedOutMsg': 'Questa guida è riservata agli account registrati.',
    'guide.goHome': 'Vai alla homepage per accedere',
    'guide.disclaimer': 'Questa guida è informazione generale, non un parere veterinario. Se il tuo cane mostra segni di stress da caldo, infortunio o sfinimento sul sentiero, portalo subito all\'ombra, dagli acqua e — se i sintomi non passano rapidamente — rivolgiti a un veterinario.',
    'trail.rifugiHead': '🏔️ Rifugi lungo il percorso',
    'trail.waterHead': '💧 Acqua potabile',
    'trail.restHead': '🪑 Punti di sosta',
    'trail.noRifugi': 'Nessun rifugio lungo questo percorso.',
    'trail.noWater': 'Nessuna fonte d\'acqua potabile registrata lungo questo percorso — porta acqua a sufficienza per il tuo cane.',
    'trail.restNote': 'Non ancora tracciati separatamente — i rifugi qui sopra fungono spesso da punti di sosta.',
    'trail.importedBox': '🗺️ <strong>Sentiero importato</strong> — percorso, quote, fontane e rifugi provengono da dati cartografici verificati, ma DoloPaws non l\'ha ancora verificato sul campo.',
    'trail.viewSource': 'Vedi il percorso originale su Waymarked Trails ↗',
    'auth.createTitle': 'Crea il tuo account',
    'auth.haveAccount': 'Hai già un account?',
    'auth.forgotFirst': 'Inserisci prima la tua email qui sopra, poi tocca "Password dimenticata?"',
    'areas.allValleys': 'Tutte le valli',
    'region.dolomites': 'Dolomiti',
    'region.savoy': 'Savoia',
    'region.theDolomites': 'le Dolomiti',
    'home.noSavedValley': 'Nessun sentiero salvato in {label}. Prova un\'altra valle o torna a tutti i sentieri.',
    'home.noTrailsValley': 'Nessun sentiero in {label}. Prova un\'altra valle o un altro filtro.',
    'footer.line': 'DoloPaws | Una guida ai sentieri personalizzata per i cani e i loro umani.',
  }};

  // ---- Language resolution ---------------------------------------------------
  let lang;
  try {
    lang = localStorage.getItem(STORAGE_KEY);
  } catch (e) { lang = null; }
  if (lang !== 'en' && lang !== 'it') {
    lang = (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
  }
  document.documentElement.lang = lang;

  // ---- Translation functions -------------------------------------------------
  function t(key, vars){
    let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }

  // Curated trail content: prefer the Italian field when present.
  function trField(obj, field){
    if (!obj) return '';
    if (lang === 'it'){
      const it = obj[field + 'It'];
      if (it) return it;
      // Imported OSM trails carry machine-templated English descriptions —
      // translate the known templates on the fly instead of storing 100+
      // hand translations in a generated data file.
      if (field === 'desc' && obj.curated === false) return translateImportedDesc(obj.desc || '');
    }
    return obj[field] || '';
  }

  function translateImportedDesc(s){
    return String(s)
      .replace(/^An? ([\d.]+) km route near (.+?), imported from the OpenStreetMap hiking network(?: \(trail ([^)]+)\))?\./,
        (m, km, place, ref) => `Un percorso di ${km} km vicino a ${place}, importato dalla rete escursionistica di OpenStreetMap${ref ? ` (sentiero ${ref})` : ''}.`)
      .replace(/^An? ([\d.]+) km loop near (.+?), imported from the OpenStreetMap hiking network(?: \(trail ([^)]+)\))?\./,
        (m, km, place, ref) => `Un anello di ${km} km vicino a ${place}, importato dalla rete escursionistica di OpenStreetMap${ref ? ` (sentiero ${ref})` : ''}.`)
      .replace(/Passed automated dog-suitability screening: no via ferrata, no sac scale beyond mountain hiking, no explicit dog bans\./,
        'Ha superato la verifica automatica di idoneità per i cani: nessuna via ferrata, nessuna difficoltà oltre l\'escursionismo di montagna, nessun divieto esplicito per i cani.')
      .replace(/Passed automated dog-suitability screening:/,
        'Ha superato la verifica automatica di idoneità per i cani:')
      .replace(/no via ferrata/g, 'nessuna via ferrata')
      .replace(/no explicit dog bans/g, 'nessun divieto esplicito per i cani')
      .replace(/Not yet individually verified by DoloPaws\./, 'Non ancora verificato singolarmente da DoloPaws.');
  }

  // ---- Static HTML translation ----------------------------------------------
  function applyTranslations(){
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    // Safety guide dual-language content blocks
    document.querySelectorAll('[data-lang-block]').forEach(el => {
      el.hidden = el.dataset.langBlock !== lang;
    });
  }

  // ---- Language toggle in the nav ---------------------------------------------
  function setLang(next){
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    location.reload(); // simplest way to re-render every script in the new language
  }

  function injectToggle(){
    const links = document.querySelector('.topnav .links');
    if (!links) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = lang === 'it' ? '🌐 Lingua' : '🌐 Language';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.style.cssText = 'border:1.5px solid var(--paper-line);background:none;color:var(--ink);font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;cursor:pointer;font-family:\'Inter\',sans-serif;';
    wrap.appendChild(btn);

    const menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;top:calc(100% + 6px);right:0;z-index:60;background:#fff;border:1px solid var(--paper-line);border-radius:12px;padding:6px;display:none;flex-direction:column;gap:2px;box-shadow:0 6px 18px rgba(0,0,0,.14);min-width:130px;';
    const OPTIONS = [
      ['en', lang === 'it' ? 'Inglese' : 'English'],
      ['it', lang === 'it' ? 'Italiano' : 'Italian'],
    ];
    OPTIONS.forEach(([code, label]) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = (code === lang ? '✓ ' : '') + label;
      item.style.cssText = 'border:none;background:' + (code === lang ? 'var(--sage-dim)' : 'none') +
        ';color:var(--ink);font-size:12.5px;font-weight:' + (code === lang ? '700' : '500') +
        ';padding:8px 12px;border-radius:8px;cursor:pointer;text-align:left;font-family:\'Inter\',sans-serif;';
      item.addEventListener('click', () => {
        menu.style.display = 'none';
        if (code !== lang) setLang(code);
      });
      menu.appendChild(item);
    });
    wrap.appendChild(menu);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.style.display === 'flex';
      menu.style.display = open ? 'none' : 'flex';
      btn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => { menu.style.display = 'none'; btn.setAttribute('aria-expanded', 'false'); });

    links.appendChild(wrap);
  }

  function init(){
    applyTranslations();
    injectToggle();
    // Localized page titles (trail.html sets its own from the trail name).
    if (lang === 'it'){
      const TITLES = {
        'index.html': 'DoloPaws | Sentieri delle Dolomiti a misura di cane',
        '': 'DoloPaws | Sentieri delle Dolomiti a misura di cane',
        'browse-trails.html': 'Tutti i sentieri | DoloPaws',
        'safety-guide.html': 'Guida sicurezza cani | DoloPaws',
        'account.html': 'Il mio account | DoloPaws',
        'my-trails.html': 'I miei sentieri | DoloPaws',
      };
      const page = (location.pathname.split('/').pop() || '');
      if (TITLES[page]) document.title = TITLES[page];
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.DoloPawsI18n = { lang, t, trField, setLang };
  window.t = t;
  window.trField = trField;
})();
