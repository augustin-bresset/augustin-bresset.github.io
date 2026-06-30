// lang.js — FR/EN strings, city labels, and project panel content (real data).
export const LANG = {
  current: 'en',
  strings: {
    en: {
      hint: 'Click a settlement to explore  ·  drag to look around',
      back: 'Back to the island',
      apairoLabel: 'Apairo', apairoSub: 'Robotics Data',
      toasterLabel: 'Toaster', toasterSub: '3D Annotation',
      splasherLabel: 'Splasher', splasherSub: 'BEV Labeling',
      aboutLabel: 'Augustin', aboutSub: 'The Inventor',
    },
    fr: {
      hint: 'Cliquez un lieu pour explorer  ·  glissez pour regarder',
      back: "Retour à l'île",
      apairoLabel: 'Apairo', apairoSub: 'Données Robotique',
      toasterLabel: 'Toaster', toasterSub: 'Annotation 3D',
      splasherLabel: 'Splasher', splasherSub: 'Étiquetage BEV',
      aboutLabel: 'Augustin', aboutSub: "L'Inventeur",
    },
  },
  t(k) { return (this.strings[this.current][k] ?? k); },
};

export const PANELS = {
  apairo: (l) => l === 'fr' ? {
    title: 'Apairo', tag: 'Robotique · Science des Données',
    desc: "Framework Python open-source pour gérer de grands datasets robotiques. API numpy-native unifiée pour LiDAR, caméras, IMU et trajectoires — cinq packages interconnectés, des bags bruts aux tenseurs d'entraînement.",
    specs: [['Architecture', '5 packages modulaires · cache incrémental'], ['Formats', 'ROS bags · KITTI · personnalisé'], ['Stack', 'Python · NumPy · PyTorch · Docker'], ['Contexte', 'Stage de recherche · ENSTA Paris · 2024']],
    links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
  } : {
    title: 'Apairo', tag: 'Robotics · Data Science',
    desc: 'Open-source Python framework for large robotics datasets. Unified numpy-native API for LiDAR, cameras, IMU and trajectories — five interconnected packages from raw bags to training-ready tensors.',
    specs: [['Architecture', '5 modular packages · incremental cache'], ['Formats', 'ROS bags · KITTI · custom'], ['Stack', 'Python · NumPy · PyTorch · Docker'], ['Context', 'Research internship · ENSTA Paris · 2024']],
    links: [['Site ↗', 'https://apairo-robotics.github.io/'], ['GitHub ↗', 'https://github.com/augustin-bresset/apairo']],
  },
  toaster: (l) => l === 'fr' ? {
    title: 'Toaster', tag: 'Annotation · LiDAR 3D',
    desc: "Outil d'annotation de nuages de points 3D avec trois identités visuelles : Toaster (néon rouge brutaliste), Café Toaster (espresso chaud), Arcade Quest (CRT rétro). Étiquetage par cluster en un clic via DBSCAN/HDBSCAN.",
    specs: [['Interfaces', 'Toaster · Café Toaster · Arcade Quest'], ['Clustering', 'DBSCAN · HDBSCAN · K-means'], ['Stack', 'Python · Three.js · FastAPI · pywebview']],
    links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
  } : {
    title: 'Toaster', tag: 'Annotation · 3D LiDAR',
    desc: 'A 3D point-cloud annotation tool with three visual identities: Toaster (brutalist neon-red), Café Toaster (warm espresso), Arcade Quest (retro CRT). One-click cluster labeling via DBSCAN/HDBSCAN.',
    specs: [['Interfaces', 'Toaster · Café Toaster · Arcade Quest'], ['Clustering', 'DBSCAN · HDBSCAN · K-means'], ['Stack', 'Python · Three.js · FastAPI · pywebview']],
    links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/toaster'], ['GitHub ↗', 'https://github.com/augustin-bresset/toaster']],
  },
  splasher: (l) => l === 'fr' ? {
    title: 'Splasher', tag: 'BEV · Étiquetage Multi-Capteurs',
    desc: "Application d'étiquetage multi-capteurs synchronisés — nuage de points 3D, panneaux caméra et grille BEV vue de dessus. Esthétique brutaliste sombre-aqua conçue pour la précision de traversabilité.",
    specs: [['Modalités', 'LiDAR · Caméra · Grille BEV'], ['Esthétique', 'Sombre aqua · cyan froid'], ['Stack', 'Python · Three.js · FastAPI'], ['Usage', 'Étiquetage traversabilité · systèmes autonomes']],
    links: [['Démo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
  } : {
    title: 'Splasher', tag: 'BEV · Multi-Sensor Labeling',
    desc: "Synchronized multi-sensor labeling — 3D point cloud, camera panels and a bird's-eye BEV annotation grid. Brutalist dark-aqua aesthetic built for traversability precision.",
    specs: [['Modalities', 'LiDAR · Camera · BEV grid'], ['Aesthetic', 'Dark aqua · cold cyan'], ['Stack', 'Python · Three.js · FastAPI'], ['Use', 'Traversability labeling · autonomous systems']],
    links: [['Demo ↗', 'https://huggingface.co/spaces/SmaugC137/splasher'], ['GitHub ↗', 'https://github.com/augustin-bresset/splasher']],
  },
  about: (l) => l === 'fr' ? {
    title: 'Augustin Bresset', tag: 'Data Scientist & Ingénieur · Paris',
    desc: "Entre recherche mathématique et systèmes pratiques — des algorithmes d'optimisation aux pipelines de données robotiques.",
    specs: [['Formation', 'M.Sc. Data Science · École Polytechnique (2025–26)'], ['', 'M.Eng. · Télécom SudParis (2022–26)'], ['Expérience', 'Software Eng. Intern · Rubicon, Bangkok (2025)'], ['', 'Stagiaire Recherche · ENSTA Paris (2024–25)'], ['Intérêts', 'Piano · Cinéma · Littérature · Escalade']],
    links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
  } : {
    title: 'Augustin Bresset', tag: 'Data Scientist & Engineer · Paris',
    desc: 'Bridging mathematical research and practical systems — from optimization algorithms to full robotics data pipelines.',
    specs: [['Education', 'M.Sc. Data Science · École Polytechnique (2025–26)'], ['', 'M.Eng. · Télécom SudParis (2022–26)'], ['Experience', 'Software Eng. Intern · Rubicon, Bangkok (2025)'], ['', 'Research Intern · ENSTA Paris (2024–25)'], ['Interests', 'Piano · Cinema · Literature · Climbing']],
    links: [['Email ↗', 'mailto:augustin.bresset@polytechnique.edu'], ['GitHub ↗', 'https://github.com/augustin-bresset'], ['LinkedIn ↗', 'https://www.linkedin.com/in/augustin-b-3a0546142/']],
  },
};

export function renderPanel(key, lang) {
  const p = PANELS[key](lang);
  const rows = p.specs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  const links = p.links.map(([t, h]) =>
    `<a href="${h}" target="_blank" rel="noopener" class="panel-link">${t}</a>`).join('');
  return `<h2>${p.title}</h2><span class="panel-tag">${p.tag}</span>
    <p>${p.desc}</p><table class="spec-table">${rows}</table>
    <div class="panel-links">${links}</div>`;
}
