const trails = [
  {
    id:'alpe-siusi', category:'Kid + dog friendly', lat:46.548, lng:11.612, name:'Alpe di Siusi Meadow Loop', area:'Alpe di Siusi / Seiser Alm',
    distance:6, elevation:150, hours:'1.5–2.5', paid:false, crowds:'busy',
    terrainType:'Packed dirt & grass', terrainRank:0,
    surfaceHazards:[], shadeCoverage:20, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Trailhead fountain'},{km:3,label:'Meadow stream'}],
    rifugi:[{km:2,name:'Rifugio Bulla'}],
    desc:"Europe's largest high-alpine meadow, gently rolling and wide open — a forgiving first day for a dog getting used to altitude.",
    tips:"Multiple entry points; go early to find free parking, or take the cable car up from Ortisei/Siusi."
  },
  {
    id:'seceda', category:'Out & back', lat:46.599, lng:11.68, name:'Seceda Ridge Trail', area:'Val Gardena',
    distance:8, elevation:400, hours:'2.5–4', paid:true, crowds:'busy',
    terrainType:'Packed dirt with rocky steps', terrainRank:1,
    surfaceHazards:['Rocky steps near the ridge'], shadeCoverage:10, heatRisk:'high', safetyLevel:'moderate', exposure:false,
    waterSources:[{km:1,label:'Gondola station fountain'},{km:4,label:'Rest-area spring'}],
    rifugi:[{km:3,name:'Rifugio Firenze'},{km:6,name:'Baita Troier'}],
    desc:"Sweeping ridge views over Val Gardena with rest areas and water along the way. Reached via the Ortisei–Furnes gondola.",
    tips:"Keep dogs on lead near the ridge edges; the gondola will want a muzzle carried."
  },
  {
    id:'santa-maddalena', category:'Kid + dog friendly', lat:46.647, lng:11.728, name:'Santa Maddalena Viewpoint', area:'Val di Funes',
    distance:4, elevation:180, hours:'1–1.5', paid:false, crowds:'busy',
    terrainType:'Paved farm road & packed dirt', terrainRank:0,
    surfaceHazards:[], shadeCoverage:30, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Village fountain'}],
    rifugi:[],
    desc:"The postcard shot of the Dolomites — a church backed by the Odle peaks. The short out-and-back suits any dog.",
    tips:"Mostly open meadow with little shade — bring water for warm days. No rifugi on the short route, only village cafes."
  },
  {
    id:'tre-cime', category:'Loops', lat:46.618, lng:12.301, name:'Tre Cime di Lavaredo Loop', area:'Sesto Dolomites',
    distance:9, elevation:280, hours:'3–4', paid:true, crowds:'busy',
    terrainType:'Wide gravel', terrainRank:1,
    surfaceHazards:['Loose gravel patches near the rifugi'], shadeCoverage:5, heatRisk:'high', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Rifugio Auronzo fountain'},{km:4,label:'Rifugio Lavaredo'},{km:7,label:'Rifugio Locatelli'}],
    rifugi:[{km:0,name:'Rifugio Auronzo'},{km:4,name:'Rifugio Lavaredo'},{km:7,name:'Rifugio Locatelli'}],
    desc:"The classic loop around the iconic three peaks. Wide, well-graded path — one of the friendliest big-name hikes for dogs.",
    tips:"Starts/ends at Rifugio Auronzo, a paid access road (car fee applies). Very popular — arrive early."
  },
  {
    id:'cadini', category:'Out & back', lat:46.61, lng:12.265, name:'Cadini di Misurina Viewpoint', area:'Sesto Dolomites',
    distance:4, elevation:250, hours:'1.5–2.5', paid:true, crowds:'busy',
    terrainType:'Rocky switchbacks, loose scree', terrainRank:2,
    surfaceHazards:['Sharp limestone','Narrow ledges with drop-offs'], shadeCoverage:10, heatRisk:'high', safetyLevel:'caution', exposure:true,
    waterSources:[],
    rifugi:[{km:0,name:'Rifugio Auronzo'}],
    desc:"A short but steep out-and-back to a jagged, fantasy-film viewpoint. Narrow sections with real drop-offs near the top.",
    tips:"Skip this one in wet weather or with a dog unsure on narrow terrain."
  },
  {
    id:'prato-piazza', category:'Loops', lat:46.701, lng:12.105, name:'Prato Piazza (Plätzwiese)', area:'Fanes-Sennes-Prags',
    distance:7, elevation:220, hours:'2–3', paid:false, crowds:'quiet',
    terrainType:'Packed dirt & grass, occasional rock', terrainRank:1,
    surfaceHazards:['Occasional loose rock'], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Trailhead fountain'},{km:3,label:'Meadow spring'}],
    rifugi:[{km:1,name:'Rifugio Prato Piazza'},{km:4,name:'Rifugio Vallandro'}],
    desc:"Wide alpine meadows with views to Tre Cime and Monte Cristallo, plus a WWI-era fort to explore along the way.",
    tips:"Rocky in patches but no exposure — a relaxed, scenic option away from the busiest crowds."
  },
  {
    id:'nuvolau', category:'Rifugio walks', lat:46.488, lng:12.053, name:'Passo Giau to Rifugio Nuvolau', area:'Cortina / Ampezzo',
    distance:6, elevation:520, hours:'2.5–3.5', paid:false, crowds:'quiet',
    terrainType:'Loose rock mountain path', terrainRank:2,
    surfaceHazards:['Loose rock on the climb'], shadeCoverage:5, heatRisk:'high', safetyLevel:'moderate', exposure:false,
    waterSources:[],
    rifugi:[{km:3,name:'Rifugio Nuvolau'}],
    desc:"A steady, rewarding climb from the 2236 m pass up to one of the best 360° viewpoints in the Dolomites.",
    tips:"Starts already at altitude — go slow with dogs unused to thin air, and carry all the water you'll need."
  },
  {
    id:'sassolungo', category:'Rifugio walks', lat:46.531, lng:11.753, name:'Sassolungo–Sassopiatto Loop', area:'Val Gardena / Passo Sella',
    distance:14, elevation:750, hours:'5–7', paid:true, crowds:'busy',
    terrainType:'Scree & rock', terrainRank:2,
    surfaceHazards:['Scree fields','Long exposed stretches'], shadeCoverage:10, heatRisk:'high', safetyLevel:'caution', exposure:true,
    waterSources:[{km:3,label:'Waterfall stream'}],
    rifugi:[{km:4,name:'Rifugio Sasso Piatto'},{km:8,name:'Rifugio Sandro Pertini'},{km:11,name:'Rifugio Vicenza'}],
    desc:"A big day out circling the Sassolungo massif via scree slopes and a chain of rifugi, with a waterfall en route.",
    tips:"Only for very fit, trail-hardened dogs — long, rocky, with real elevation."
  },
  {
    id:'lago-braies', category:'Kid + dog friendly', lat:46.695, lng:12.085, name:'Lago di Braies Loop', area:'Prags Valley',
    distance:3.5, elevation:40, hours:'1', paid:false, crowds:'busy',
    terrainType:'Paved / packed gravel, flat', terrainRank:0,
    surfaceHazards:[], shadeCoverage:50, heatRisk:'low', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Lakeside fountain'}],
    rifugi:[{km:0,name:'Lakeside hotel café'}],
    desc:"A flat, easy circuit around one of the Dolomites' most photographed lakes. Gentle enough for any dog.",
    tips:"Extremely popular — expect crowds and paid parking; arrive at opening time."
  },
  {
    id:'lago-carezza', category:'Kid + dog friendly', lat:46.446, lng:11.598, name:'Lago di Carezza Loop', area:"Val d'Ega",
    distance:1.5, elevation:20, hours:'0.5', paid:false, crowds:'busy',
    terrainType:'Paved, flat', terrainRank:0,
    surfaceHazards:[], shadeCoverage:70, heatRisk:'low', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Trailhead fountain'}],
    rifugi:[],
    desc:"A short, flat, mostly forested path around a small, vividly colored lake — a perfect low-effort stop.",
    tips:"Lake is fenced off (no swimming) but it's a lovely easy leg-stretch for older or less mobile dogs."
  },
  {
    id:'lago-sorapis', category:'Via ferrata', lat:46.546, lng:12.226, name:'Lago di Sorapis Trail', area:"Cortina d'Ampezzo",
    distance:11, elevation:450, hours:'4–5', paid:false, crowds:'busy',
    terrainType:'Rocky, roots, narrow ledges', terrainRank:2,
    surfaceHazards:['Sharp rock sections','Fixed cables on narrow ledges'], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'caution', exposure:true,
    waterSources:[{km:2,label:'Stream crossing'},{km:5,label:'Lake shore'}],
    rifugi:[],
    desc:"A striking turquoise glacial lake, but the path in has narrow, exposed sections with fixed cables in places.",
    tips:"Only for sure-footed, confident dogs — this is not a beginner trail despite how popular it is."
  },
  {
    id:'valley-view', category:'Loops', lat:46.64, lng:11.72, name:'Valley View Trail (partial)', area:'Near Val di Funes',
    distance:8, elevation:150, hours:'2–3', paid:false, crowds:'quiet',
    terrainType:'Packed dirt, meadow', terrainRank:0,
    surfaceHazards:[], shadeCoverage:35, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:1,label:'Creek'},{km:4,label:'Farm fountain'}],
    rifugi:[],
    desc:"A quiet, little-known trail through meadows, creeks, and small farms — a mellow rest-day walk away from the crowds.",
    tips:"Part of a much longer 35 km route; pick one section rather than attempting the whole thing."
  },
  {
    id:'durrenstein', category:'Via ferrata', lat:46.71, lng:12.13, name:'Plätzwiese to Dürrenstein', area:'Fanes-Sennes-Prags',
    distance:10, elevation:600, hours:'4–5', paid:false, crowds:'quiet',
    terrainType:'Rocky ridge, fixed rope section', terrainRank:2,
    surfaceHazards:['Fixed rope section near the summit','Exposed ridge'], shadeCoverage:5, heatRisk:'high', safetyLevel:'caution', exposure:true,
    waterSources:[],
    rifugi:[{km:0,name:'Rifugio Prato Piazza'}],
    desc:"A dramatic ridge hike to a Dolomite panorama, with one short section equipped with a fixed rope near the top.",
    tips:"Stop at the secondary summit if your dog isn't confident on exposed rock — the view is still superb from there."
  },
  {
    id:'piancavallo', category:'Loops', lat:46.093, lng:12.43, name:'Piancavallo Malghe Loop', area:'Friulian Dolomites, Pordenone',
    distance:8.2, elevation:210, hours:'2–2.5', paid:false, crowds:'quiet',
    terrainType:'Packed dirt & gravel pasture track', terrainRank:1,
    surfaceHazards:[], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:2,label:'Waterfall stream'},{km:5,label:'Malga fountain'}],
    rifugi:[{km:5,name:'Malga di Piancavallo'}],
    desc:"Rolling mountain pastures in the quieter Friulian Dolomites, passing a waterfall along the way.",
    tips:"A good pick if you want real mountain scenery without the Val Gardena / Cortina crowds."
  },
  {
    id:'lago-barcis', category:'Kid + dog friendly', lat:46.25, lng:12.57, name:'Lake Barcis Loop', area:'Friulian Dolomites, Pordenone',
    distance:5, elevation:60, hours:'1.5', paid:false, crowds:'quiet',
    terrainType:'Paved / packed gravel, flat', terrainRank:0,
    surfaceHazards:[], shadeCoverage:30, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Lakeside fountain'}],
    rifugi:[],
    desc:"An easy loop around an emerald-green lake with mountain views — relaxed and dog-friendly start to finish.",
    tips:"The nearby Dint Skywalk viewing platform may not allow dogs — plan to skip it if hiking with yours."
  },
];
