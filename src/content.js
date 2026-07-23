// content.js — the PORTFOLIO CONTENT, kept separate from the engine and from the
// UI strings (lang.js). This is the only file to edit to change *what* the world
// says about Augustin, his projects and his path. Pure data: no Three.js, no DOM.
//
// POIS[cityId][poiId] = (lang) => { kicker, title, body, meta?, links? }
//   kicker — small italic category line   ·   title — the landmark's name
//   body   — one or two short sentences   ·   meta  — [[label, value], …]
//   links  — [[label, href], …]
// CITY_LABELS[cityId] = (lang) => [name, subtitle]  — the floating plaque.

// ── Evocative extras for field notes ────────────────────────────────────────
// A note may carry ONE `figure` (trusted inline SVG / <img>) and/or a `code`
// snippet — kept here, language-neutral, so both FR/EN branches share one copy.
// SVGs are hand-drawn line-art in the site's ink palette so they sit on parchment;
// code is faithful to the real API (see apairo_visu README) or a clearly generic
// contract, never an invented framework call.

// Apairo — the lazy, composable pipeline (real apairo API).
const CODE_APAIRO = `import apairo

ds = apairo.Goose3DDataset("/data/goose")
ds = ds.synchronize(reference="lidar")
ds.transform("lidar", ground_height, output="ground")
train = ds.filter(valid_idx)   # a lazy view, not a copy`;

// Toaster — the pluggable-segmenter contract (generic, not a claimed API).
const CODE_TOASTER = `# points in, one label per point
def segment(points, seed_idx):
    return dbscan(points, eps=0.5)   # or a model, CSF…`;

// Apairo — four sensor streams (each at its own rate) synchronized onto one clock.
const FIG_APAIRO_SYNC = `<svg viewBox="0 0 280 104" role="img" aria-label="Four sensor streams synchronized onto one reference clock">
  <g font-family="EB Garamond, serif" font-size="7.5" fill="#8B6845">
    <text x="2" y="19">lidar</text><text x="2" y="39">cam</text><text x="2" y="59">imu</text><text x="2" y="79">pose</text>
  </g>
  <g stroke-width="2.2" stroke-linecap="round" fill="none">
    <line x1="32" y1="16" x2="150" y2="16" stroke="#44aa99" stroke-dasharray="2.2 11"/>
    <line x1="32" y1="36" x2="150" y2="36" stroke="#88ccee" stroke-dasharray="2.2 4"/>
    <line x1="32" y1="56" x2="150" y2="56" stroke="#cc6677" stroke-dasharray="2.2 2.2"/>
    <line x1="32" y1="76" x2="150" y2="76" stroke="#57a957" stroke-dasharray="2.2 8"/>
  </g>
  <g stroke="#2C1A0E" stroke-width="1" fill="none" opacity="0.45">
    <path d="M150 16 L179 43"/><path d="M150 36 L179 45"/><path d="M150 56 L179 49"/><path d="M150 76 L179 51"/>
  </g>
  <circle cx="192" cy="47" r="13" fill="#dda42a" stroke="#2C1A0E" stroke-width="1.5"/>
  <g stroke="#2C1A0E" stroke-width="1.3" stroke-linecap="round"><line x1="192" y1="47" x2="192" y2="39"/><line x1="192" y1="47" x2="198" y2="50"/></g>
  <line x1="205" y1="47" x2="227" y2="47" stroke="#2C1A0E" stroke-width="1.5"/>
  <path d="M223 43 l6 4 -6 4" fill="none" stroke="#2C1A0E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="231" y="38" width="19" height="18" rx="2" fill="none" stroke="#2C1A0E" stroke-width="1.5"/>
  <g font-family="EB Garamond, serif" font-size="7.5" fill="#5C3D20" text-anchor="middle"><text x="192" y="73">sync</text><text x="240" y="71">frame</text></g>
</svg>`;

