export interface Project {
  title: string;
  /** One line shown under the title and in compact lists. Leave empty to hide. */
  description: string;
  status: 'active' | 'complete' | 'paused' | 'ongoing';
  year?: string;
  /** Longer breakdown for the projects page, one string per paragraph. */
  summary?: string[];
  /** Competitions, prizes, venues: "Winner, X Hackathon 2026". */
  recognition?: string[];
  /** Main photo or figure on the projects page. */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  /** Which part of the photo to keep when it's cropped to 16:9, as CSS object-position ("center 60%"). */
  imageFocus?: string;
  /** Always show on the home page, even if it isn't one of the newest three. */
  starred?: boolean;
  tags: string[];
  github?: string;
  pypi?: string;
  paper?: string;
  demo?: string;
  /** Write-up on this site, if there is one. */
  blog?: string;
  link?: string;
}

/**
 * Every project, newest first. This is the one list the site reads from:
 * /projects shows all of them, and the home page shows the first three plus
 * any marked `starred: true`.
 */
export const projects: Project[] = [
  {
    title: 'Charter',
    description: 'Small worlds for societies of LLM agents, who trade, scheme and govern themselves through laws written as code.',
    status: 'active',
    year: '2026',
    summary: [
      'Charter builds small worlds for societies of Claude agents and lets them run. Agents of mixed capability harvest resources, trade, message each other in public and in private, and govern themselves through laws written as executable code: money, taxes, courts and property exist only if the agents legislate them. Every agent has private goals, and every word, vote and private thought is kept, which makes it a testbed for watching AI swarms the way a social scientist would watch a town: who gains power, who deceives, which institutions emerge, and whether anyone can tell from the outside.',
    ],
    image: '/images/projects/charter-header-16x9.svg',
    imageAlt: 'Charter: societies of LLM agents, with quotes from agents in the runs',
    tags: ['Python', 'LLM agents', 'Multi-agent'],
    github: 'https://github.com/zachmacsmith/charter',
  },
  {
    title: 'QKD Cubesat',
    description: 'Building scalable cubesats to facilitate widespread QKD.',
    status: 'ongoing',
    year: '2025',
    summary: [
      'With the Vanderbilt Quantum Initiative, I am leading an undergraduate team building a CubeSat to do satellite-to-ground quantum key distribution with the BB84 protocol. We have demonstrated QKD in the lab and are now working on ground demonstrations of pointing precision and timing sync, guided by a full system workflow and a quantum-adjusted link budget that set our engineering constraints. The team began as eight people I trained to become subsystem leads, and is now scaling to 20+ members across 8+ payload and spacecraft subsystems.',
    ],
    image: '/images/projects/qkd-bench.jpg',
    imageAlt: 'Zach in laser safety glasses leaning over an optics table, adjusting a mount',
    tags: ['Quantum', 'Organisation'],
    blog: '/writing/essays/why-we-need-qkd',
  },
  {
    title: 'WISP',
    description: 'Wildfire Intelligent Surveillance Package—uses bayesian updates to reroute drone measurements for informationally-optimal uncertainty reduction.',
    status: 'complete',
    year: '2026',
    summary: [
      'WISP coordinates a flock of drones to collect the data that most reduces uncertainty in wildfire spread prediction. Gaussian processes estimate fuel moisture and wind from sparse observations, an ensemble of up to 1,000 fire simulations measures how much each uncertain point actually matters, and drone paths are optimized over the resulting information field. In a simulation built on terrain around the Palisades fire, WISP finished two hours with 4.7–7× lower prediction error than a baseline without drones. Built and tested in under six days.',
    ],
    image: '/images/projects/wisp-whiteboard.jpg',
    imageAlt: 'The WISP team standing in front of whiteboards covered in the system architecture',
    imageCaption: 'The team in front of the WISP architecture.',
    tags: ['Python', 'Predictive Processing'],
    github: 'https://github.com/zachmacsmith/wisp',
    demo: 'https://www.youtube.com/watch?v=rncma70ddg4',
    link: 'https://github.com/zachmacsmith/wisp',
  },
  {
    title: 'EMBER',
    description: 'Open-source benchmarking suite for minor-embedding algorithms',
    status: 'complete',
    year: '2026',
    summary: [
      'A benchmarking framework for minor-embedding algorithms on D-Wave quantum annealers: a test library of 24,016 graphs across 35 categories, reproducible parallel runs with checkpointing, and a full CLI (pip install ember-qc). We used it to compare minorminer, PSSA, ATOM, Clique and CHARME on Chimera hardware. Minorminer leads on average, but an OCT variant matched or beat it at 8× the speed on algebraically structured graphs. Presented at IEEE Quantum Week 2026.',
    ],
    image: '/images/projects/ember-ieee-quantum-week.jpg',
    imageAlt: 'Zach and two collaborators in front of the 2026 IEEE Quantum Week welcome screen',
    imageCaption: 'At IEEE Quantum Week 2026.',
    tags: ['Python', 'D-Wave', 'quantum'],
    github: 'https://github.com/zachmacsmith/ember',
    pypi: 'https://pypi.org/project/ember-qc/',
    paper: 'https://arxiv.org/abs/2604.25433',
    blog: '/writing/essays/ember-benchmarking',
  },
  {
    title: 'Spatial AI',
    description: 'Modular video analysis system for construction sites with AI-powered action classification, object detection, and relationship tracking.',
    status: 'complete',
    year: '2025',
    summary: [
      'An extensible architecture for testing modular hybrid LLM and computer-vision models on egocentric construction footage, grown out of the Ironsite AI hackathon. We designed and benchmarked 9 models, improving macro-F1 by 60% at 4× the speed and measuring wrench time with 80% accuracy. It placed 4th of 15 at the Ironsite hackathon and 3rd of 30+ at the Vanderbilt AI research showcase.',
    ],
    tags: ['Python'],
  },
  {
    title: 'Quantathon',
    description: 'Grand prize at the 2025 International Quantum Circuit Championship, using quantum annealing for L1-norm PCA.',
    status: 'complete',
    year: '2025',
    summary: [
      'At Quantathon V2, the 2025 International Quantum Circuit Championship, our team of five Vanderbilt freshmen won our challenge and the overall grand prize against teams that included PhD mathematicians and physicists. Within 24 hours we formulated L1-norm principal component analysis of financial stock data as an optimization problem for a quantum annealer, compared it against library and hand-written classical annealers, and ran a gate-based approximation of the annealing algorithm on a real IBM quantum computer. The prize included a funded trip to compete at the NYUAD hackathon in Abu Dhabi.',
    ],
    image: '/images/projects/quantathon-whiteboard.jpg',
    imageFocus: 'center 62%',
    imageAlt: 'Two people working at whiteboards full of matrix maths during the Quantathon, with Celsius cans on the table',
    tags: ['Quantum annealing', 'Python'],
    link: 'https://vanderbilthustler.com/2025/10/27/vanderbilt-quantum-initiative-wins-south-carolinas-annual-quantum-hackathon/',
  },
];
