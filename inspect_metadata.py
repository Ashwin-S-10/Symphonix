import h5py
from pathlib import Path

file = next(Path("data/MillionSongSubset").rglob("*.h5"))

with h5py.File(file, "r") as h5:
    for key in ["analysis/songs", "metadata/songs"]:
        print(f"\n{key}")
        data = h5[key]
        print(data.dtype.names)
        print(data[0])