// Splasher — a bird's-eye grid, a drivable corridor labelled cell by cell.
const FIG_SPLASHER_BEV = `<svg viewBox="0 0 200 128" role="img" aria-label="Bird's-eye grid with a drivable corridor labelled cell by cell">
  <g fill="#00d8ff" opacity="0.32">
    <rect x="80" y="88" width="20" height="20"/><rect x="80" y="68" width="20" height="20"/><rect x="100" y="68" width="20" height="20"/><rect x="100" y="48" width="20" height="20"/><rect x="120" y="48" width="20" height="20"/><rect x="120" y="28" width="20" height="20"/><rect x="140" y="28" width="20" height="20"/><rect x="140" y="8" width="20" height="20"/>
  </g>
  <g stroke="#2C1A0E" stroke-width="0.8" opacity="0.5">
    <line x1="20" y1="8" x2="180" y2="8"/><line x1="20" y1="28" x2="180" y2="28"/><line x1="20" y1="48" x2="180" y2="48"/><line x1="20" y1="68" x2="180" y2="68"/><line x1="20" y1="88" x2="180" y2="88"/><line x1="20" y1="108" x2="180" y2="108"/>
    <line x1="20" y1="8" x2="20" y2="108"/><line x1="40" y1="8" x2="40" y2="108"/><line x1="60" y1="8" x2="60" y2="108"/><line x1="80" y1="8" x2="80" y2="108"/><line x1="100" y1="8" x2="100" y2="108"/><line x1="120" y1="8" x2="120" y2="108"/><line x1="140" y1="8" x2="140" y2="108"/><line x1="160" y1="8" x2="160" y2="108"/><line x1="180" y1="8" x2="180" y2="108"/>
  </g>
  <path d="M90 109 l0 9 M84 118 l6 -6 6 6" fill="none" stroke="#2C1A0E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Projector — the triple bill: 3D cloud, 2D camera, top-down BEV, all in step.
const FIG_PROJECTOR_SCREENS = `<svg viewBox="0 0 280 92" role="img" aria-label="Three synchronized screens: 3D cloud, 2D camera, top-down BEV">
  <g fill="#d4af37"><rect x="6" y="8" width="78" height="5"/><rect x="101" y="8" width="78" height="5"/><rect x="196" y="8" width="78" height="5"/></g>
  <g stroke="#2C1A0E" stroke-width="1.5" fill="none"><rect x="6" y="8" width="78" height="60" rx="2"/><rect x="101" y="8" width="78" height="60" rx="2"/><rect x="196" y="8" width="78" height="60" rx="2"/></g>
  <g fill="#5C3D20"><circle cx="22" cy="54" r="1.4"/><circle cx="30" cy="46" r="1.4"/><circle cx="36" cy="59" r="1.4"/><circle cx="43" cy="41" r="1.4"/><circle cx="49" cy="52" r="1.4"/><circle cx="56" cy="61" r="1.4"/><circle cx="61" cy="47" r="1.4"/><circle cx="69" cy="55" r="1.4"/><circle cx="31" cy="32" r="1.4"/><circle cx="47" cy="30" r="1.4"/><circle cx="59" cy="35" r="1.4"/><circle cx="71" cy="42" r="1.4"/></g>
  <circle cx="166" cy="26" r="3" fill="#d4af37"/>
  <g stroke="#5C3D20" stroke-width="1.2" fill="none"><line x1="107" y1="50" x2="173" y2="50"/><rect x="126" y="38" width="16" height="12"/></g>
  <g stroke="#5C3D20" stroke-width="0.8" opacity="0.7" fill="none"><line x1="206" y1="20" x2="264" y2="20"/><line x1="206" y1="38" x2="264" y2="38"/><line x1="206" y1="56" x2="264" y2="56"/><line x1="206" y1="20" x2="206" y2="56"/><line x1="225" y1="20" x2="225" y2="56"/><line x1="244" y1="20" x2="244" y2="56"/><line x1="264" y1="20" x2="264" y2="56"/></g>
  <rect x="225" y="38" width="19" height="18" fill="#00d8ff" opacity="0.32"/>
  <g font-family="EB Garamond, serif" font-size="8" fill="#5C3D20" text-anchor="middle"><text x="45" y="83">3D</text><text x="140" y="83">2D</text><text x="235" y="83">BEV</text></g>
