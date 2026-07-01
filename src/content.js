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
  about: (l) => l === 'fr' ? ['Origin', "L'Inventeur"] : ['Origin', 'The Inventor'],
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
};
