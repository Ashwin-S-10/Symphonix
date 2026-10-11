# TuneX 🎵

## Project Setup

1. Download the Million Song Dataset subset.
2. Maintain the following folder structure:

```text
TuneX/
├── data/
│   └── MillionSongSubset/
├── inspect_metadata.py
├── main.py
├── pyproject.toml
├── README.md
├── sources/
│   ├── cluster.py
│   ├── neural_networks.py
│   ├── preprocess.py
│   ├── recommend.py
│   └── similarity.py
├── src/
│   └── tunex/
├── tests/
└── uv.lock
```

## Installation

Install [uv](https://docs.astral.sh/uv/), a fast Python package manager.

Initialize the project if not already initialized:

```bash
uv init .
```

Install the required dependencies:

```bash
uv add pandas scikit-learn h5py numpy matplotlib
```