</svg>`;

export const CITY_LABELS = {
  apairo: (l) => l === 'fr' ? ['Apairo', 'Données Robotique'] : ['Apairo', 'Robotics Data'],
  toaster: (l) => l === 'fr' ? ['Toaster', 'Annotation 3D'] : ['Toaster', '3D Annotation'],
  splasher: (l) => l === 'fr' ? ['Splasher', 'Étiquetage BEV'] : ['Splasher', 'BEV Labeling'],
  projector: (l) => l === 'fr' ? ['Projector', "Moteur d'Affichage 3D/2D"] : ['Projector', '3D/2D Display Engine'],
  about: (l) => l === 'fr' ? ['Origin', "L'Inventeur"] : ['Origin', 'The Inventor'],
  rubicon: (l) => l === 'fr' ? ['Rubicon', 'Bijouterie & ERP'] : ['Rubicon', 'Jewelry & ERP'],
};

// each settlement's signature accent (portal/label/legend), so the legend dot, the
// city beacon and the field notes all speak the same colour language.
export const CITY_ACCENT = {
  apairo: '#dda42a', toaster: '#e10600', splasher: '#00d8ff', projector: '#d4af37', about: '#c4763a',
  rubicon: '#a56cc1',
};

// CITY_LINKS[cityId] = (lang) => [[label, href], …] — the "front doors" of a project,
// surfaced in a side panel while a settlement is in focus (see ui.js showCityLinks).
// Curated, 2–4 primary destinations per city — NOT every sub-repo. Return [] to hide
// the panel (Rubicon is client work, its code is never shared).
export const CITY_LINKS = {
  apairo: (l) => [
    ['Site', 'https://apairo-robotics.github.io/'],
    // the ORG, not the core repo — one row surfaces the whole ecosystem
    // (apairo, extractor, transform, preprocess, apairo_visu, …)
    ['GitHub', 'https://github.com/apairo-robotics'],
  ],
  toaster: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://huggingface.co/spaces/SmaugC137/toaster'],
    ['GitHub', 'https://github.com/augustin-bresset/toaster'],
  ],
  splasher: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://huggingface.co/spaces/SmaugC137/splasher'],
    ['GitHub', 'https://github.com/augustin-bresset/splasher'],
  ],
  projector: (l) => [
    [l === 'fr' ? 'Démo' : 'Demo', 'https://projector-demo.onrender.com'],
    ['GitHub', 'https://github.com/augustin-bresset/projector'],
  ],
  about: (l) => [
    ['Email', 'mailto:augustin.bresset@polytechnique.edu'],
    ['GitHub', 'https://github.com/augustin-bresset'],
    ['LinkedIn', 'https://www.linkedin.com/in/augustin-b-3a0546142/'],
  ],
  rubicon: (l) => [],   // client code, never shared publicly — panel stays hidden
};

export const POIS = {
  // the croquis sky: notes pinned to the themed hot-air balloons drifting by.
  // Clicking a balloon opens a short card pointing back to the real project.
  croquis: {
    toast: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Toaster',
      body: "L'atelier d'annotation LiDAR 3D : sélectionnez, un segmenter étiquette l'objet entier en un clic.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: 'Balloon · Project', title: 'Toaster',
      body: 'The 3D LiDAR annotation workshop: select, and a segmenter labels the whole object in one click.',
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    },
    splash: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Splasher',
      body: "Étiquetage multi-capteurs synchronisé sur grille vue-du-ciel — nuage de points, caméras et BEV en phase.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Balloon · Project', title: 'Splasher',
      body: "Synchronized multi-sensor labeling on a bird's-eye grid — point cloud, cameras and BEV in step.",
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
    apairo: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Apairo',
      body: "La fabrique de données robotique : un cadre Python qui unifie les datasets hétérogènes (LiDAR, IMU, caméras).",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    } : {
      kicker: 'Balloon · Project', title: 'Apairo',
      body: 'The robotics data factory: a Python framework unifying heterogeneous datasets (LiDAR, IMU, cameras).',
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    },
    gear: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · L\'atelier', title: 'Origin',
      body: "L'inventeur derrière tout ça — parcours, projets et le reste de l'archipel se visitent sur la carte.",
      links: [['GitHub ↗', 'https://github.com/augustin-bresset']],
    } : {
      kicker: 'Balloon · The workshop', title: 'Origin',
      body: 'The inventor behind it all — the path, the projects and the rest of the archipelago live on the map.',
      links: [['GitHub ↗', 'https://github.com/augustin-bresset']],
    },
    projector: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Projet', title: 'Projector',
      body: "Le moteur d'affichage 3D et 2D partagé — nuages de points et caméras rendus en direct. Il fait tourner l'affichage de Toaster, Splasher et apairo studio.",
      links: [['Démo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    } : {
      kicker: 'Balloon · Project', title: 'Projector',
      body: 'The shared 3D & 2D display engine — point clouds and cameras rendered live. It powers the display in Toaster, Splasher and apairo studio.',
      links: [['Demo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    },
    rubicon: (l) => l === 'fr' ? {
      kicker: 'Montgolfière · Expérience', title: 'Rubicon',
      body: "Stage solo à Bangkok : migration complète d'un ERP de bijouterie vers Odoo 18, 25 modules sur-mesure.",
    } : {
      kicker: 'Balloon · Experience', title: 'Rubicon',
      body: 'A solo internship in Bangkok: a full jewelry-manufacturer ERP migration to Odoo 18, 25 custom modules.',
    },
  },

  about: {
    polytechnique: (l) => l === 'fr' ? {
      kicker: 'Formation · 2025–26', title: 'École Polytechnique',
      body: "M.Sc. Data Science, spécialité Probabilités, Statistiques & Optimisation.",
      meta: [['Cours', 'Apprentissage par renforcement · Deep learning · Chaînes de Markov & Monte-Carlo · Optimisation convexe & entière · Hackathon (Hi!ckathon)']],
    } : {
      kicker: 'Education · 2025–26', title: 'École Polytechnique',
      body: 'M.Sc. Data Science, concentration in Probability, Statistics & Optimization.',
      meta: [['Courses', 'Reinforcement learning · Deep learning · Markov chains & Monte-Carlo · Convex & integer optimization · Hackathon (Hi!ckathon)']],
    },
    prepa: (l) => l === 'fr' ? {
      kicker: 'Classe préparatoire · 2020–22', title: 'Lycée Saint-Louis',
      body: "Classe préparatoire aux concours des grandes écoles, MP option Informatique.",
    } : {
      kicker: 'Prep school · 2020–22', title: 'Lycée Saint-Louis',
      body: "Classe préparatoire (competitive-exam track to France's top engineering schools), MP track with a Computer Science option.",
    },
    telecom: (l) => l === 'fr' ? {
      kicker: 'Formation · 2022–26', title: 'Télécom SudParis',
      body: "Cycle ingénieur, majeure Data Science & Intelligence Artificielle, spécialisation 3A Modélisation et Statistique Appliquée.",
      meta: [
        ['Cours', 'Processus stochastiques · Réseaux de neurones · Apprentissage par renforcement'],
        ['Vie associative', "Bureau des Internationaux (trésorier) · Intech, le club de robotique (chef de projet puis responsable de sa participation à la course de voiture autonome de l'ENS)"],
      ],
    } : {
      kicker: 'Education · 2022–26', title: 'Télécom SudParis',
      body: 'Engineering degree (M.Eng.), major in Data Science & Artificial Intelligence, 3rd-year specialization in Applied Statistical Modeling.',
      meta: [
        ['Coursework', 'Stochastic processes · Neural networks · Reinforcement learning'],
        ['Student life', "International Students' Office (treasurer) · Intech, the robotics club (project lead, then head of its entry in the ENS autonomous-car race)"],
      ],
    },
    upfund: (l) => l === 'fr' ? {
      kicker: 'Stage · 2023', title: 'Upfund',
      body: "Stage de première année : une carte intelligente pilotée par un LLM — « trouve-moi les restaurants à moins de 50 m de la Seine à Paris » devient directement des points sur la carte, via OpenStreetMap et Overpass Turbo.",
    } : {
      kicker: 'Internship · 2023', title: 'Upfund',
      body: 'First-year internship: a smart map driven by an LLM interpreter — "find me restaurants within 50m of the Seine in Paris" turns straight into pins on the map, via OpenStreetMap and Overpass Turbo.',
    },
    ensta: (l) => l === 'fr' ? {
      kicker: 'Recherche · 2024–25', title: 'ENSTA Paris',
      body: "Stage de recherche en SLAM LiDAR-IMU — mais l'essentiel du temps est parti dans la structure : concevoir l'architecture d'Apairo a pris plus de temps que la recherche. La graine de tout l'écosystème.",
    } : {
      kicker: 'Research · 2024–25', title: 'ENSTA Paris',
      body: "Research internship on LiDAR-IMU SLAM — but most of the time went into the structure: designing Apairo's architecture took longer than the research itself. The seed of the whole ecosystem.",
    },
    enstapfe: (l) => l === 'fr' ? {
      kicker: 'Recherche · PFE · avril–août 2026', title: 'ENSTA Paris — Barakuda',
      body: "De retour à ENSTA pour le PFE : des modèles de traversabilité par LiDAR, passés au crible de dizaines de configurations — apprentissage faiblement supervisé, pertes pondérées, approches par graphe, voxels contre pillars. Le terrain d'essai était le sien : des mois à piloter Barakuda, un rover, à travers forêts, hautes herbes et collines pour enregistrer ses propres données.",
      meta: [
        ['Étiquetage', 'Nuages de points annotés avec ses propres outils — Toaster, Splasher — et relus dans Projector'],
        ['Infrastructure & open-source', "L'environnement Apairo enfin achevé, pour que chaque expérience se rejoue à l'identique · contributions à TorchSparse et au jeu de données TartanDrive v2"],
      ],
    } : {
      kicker: 'Research · Final-year internship · Apr–Aug 2026', title: 'ENSTA Paris — Barakuda',
      body: 'Back at ENSTA for his final-year research internship: LiDAR traversability models, benchmarked across dozens of configurations — weakly-supervised learning, weighted losses, graph-based approaches, voxels versus pillars. The test ground was his own: months spent driving Barakuda, a rover, through forests, tall grass and hills to record his own data.',
      meta: [
        ['Labeling', 'Point clouds annotated with his own tools — Toaster, Splasher — reviewed in Projector'],
        ['Infrastructure & open-source', 'Finally finished the Apairo environment, so every experiment replays identically · contributed to TorchSparse and the TartanDrive v2 dataset'],
      ],
    },
    rubicon: (l) => l === 'fr' ? {
      kicker: 'Expérience · 2025–26', title: 'Rubicon · Bangkok',
      body: "Stage ingénieur logiciel, seul sur le projet : migration complète de l'ERP vers Odoo 18 pour un fabricant de bijoux (~40 employés) — 25 modules sur-mesure et un pipeline d'import automatisé depuis l'ancien système. Sa propre ville sur la carte →",
    } : {
      kicker: 'Experience · 2025–26', title: 'Rubicon · Bangkok',
      body: 'Software engineering intern, solo on the project: full ERP migration to Odoo 18 for a jewelry manufacturer (~40 staff) — 25 custom modules and an automated import pipeline from the old legacy system. Has its own city on the map →',
    },
    contact: (l) => l === 'fr' ? {
      kicker: 'Dire bonjour', title: 'Augustin Bresset',
      body: "Data Scientist & Ingénieur, Paris. Pas à la recherche de nouvelles opportunités pour l'instant — plutôt concentré sur la poursuite de son chemin en recherche, du côté du deep learning.",
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    } : {
      kicker: 'Say hello', title: 'Augustin Bresset',
      body: 'Data Scientist & Engineer, Paris. Not currently looking for new opportunities — focused instead on continuing down the research path, in deep learning.',
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    },
  },

  apairo: {
    hall: (l) => l === 'fr' ? {
      kicker: 'Open-source · Données robotique', title: 'Apairo',
      body: "Un écosystème open-source qui unifie les datasets robotiques hétérogènes — du brut aux tenseurs prêts à l'entraînement. Tout se compose paresseusement, sans rien réécrire sur le disque :",
      code: CODE_APAIRO,
      links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/apairo-robotics/apairo']],
    } : {
      kicker: 'Open-source · Robotics data', title: 'Apairo',
      body: 'An open-source ecosystem that unifies heterogeneous robotics datasets — from raw to training-ready tensors. Everything composes lazily, nothing rewritten to disk:',
      code: CODE_APAIRO,
      links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/apairo-robotics/apairo']],
    },
    extract: (l) => l === 'fr' ? {
      kicker: 'Brique · Ingestion', title: 'Extractor',
      body: "La porte d'entrée : décharge les enregistrements bruts — rosbags, KITTI, formats maison — et en tire des flux propres, un par capteur.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_extractor']],
    } : {
      kicker: 'Brick · Ingestion', title: 'Extractor',
      body: 'The front door: unloads raw recordings — rosbags, KITTI, custom formats — and draws out clean streams, one per sensor.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_extractor']],
    },
    transform: (l) => l === 'fr' ? {
      kicker: 'Brique · À la volée', title: 'Transform',
      body: "Adapte les données au moment où on les lit — repères, filtres, projections — pour les brancher sur n'importe quelle autre brique, sans jamais rien écrire sur le disque.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_transform']],
    } : {
      kicker: 'Brick · On the fly', title: 'Transform',
      body: 'Adapts the data at the moment it is read — frames, filters, projections — so it plugs into any other brick, without ever writing to disk.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_transform']],
    },
    preprocess: (l) => l === 'fr' ? {
      kicker: 'Brique · Une seule passe', title: 'Preprocess',
      body: "Les calculs lourds — odométrie, segmentation du sol, labels — tournent une seule fois ; leurs résultats sont persistés et rechargent ensuite gratuitement.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_preprocess']],
    } : {
      kicker: 'Brick · Run once', title: 'Preprocess',
      body: 'The heavy computations — odometry, ground segmentation, labels — run exactly once; their results persist and reload for free ever after.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_preprocess']],
    },
    visualize: (l) => l === 'fr' ? {
      kicker: 'Brique · Inspection', title: 'Visualize',
      body: "Regroupe deux visualiseurs sous un même toit : apairo rerun et apairo studio — nuages de points, images et trajectoires synchronisés côte à côte, pour explorer n'importe quel dataset et le voir de ses propres yeux.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_visu']],
    } : {
      kicker: 'Brick · Inspection', title: 'Visualize',
      body: 'Bundles two viewers under one roof: apairo rerun and apairo studio — point clouds, images and trajectories synced side by side, to explore any dataset and see it with your own eyes.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_visu']],
    },
    silos: (l) => l === 'fr' ? {
      kicker: 'En aval', title: 'Cache & Découpes',
      body: "La suite du voyage : les canaux dérivés (odométrie, sol, labels) se calculent une fois puis sont mis en cache à côté des données ; les découpes train/val/test ne sont que des vues légères — quelques Ko d'indices sur des gigaoctets.",
    } : {
      kicker: 'Downstream', title: 'Cache & Splits',
      body: 'The journey continues: derived channels (odometry, ground, labels) are computed once then cached beside the data; train/val/test splits are just lightweight views — a few KB of indices over gigabytes.',
    },
    conveyor: (l) => l === 'fr' ? {
      kicker: 'Le voyage des données', title: 'Les Voies',
      body: "Un rosbag arrive : l'extracteur le décharge, le préprocess le nettoie, puis la synchronisation aligne chaque capteur — à sa propre fréquence — sur une même horloge. Les trames hors tolérance sont écartées, jamais maquillées.",
      figure: FIG_APAIRO_SYNC, caption: 'Quatre flux, un même temps.',
    } : {
      kicker: "The data's journey", title: 'The Lanes',
      body: 'A rosbag arrives: the extractor unloads it, preprocessing cleans it, then synchronization aligns every sensor — each at its own rate — onto one clock. Frames beyond tolerance are set aside, never faked.',
      figure: FIG_APAIRO_SYNC, caption: 'Four streams, one clock.',
    },
    pier: (l) => l === 'fr' ? {
      kicker: "Né à l'ENSTA · 2024", title: 'Sorti du labo',
      body: "Né comme outil de stage de recherche à l'ENSTA Paris, désormais un écosystème complet — extraction, préprocess, synchronisation, transformation, visualisation — au service de l'apprentissage de la traversabilité.",
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    } : {
      kicker: 'Born at ENSTA · 2024', title: 'Out of the Lab',
      body: 'Started as a research-internship tool at ENSTA Paris, now a complete ecosystem — extraction, preprocessing, synchronization, transformation, visualization — feeding traversability learning research.',
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    },
  },

  toaster: {
    stage: (l) => l === 'fr' ? {
      kicker: 'LiDAR 3D · Annotation', title: 'Toaster',
      body: "Étiqueter des nuages de points 3D le plus vite possible : vous sélectionnez, le segmenter fait le reste — un objet entier labellisé en un clic.",
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: '3D LiDAR · Annotation', title: 'Toaster',
      body: 'Label 3D point clouds as fast as possible: you select, the segmenter does the rest — a whole object labelled in one click.',
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    },
    landmark: (l) => l === 'fr' ? {
      kicker: 'Sélection', title: 'Point · Boîte · Voxel',
      body: "Trois façons de saisir les points : un par un, à la boîte englobante, ou par grille de voxels — selon la scène et la précision voulue.",
    } : {
      kicker: 'Selection', title: 'Point · Box · Voxel',
      body: 'Three ways to grab points: one by one, by bounding box, or on a voxel grid — whichever fits the scene and the precision you need.',
    },
    clustering: (l) => l === 'fr' ? {
      kicker: 'Sous le capot', title: 'Segmenters à la carte',
      body: "N'importe quel segmenter se branche : il reçoit les points, il rend un label par point. Le reste — sélection, rendu 3D — ne bouge pas.",
      code: CODE_TOASTER,
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
    } : {
      kicker: 'Under the hood', title: 'Pluggable Segmenters',
      body: 'Any segmenter plugs in: it takes the points, it returns one label per point. Everything else — selection, 3D rendering — stays put.',
      code: CODE_TOASTER,
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
    },
  },

  splasher: {
    table: (l) => l === 'fr' ? {
      kicker: 'BEV · Multi-capteurs', title: 'Splasher',
      body: "Étiquetage multi-capteurs synchronisé sur grille vue-du-ciel : nuage de points, panneaux caméra et vue BEV de dessus, en phase.",
    } : {
      kicker: 'BEV · Multi-sensor', title: 'Splasher',
      body: "Synchronized multi-sensor labeling on a bird's-eye grid: point cloud, camera panels and a top-down BEV view, in sync.",
    },
    mast: (l) => l === 'fr' ? {
      kicker: 'Modalités', title: 'Pile de Capteurs',
      body: "LiDAR, caméra et grille BEV recalés ensemble : étiquetez une fois, voyez-le dans chaque vue.",
    } : {
      kicker: 'Modalities', title: 'Sensor Stack',
      body: 'LiDAR, camera and BEV grid registered together: label once, see it across every view.',
    },
    towers: (l) => l === 'fr' ? {
      kicker: 'Conçu pour', title: 'Traversabilité',
      body: "La tâche phare : marquer cellule par cellule ce qui est franchissable — la précision dont un robot a besoin pour choisir sa route.",
      figure: FIG_SPLASHER_BEV, caption: 'Franchissable, cellule par cellule.',
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Built for', title: 'Traversability',
      body: "The flagship task: mark cell by cell what's drivable — the precision a robot needs to choose its way.",
      figure: FIG_SPLASHER_BEV, caption: 'Drivable, cell by cell.',
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
  },

  projector: {
    marquee: (l) => l === 'fr' ? {
      kicker: 'Moteur · Affichage 3D/2D', title: 'Projector',
      body: "Le moteur de rendu qui affiche les données robotiques — nuages de points 3D, caméras 2D, vues du ciel — de façon fluide et synchronisée, réglages en direct. C'est lui qui fait tourner l'affichage de Toaster, Splasher et apairo studio : un seul moteur de rendu, réutilisé partout.",
      links: [['Démo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    } : {
      kicker: 'Engine · 3D/2D Display', title: 'Projector',
      body: "The rendering engine that draws robotics data — 3D point clouds, 2D cameras, bird's-eye views — smoothly and in sync, tuned live. It's what powers the display in Toaster, Splasher and apairo studio: one rendering engine, reused everywhere.",
      links: [['Demo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    },
    screens: (l) => l === 'fr' ? {
      kicker: 'Vues parallèles', title: 'La Triple Séance',
      body: "Trois écrans en phase : nuage 3D, caméra 2D, vue du ciel BEV. Les réglages d'affichage se changent en direct — jamais d'aller-retour serveur pendant la lecture.",
      figure: FIG_PROJECTOR_SCREENS, caption: '3D · 2D · BEV, en phase.',
    } : {
      kicker: 'Parallel views', title: 'The Triple Bill',
      body: 'Three screens in step: 3D cloud, 2D camera, top-down BEV. Display settings change live — never a server round-trip during playback.',
      figure: FIG_PROJECTOR_SCREENS, caption: '3D · 2D · BEV, in step.',
    },
    booth: (l) => l === 'fr' ? {
      kicker: 'La séance critique', title: 'Le Guichet des Confusions',
      body: "Deux étiquetages, une bobine verte et une rouge : vrai/faux positifs et négatifs colorent chaque point, précision/rappel/IoU recalculés en direct. Mais la cabine ne fait pas que comparer — elle rejoue aussi n'importe quelle transformation (repère, filtre, projection) directement sur la scène, pour voir l'effet avant de le garder.",
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    } : {
      kicker: "The critics' screening", title: 'The Confusion Booth',
      body: "Two labelings, one green reel and one red: true/false positives and negatives colour every point, precision/recall/IoU recomputed live. But the booth doesn't just compare — it also replays any transformation (frame, filter, projection) directly on the scene, so you see the effect before you keep it.",
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    },
  },

  rubicon: {
    tower: (l) => l === 'fr' ? {
      kicker: 'Stage solo · Bangkok, 2025–26', title: 'Rubicon',
      body: "Une manufacture de bijoux franco-thaïlandaise (~40 salariés), qui vend à travers les grands salons professionnels internationaux. Envoyé seul pour toute la mission : un mois d'audit complet d'abord — le poste de chacun, tous les processus métier, l'usage de chaque logiciel vue par vue, action par action — puis la reconstruction de chaque outil sur Odoo 18, modernisé sans jamais perdre l'utilisateur : mêmes repères, sans jamais arrêter la production.",
      meta: [['Rôle', 'Ingénieur logiciel — audit puis développement, seul du début à la fin'], ['Durée', '13 mois, toujours actif']],
    } : {
      kicker: 'Solo internship · Bangkok, 2025–26', title: 'Rubicon',
      body: 'A Franco-Thai jewelry manufacturer (~40 staff) selling through major international trade fairs. Sent alone for the whole mission: a month-long full audit first — every role, every business process, every piece of software in use, view by view and action by action — then rebuilding each tool on Odoo 18, modernized without ever losing the user: same landmarks, without ever stopping production.',
      meta: [['Role', 'Software engineer — audit, then development, solo start to finish'], ['Duration', '13 months, still active']],
    },
    atelier: (l) => l === 'fr' ? {
      kicker: 'PDP & Suivi de production', title: "L'Atelier",
      body: "Le back-office de l'atelier : catalogue de pierres, cours du jour des métaux, coûts de façon, moteur de calcul de prix, gestion des modèles et variantes. Et sur le plancher de production : lecteur code-barres à chaque poste, temps et poids contrôlés en direct.",
      meta: [['Échelle', 'Des tables de +100 000 lignes — pierres, produits, modèles']],
    } : {
      kicker: 'PDP & Production Tracking', title: 'The Atelier',
      body: "The atelier's back office: a stone catalog, daily metal market prices, labor costing, a price-computation engine, model & variant management. And on the shop floor: a barcode reader at every station, time and weight checked live.",
      meta: [['Scale', 'Tables with 100,000+ rows — stones, products, models']],
    },
    ledger: (l) => l === 'fr' ? {
      kicker: 'SIS · Ventes', title: 'Le Comptoir',
      body: "Devis, commandes, factures, clients et fournisseurs — et une analyse croisée dynamique des ventes par salon, région et pays, exportable en un clic vers Excel.",
      meta: [['Échelle', '247 893 compositions pierre-produit importées']],
    } : {
      kicker: 'SIS · Sales', title: 'The Trading Post',
      body: 'Quotations, orders, invoices, clients and vendors — plus a pivot sales-analysis tool sliced by trade fair, region and country, one click from an Excel export.',
      meta: [['Scale', '247,893 stone-to-product compositions imported']],
    },
    roots: (l) => l === 'fr' ? {
      kicker: 'Migration · Sous le parvis', title: 'Les Racines',
      body: "Sous le parvis envahi de lianes dort encore JMS : plus de vingt ans d'activité en MS-SQL, chaque bijou lié à ses pierres, son historique de prix, ses commandes, ses clients. Un pipeline d'import a remonté toute cette toile vers Odoo — jusqu'aux 3,3 Go de photos produit — sans casser un seul lien, sans jamais interrompre la production.",
    } : {
      kicker: 'Migration · Beneath the forecourt', title: 'The Roots',
      body: 'Below the vine-choked forecourt, JMS still sleeps: twenty-plus years of activity in MS-SQL, every piece of jewelry linked to its stones, its price history, its orders, its clients. An import pipeline pulled that whole web up into Odoo — down to 3.3GB of product photos — without breaking a single link, without ever stopping production.',
    },
  },
};
