---
title: "EMBER: A Benchmarking Framework for Minor Graph Embedding"
date: 2026-04-20
description: "Why measuring embedding quality matters for quantum optimization, and what EMBER does about it."
tags: [quantum, D-Wave, Python]
featured: true
---

While researching better minor embedding algorithms[^1] for quantum annealers, I found out there was no benchmark for comparing performance. All algorithms claimed their own superiority on a specific subset of graph types, under specific, potentially non-reproducible conditions. 


[^1]: This is the algorithm used to map the logical graph representing a relevant problem to the hardware graph it runs on. Since they don't match, we must map each logical vertex to *chains* of connected hardware vertices. Minor embedding is about doing this well and fast. D-wave describes it [here](https://docs.dwavequantum.com/en/latest/quantum_research/embedding_intro.html) and the industry standard is [minorminer](https://docs.dwavequantum.com/en/latest/ocean/api_ref_minorminer/source/index.html).


It is clear why a common benchmarking framework is important--we need a shared ground truth to actually compare improvements for science to work effectively. So I built [one](https://arxiv.org/abs/2604.25433).

Ember is an open source benchmarking package that you can install from [PyPI](https://pypi.org/project/ember-qc/) or just [github](https://github.com/zachmacsmith/ember) that implements a few key features:
- A diverse test library of 24,016 graphs spanning 35 categories across five structural families[^3]
- Reproducible benchmarking infrastructure including: parallelizable runs, checkpointing, lazy graph installation and a full CLI
- Useful extra features like simulated fault tolerance testing, configurable presets, and detailed run provenance logging. 

I also tried to make ember very accessible and installation only requires `pip install ember-qc`. 

[^3]: Many of these--like physics lattices and QUBO formulations of certain NP-hard problems--seem largely overlooked in the previous minor embedding literature, despite being some of the graph types most likely to be directly relevant for actual annealing applications!

For the [full paper](https://arxiv.org/abs/2604.25433) (currently in preprint), we used this to compare minorminer, PSSA, ATOM, Clique and CHARME algorithms on Chimera hardware. I wanted to compare all the algorithms across newer D-Wave topologies like Pegasus and Zephyr, but unfortunately most of them are strictly bound to Chimera. 

Since we couldn't find any public versions of PSSA or CHARME, we also rewrote these ourselves and [released them](https://github.com/zachmacsmith/ember/tree/main/packages/ember-qc/src/ember_qc/algorithms) with the rest of our code. 

The main results were that Minorminer is the best algorithm out of those we tested. This is unsurprising, as it is the one currently being maintained and engineered by D-Wave. More interestingly, we also found that for certain graph types, MinorMiner IS NOT the best and that a certain variant of OCT often performed equal or better at 8x faster--particularly for algebraically structured graphs. Other algorithms like PSSA even dominated for certain graph-types! 

But, outside of these regimes, Minorminer on average still leads by far:[^4]  

![Success_rate_Graph](/images/projects/success_rate_vs_nodes_linear_bin20.png)

However, I built ember to be very easily extensible. You can quickly build, plug in and test your own custom algorithms. I'm planning on also building an open community leaderboard at some point.

[^4]: Of course, the results were more nuanced than that, but just read [the paper](https://arxiv.org/abs/2604.25433) for the rest.

Looking forward to seeing what the new best minor embedding algorithms might look like!