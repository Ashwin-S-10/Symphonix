Download the MillionSongdataset

Maintain the Folder Structure :

TuneX
├── data
│   ├── MillionSongSubset
│  
├── inspect_metadata.py
├── main.py
├── pyproject.toml
├── README.md
├── sources
│   ├── cluster.py
│   ├── neural_networks.py
│   ├── preprocess.py
│   ├── recommend.py
│   └── similarity.py
├── src
│   └── tunex
├── tests
└── uv.lock

Install UV for faster execution

uv init .

uv add pandas scikit-learn h5py numpy matplotlib
