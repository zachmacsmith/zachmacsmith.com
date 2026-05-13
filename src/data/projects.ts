export interface Project {
  title: string;
  description: string;
  status: 'active' | 'complete' | 'paused' | 'ongoing';
  tags: string[];
  github?: string;
  pypi?: string;
  paper?: string;
  demo?: string;
  blog?: string;
  image?: string;
  link?: string;
}

export const projects: Project[] = [
  {
    title: 'WISP',
    description: 'Wildifre Intelligent Surveillance Package\u2014uses bayesian updates to reroute drone measurements for informationally-optimal uncertainty reduction.',
    status: 'complete',
    tags: ['Python', 'Predictive Processing'],
    image: '/images/projects/wisp.png',
    github: 'https://github.com/zachmacsmith/wisp',
    demo: 'https://www.youtube.com/watch?v=rncma70ddg4',
    blog: '/writing/essays/wisp',
    link: '/writing/essays/wisp',
  },
  {
    title: 'EMBER',
    description: 'Open-source benchmarking suite for minor-embedding algorithms',
    status: 'complete',
    tags: ['Python', 'D-Wave', 'quantum'],
    github: 'https://github.com/zachmacsmith/ember',
    pypi: 'https://pypi.org/project/ember-qc/',
    blog: '/writing/essays/ember-benchmarking',
  },
  {
    title: 'QKD Cubesat',
    description: 'Building scalable cubesats to facilitate widespread QKD.',
    status: 'ongoing',
    tags: ['Quantum','Organisation'],
    blog: '/writing/essays/why-we-need-qkd',
  },
  {
    title: 'Spatial AI',
    description: 'Modular video analysis system for construction site with AI-powered action classification, object detection, and relationship tracking',
    status: 'active',
    tags: ['Python', 'D-Wave', 'quantum'],
    github: 'https://github.com/zachmacsmith/ember',
    pypi: 'https://pypi.org/project/ember-qc/',
    blog: '/writing/essays/ember-benchmarking',
  }
];
