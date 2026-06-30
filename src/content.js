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
  about: (l) => l === 'fr' ? ['Augustin', "L'Inventeur"] : ['Augustin', 'The Inventor'],
};

// each settlement's signature accent (portal/label/legend), so the legend dot, the
// city beacon and the field notes all speak the same colour language.
export const CITY_ACCENT = {
  apairo: '#dda42a', toaster: '#e10600', splasher: '#00d8ff', about: '#c4763a',
};

export const POIS = {
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
      kicker: 'Expérience · 2025', title: 'Rubicon · Bangkok',
      body: "Stage ingénieur logiciel : migration complète de l'ERP vers Odoo 18 pour ~40 employés, 10+ modules sur-mesure et imports de données automatisés.",
    } : {
      kicker: 'Experience · 2025', title: 'Rubicon · Bangkok',
      body: 'Software engineering intern: full ERP migration to Odoo 18 for ~40 staff, 10+ custom modules and automated data-import pipelines.',
    },
    climb: (l) => l === 'fr' ? {
      kicker: 'Hors du code', title: "Le Mur d'Escalade",
      body: "Escalade, randonnée, piano, cinéma et littérature. La ville du vent est bâtie comme il aime les problèmes : légère, modulaire, un brin improvisée.",
    } : {
      kicker: 'Off the clock', title: 'The Climbing Wall',
      body: 'Climbing, hiking, piano, cinema and literature. The wind-city is built the way he likes problems — light, modular, a little improvised.',
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
      body: "Framework Python open-source pour de grands datasets robotiques — une API numpy-native unifiée, des bags bruts aux tenseurs prêts à l'entraînement.",
      links: [['Site ↗', 'https://apairo-robotics.github.io/']],
    } : {
      kicker: 'Open-source · Robotics data', title: 'Apairo',
      body: 'An open-source Python framework for large robotics datasets — a unified, numpy-native API from raw bags to training-ready tensors.',
      links: [['Site ↗', 'https://apairo-robotics.github.io/']],
    },
    silos: (l) => l === 'fr' ? {
      kicker: 'Architecture', title: 'Les Silos',
      body: "Cinq packages interconnectés avec cache incrémental : stockez une fois, interrogez LiDAR, caméras, IMU et trajectoires d'un seul tenant.",
    } : {
      kicker: 'Architecture', title: 'The Silos',
      body: 'Five interconnected packages with an incremental cache: store once, query LiDAR, cameras, IMU and trajectories as one.',
    },
    conveyor: (l) => l === 'fr' ? {
      kicker: 'Ingestion', title: 'Le Convoyeur',
      body: "Lit les ROS bags, KITTI et formats personnalisés sur le tapis et aligne dans le temps des flux capteurs asynchrones et multi-fréquences.",
    } : {
      kicker: 'Ingestion', title: 'The Conveyor',
      body: 'Reads ROS bags, KITTI and custom formats off the belt, aligning asynchronous, multi-rate sensor streams in time.',
    },
    pier: (l) => l === 'fr' ? {
      kicker: "Né à l'ENSTA · 2024", title: 'Sorti du labo',
      body: "Né comme outil de stage de recherche à l'ENSTA Paris, désormais open-source.",
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    } : {
      kicker: 'Born at ENSTA · 2024', title: 'Out of the Lab',
      body: 'Started as a research-internship tool at ENSTA Paris, now open-source.',
      meta: [['Stack', 'Python · NumPy · PyTorch · Docker']],
      links: [['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
    },
  },

  toaster: {
    stage: (l) => l === 'fr' ? {
      kicker: 'LiDAR 3D · Annotation', title: 'Toaster',
      body: "Outil d'annotation de nuages de points 3D : étiquetez un cluster entier en un seul clic, sans boîtes image par image.",
    } : {
      kicker: '3D LiDAR · Annotation', title: 'Toaster',
      body: 'A 3D point-cloud annotation tool: label a whole cluster in a single click, no frame-by-frame boxing.',
    },
    landmark: (l) => l === 'fr' ? {
      kicker: 'Interfaces', title: 'Trois Skins',
      body: "Un même moteur, trois ambiances : Toaster (néon rouge brutaliste), Café Toaster (espresso chaud) et Arcade Quest (CRT rétro).",
    } : {
      kicker: 'Interfaces', title: 'Three Skins',
      body: 'One engine, three moods: Toaster (brutalist neon-red), Café Toaster (warm espresso) and Arcade Quest (retro CRT).',
    },
    clustering: (l) => l === 'fr' ? {
      kicker: 'Sous le capot', title: 'Clusters en un clic',
      body: "DBSCAN, HDBSCAN et K-means proposent les clusters ; vous confirmez ou fusionnez.",
      meta: [['Stack', 'Python · Three.js · FastAPI · pywebview']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
    } : {
      kicker: 'Under the hood', title: 'One-Click Clusters',
      body: 'DBSCAN, HDBSCAN and K-means propose the clusters; you confirm or merge.',
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
      body: "Interface brutaliste sombre-aqua pensée pour la précision de traversabilité des systèmes autonomes.",
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    } : {
      kicker: 'Built for', title: 'Traversability',
      body: 'A dark-aqua brutalist UI tuned for traversability precision in autonomous systems.',
      meta: [['Stack', 'Python · Three.js · FastAPI']],
      links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
    },
  },
};
