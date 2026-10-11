from pathlib import Path

import h5py
import pandas as pd

DATA_DIR = Path("data/MillionSongSubset")
OUTPUT_DIR = Path("data/processed")
OUTPUT_FILE = OUTPUT_DIR / "songs.csv"

FEATURES = [
    "tempo",
    "energy",
    "danceability",
    "loudness",
    "duration",
    "key",
    "mode",
]


def extract_song(file_path):
    with h5py.File(file_path, "r") as h5:
        analysis = h5["analysis/songs"][0]
        metadata = h5["metadata/songs"][0]

        song = {
            "track_id": analysis["track_id"].decode("utf-8", errors="replace"),
            "title": metadata["title"].decode("utf-8", errors="replace"),
            "artist": metadata["artist_name"].decode("utf-8", errors="replace"),
        }

        for feature in FEATURES:
            song[feature] = float(analysis[feature])

        return song


def main():
    files = list(DATA_DIR.rglob("*.h5"))
    print(f"Found {len(files)} HDF5 files")

    if not files:
        raise FileNotFoundError(f"No HDF5 files found in {DATA_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    songs = []

    for index, file_path in enumerate(files, start=1):
        try:
            songs.append(extract_song(file_path))
        except (OSError, KeyError, ValueError, TypeError) as exc:
            print(f"Skipping {file_path}: {exc}")

        if index % 100 == 0:
            print(f"Processed {index}/{len(files)} files")

    df = pd.DataFrame(songs)
    df.to_csv(OUTPUT_FILE, index=False)

    print(f"Saved {len(df)} songs to {OUTPUT_FILE}")
    print(df.head())


if __name__ == "__main__":
    main()
