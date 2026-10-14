# Backend Plan

## Responsibilities
- Django REST API and persistent catalog.
- Dataset ingestion and metadata normalization.
- Feature processing, clustering, K-NN retrieval.
- Audio analysis for the 20 actual demo MP3s.
- Recommendation ranking and listening-history ingestion.
- Optional room metadata/signaling support; never relay normal audio.

## Structure
```text
backend/
├── config/                 # Django settings, URLs, ASGI
├── apps/
│   ├── catalog/            # Songs, metadata, demo asset references
│   ├── users/              # User/preferences
│   ├── listening_history/  # Plays, skips, replayed sections
│   ├── recommendations/    # API orchestration and ranking
│   └── spaces/             # Optional room metadata/signaling
├── ml/
│   ├── ingestion/          # Dataset and demo-audio loaders
│   ├── preprocessing/      # Cleaning, scaling, feature schemas
│   ├── clustering/         # HDBSCAN/DBSCAN
│   ├── retrieval/          # K-NN/vector index
│   ├── audio_analysis/     # Signal features and model inference
│   ├── ranking/            # Hybrid ranking/personalization
│   └── pipelines/          # Reproducible orchestration
├── data/
│   ├── raw/millionsongsubset/
│   ├── processed/
│   └── audio/demo/
└── artifacts/              # Generated models, scalers, indexes
```

## Dataset placement
```text
backend/data/raw/millionsongsubset/  # Extract MillionSongSubset here
backend/data/audio/demo/             # Put the 20 MP3 files here
backend/data/processed/              # Generated data only
backend/artifacts/                   # Models and indexes only
```

- Million Song Dataset Subset: 10,000 songs, approximately 1.8 GB.
- Source archive: http://labrosa.ee.columbia.edu/~dpwe/tmp/millionsongsubset.tar.gz
- The subset contains metadata/features and SQLite databases; **it contains no listenable audio**.
- The 20 MP3s are the playable demo corpus and must be separately cataloged.
- Preserve source directory structure under `raw/`; do not flatten or edit raw files.
- Do not commit datasets, MP3s, generated features, or model artifacts.

## ML pipeline
1. Inspect and load available metadata/features and SQLite databases.
2. Normalize metadata and define stable song IDs.
3. Preprocess selected numeric features; persist preprocessing configuration.
4. Fit HDBSCAN/DBSCAN and persist cluster assignments.
5. Build K-NN index over the defined feature vectors.
6. Extract features from demo MP3s using Librosa or equivalent.
7. Use an appropriate pretrained/labeled model for instrument, vocal, or section classification.
8. Combine metadata/audio similarity and listening preferences in ranking.
9. Version datasets, feature schemas, preprocessing, and model/index artifacts.

## API responsibilities
- `GET /api/songs/` — catalog/search.
- `GET /api/songs/{id}/` — song details.
- `GET /api/songs/{id}/similar/` — nearest-neighbor recommendations.
- `GET /api/recommendations/` — ranked recommendations.
- `POST /api/listening-events/` — play, skip, replay/section events.
- `GET /api/demo-audio/{id}/` — serve a demo MP3 for initial playback acquisition.
- Optional room/signaling endpoints: exchange signaling messages only.

Use pagination, serializers, validation, clear error responses, and versioned API contracts. Keep long-running dataset processing and model training out of request handlers; run them as explicit management commands or background jobs.

## Data and ML rules
- Raw input is immutable; derived files go to `processed/` and `artifacts/`.
- Do not assume MillionSongSubset includes audio waveforms or MP3s.
- Dataset metadata features and audio-derived features are different feature sources; document missing values and compatibility.
- Replay frequency indicates user interest, not a verified instrument/chorus label.
- Keep ML implementation entirely in the backend.
- Recommendations must degrade gracefully when a song lacks audio-derived features.

## Implementation order
1. Django project, catalog schema, demo-audio endpoint.
2. Load the 20 MP3s into the catalog and test playback acquisition.
3. Dataset ingestion and metadata inspection.
4. Feature preprocessing, clustering, and K-NN.
5. Demo-audio analysis and recommendation endpoints.
6. Listening-history personalization.
7. Optional signaling support, tests, logging, and deployment configuration.
