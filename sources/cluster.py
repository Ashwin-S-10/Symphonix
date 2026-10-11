"""

K Means Clustering - Clustering into gruops
Ashwin's Project
"""

from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

INPUT_FILE = Path("data/processed/songs.csv")
OUTPUT_FILE = Path("data/processed/songs_clustered.csv")

FEATURES = [
    "tempo",
    "energy",
    "danceability",
    "loudness",
    "duration",
    "key",
    "mode",
]


def main():
    df = pd.read_csv(INPUT_FILE)

    df[FEATURES] = df[FEATURES].fillna(df[FEATURES].median())

    scaler = StandardScaler()
    X = scaler.fit_transform(df[FEATURES])

    model = KMeans(
        n_clusters=10,
        random_state=42,
        n_init=10,
    )

    df["cluster"] = model.fit_predict(X)

    df.to_csv(OUTPUT_FILE, index=False)

    print(f"Songs processed: {len(df)}")
    print(f"Clusters created: {df['cluster'].nunique()}")
    print(df[["title", "artist", "cluster"]].head(10))


if __name__ == "__main__":
    main()
