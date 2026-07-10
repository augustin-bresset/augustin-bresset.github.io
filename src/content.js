// content.js — the PORTFOLIO CONTENT, kept separate from the engine and from the
// UI strings (lang.js). This is the only file to edit to change *what* the world
// says about Augustin, his projects and his path. Pure data: no Three.js, no DOM.
//
// POIS[cityId][poiId] = (lang) => { kicker, title, body, meta?, links? }
//   kicker — small italic category line   ·   title — the landmark's name
//   body   — one or two short sentences   ·   meta  — [[label, value], …]
//   links  — [[label, href], …]
// CITY_LABELS[cityId] = (lang) => [name, subtitle]  — the floating plaque.

export const CITY_LABELS = {
  apairo: (l) => l === 'fr' ? ['Apairo', 'Données Robotique'] : ['Apairo', 'Robotics Data'],
  toaster: (l) => l === 'fr' ? ['Toaster', 'Annotation 3D'] : ['Toaster', '3D Annotation'],
  splasher: (l) => l === 'fr' ? ['Splasher', 'Étiquetage BEV'] : ['Splasher', 'BEV Labeling'],
  projector: (l) => l === 'fr' ? ['Projector', 'Relecture Multi-Capteurs'] : ['Projector', 'Multi-Sensor Replay'],
  about: (l) => l === 'fr' ? ['Origin', "L'Inventeur"] : ['Origin', 'The Inventor'],
  rubicon: (l) => l === 'fr' ? ['Rubicon', 'Bijouterie & ERP'] : ['Rubicon', 'Jewelry & ERP'],
};

// each settlement's signature accent (portal/label/legend), so the legend dot, the
// city beacon and the field notes all speak the same colour language.
export const CITY_ACCENT = {
  apairo: '#dda42a', toaster: '#e10600', splasher: '#00d8ff', projector: '#d4af37', about: '#c4763a',
  rubicon: '#a56cc1',
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
  },

  about: {
    polytechnique: (l) => l === 'fr' ? {
      kicker: 'Formation · 2025–26', title: 'École Polytechnique',
      body: "M.Sc. Data Science, spécialité Probabilités, Statistiques & Optimisation.",
      meta: [['Cours', 'Apprentissage par renforcement · Monte-Carlo · Analyse convexe · Statistique en grande dimension']],
    } : {
      kicker: 'Education · 2025–26', title: 'École Polytechnique',
      body: 'M.Sc. Data Science, concentration in Probability, Statistics & Optimization.',
      meta: [['Courses', 'Reinforcement learning · Monte-Carlo · Convex analysis · High-dimensional statistics']],
    },
    telecom: (l) => l === 'fr' ? {
      kicker: 'Formation · 2022–26', title: 'Télécom SudParis',
      body: "Cycle ingénieur, majeure Data Science & Intelligence Artificielle.",
      meta: [['Cours', 'Processus stochastiques · Réseaux de neurones · Renforcement']],
    } : {
      kicker: 'Education · 2022–26', title: 'Télécom SudParis',
      body: 'Engineering degree (M.Eng.), major in Data Science & Artificial Intelligence.',
      meta: [['Courses', 'Stochastic processes · Neural networks · Reinforcement learning']],
    },
    ensta: (l) => l === 'fr' ? {
      kicker: 'Recherche · 2024–25', title: 'ENSTA Paris',
      body: "Stage de recherche en SLAM LiDAR-IMU. Conception d'un framework Python pour unifier des datasets robotiques hétérogènes — la graine d'Apairo.",
    } : {
      kicker: 'Research · 2024–25', title: 'ENSTA Paris',
      body: 'Research intern on LiDAR-IMU SLAM. Built a Python framework to unify heterogeneous robotics datasets — the seed that became Apairo.',
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
      body: "Data Scientist & Ingénieur, Paris. Actuellement ouvert à de nouvelles opportunités.",
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    } : {
      kicker: 'Say hello', title: 'Augustin Bresset',
      body: 'Data Scientist & Engineer, Paris. Currently open to new opportunities.',
      links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
    },
  },

  apairo: {
    hall: (l) => l === 'fr' ? {
      kicker: 'Open-source · Données robotique', title: 'Apairo',
      body: "Un écosystème open-source qui unifie les datasets robotiques hétérogènes : des enregistrements bruts aux tenseurs prêts à l'entraînement. Les deux tours sont l'horloge de référence — tous les capteurs, chacun à sa fréquence, alignés sur un même temps.",
      links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/apairo-robotics/apairo']],
    } : {
      kicker: 'Open-source · Robotics data', title: 'Apairo',
      body: 'An open-source ecosystem that unifies heterogeneous robotics datasets: raw recordings to training-ready tensors. The two towers are the reference clock — every sensor, each at its own rate, aligned onto one time.',
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
      body: "Ouvre n'importe quel dataset dans une visionneuse 3D synchronisée — nuages de points, images et trajectoires côte à côte, pour vérifier de ses yeux.",
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_rr']],
    } : {
      kicker: 'Brick · Inspection', title: 'Visualize',
      body: 'Opens any dataset in a synchronized 3D viewer — point clouds, images and trajectories side by side, to check with your own eyes.',
      links: [['GitHub ↗', 'https://github.com/apairo-robotics/apairo_rr']],
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
      body: "Un paquet de données arrive en rosbag : l'extracteur le décharge, le préprocess le nettoie, puis la synchronisation aligne LiDAR, caméras, IMU et poses — chacun à sa fréquence — sur une même horloge. Les trames hors tolérance sont écartées, jamais maquillées.",
    } : {
      kicker: "The data's journey", title: 'The Lanes',
      body: 'A data package arrives as a rosbag: the extractor unloads it, preprocessing cleans it, then synchronization aligns lidar, cameras, IMU and poses — each at its own rate — onto one clock. Frames beyond tolerance are set aside, never faked.',
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
    } : {
      kicker: '3D LiDAR · Annotation', title: 'Toaster',
      body: 'Label 3D point clouds as fast as possible: you select, the segmenter does the rest — a whole object labelled in one click.',
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
      body: "Branchez vos propres algorithmes : clustering (K-means, DBSCAN, HDBSCAN), détection de sol (CSF)… jusqu'à des modèles de segmentation, sémantique ou non.",
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: 'Under the hood', title: 'Pluggable Segmenters',
      body: 'Plug in your own algorithms: clustering (K-means, DBSCAN, HDBSCAN), ground detection (CSF)… up to full segmentation models, semantic or not.',
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
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
      body: "La tâche phare : marquer cellule par cellule ce qui est franchissable sur la grille vue-du-ciel — la précision dont un robot autonome a besoin pour rouler.",
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Built for', title: 'Traversability',
      body: "The flagship task: mark cell by cell what's drivable on the bird's-eye grid — the precision an autonomous robot needs to move.",
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
  },

  projector: {
    marquee: (l) => l === 'fr' ? {
      kicker: 'Viewer · Multi-capteurs', title: 'Projector',
      body: "Rejoue des séquences robotiques synchronisées, image par image : on scrute la timeline, on dispose les vues en mosaïque, et chaque capteur défile à son propre rythme.",
      links: [['Démo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    } : {
      kicker: 'Viewer · Multi-sensor', title: 'Projector',
      body: 'Replays synchronized robotics sequences, frame by frame: scrub the timeline, dock views into a mosaic, and each sensor plays at its own native rate.',
      links: [['Demo ↗', 'https://projector-demo.onrender.com'], ['GitHub ↗', 'https://github.com/augustin-bresset/projector']],
    },
    screens: (l) => l === 'fr' ? {
      kicker: 'Vues parallèles', title: 'La Triple Séance',
      body: "Trois écrans, un seul capteur ou plusieurs : nuage 3D, caméra 2D, vue du ciel BEV — réglages d'affichage réglés en direct, jamais un aller-retour serveur pendant la lecture.",
    } : {
      kicker: 'Parallel views', title: 'The Triple Bill',
      body: 'Three screens, any channel: 3D cloud, 2D camera, top-down BEV — display settings tuned live, never a server round-trip during playback.',
    },
    booth: (l) => l === 'fr' ? {
      kicker: 'La séance critique', title: 'Le Guichet des Confusions',
      body: "Deux étiquetages, une bobine verte et une rouge : vrai/faux positifs et négatifs colorent chaque point, précision/rappel/IoU recalculés en direct — ne garder que le rouge ne montre que les erreurs du modèle.",
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    } : {
      kicker: "The critics' screening", title: 'The Confusion Booth',
      body: 'Two labelings, one green reel and one red: true/false positives and negatives colour every point, precision/recall/IoU recomputed live — keep only red and just the mistakes remain.',
      meta: [['Stack', 'Python · NumPy · FastAPI · Three.js']],
    },
    lights: (l) => l === 'fr' ? {
      kicker: 'Caméra', title: 'Projecteurs de Poursuite',
      body: "La caméra peut suivre le robot comme un projecteur suit une vedette — orbite libre, mode poursuite verrouillé en translation, ou vue du ciel centrée sur l'ego, trajectoire en surimpression.",
    } : {
      kicker: 'Camera', title: 'Follow Spots',
      body: 'The camera can track the robot like a spotlight follows a star — free orbit, translation-locked follow, or a BEV-follow view centred on ego, trajectory overlaid.',
    },
  },

  rubicon: {
    tower: (l) => l === 'fr' ? {
      kicker: 'Stage solo · Bangkok, 2025–26', title: 'Rubicon',
      body: "Une manufacture de bijoux thaïlandaise (~40 salariés), qui vend à travers les grands salons professionnels internationaux. Envoyé seul pour toute la mission : migrer l'ERP historique — un système MS-SQL maison baptisé JMS — vers Odoo 18, sans jamais arrêter la production.",
      meta: [['Rôle', 'Ingénieur logiciel — seul du début à la fin'], ['Durée', '13 mois, toujours actif']],
    } : {
      kicker: 'Solo internship · Bangkok, 2025–26', title: 'Rubicon',
      body: 'A Thai jewelry manufacturer (~40 staff) selling through major international trade fairs. Sent alone for the whole mission: migrate their legacy ERP — an in-house MS-SQL system called JMS — to Odoo 18, without ever stopping production.',
      meta: [['Role', 'Software engineer — solo start to finish'], ['Duration', '13 months, still active']],
    },
    atelier: (l) => l === 'fr' ? {
      kicker: 'PDP · Développement Produit', title: "L'Atelier",
      body: "Le module qui pense un bijou avant qu'il existe : catalogue de pierres, cours du jour des métaux, coûts de façon, moteur de calcul de prix, gestion des modèles et variantes — jusqu'à un éditeur maison pour dessiner un nouveau modèle.",
      meta: [['Échelle', '14 558 pierres · 48 699 produits · 13 056 modèles']],
    } : {
      kicker: 'PDP · Product Development', title: 'The Atelier',
      body: 'The module that thinks up a piece of jewelry before it exists: a stone catalog, daily metal market prices, labor costing, a price-computation engine, model & variant management — down to a custom in-house editor for designing new models.',
      meta: [['Scale', '14,558 stones · 48,699 products · 13,056 models']],
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
      body: "Sous le parvis envahi de lianes dort encore JMS, le vieux système maison en MS-SQL. Un pipeline d'import a fait remonter chaque table vers Odoo — jusqu'aux 3,3 Go de photos produit — sans jamais interrompre la production.",
    } : {
      kicker: 'Migration · Beneath the forecourt', title: 'The Roots',
      body: 'Below the vine-choked forecourt, JMS still sleeps — the old in-house MS-SQL system. An import pipeline pulled every table up into Odoo, down to 3.3GB of product photos, without ever stopping production.',
    },
  },
};
