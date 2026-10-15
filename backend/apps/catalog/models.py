from django.db import models

class Song(models.Model):
    song_id = models.CharField(max_length=64, unique=True, primary_key=True)
    title = models.CharField(max_length=255)
    artist = models.CharField(max_length=255, blank=True, default="Unknown Artist")
    collection = models.CharField(max_length=100, default="Demo collection")
    file_name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0)
    duration = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.artist} ({self.song_id})"

    def to_dict(self):
        return {
            "id": self.song_id,
            "title": self.title,
            "artist": self.artist,
            "collection": self.collection,
            "fileName": self.file_name,
            "fileSize": self.file_size,
            "duration": self.duration,
            "audioUrl": f"/api/demo-audio/{self.song_id}/"
        }

# Curated catalog definitions for the demo tracks
DEMO_SONGS = [
    {
        "id": "song-02",
        "title": "Ain't Nobody",
        "artist": "Chaka Khan / Cover",
        "collection": "Acoustic & Melodic",
        "fileName": "Ain't Nobody.mp3",
        "fileSize": 5649991,
        "duration": 235.0
    },
    {
        "id": "song-03",
        "title": "Aravindh",
        "artist": "Aravindh Vocal Theme",
        "collection": "Acoustic & Melodic",
        "fileName": "Aravindh.mp3",
        "fileSize": 4026882,
        "duration": 167.0
    },
    {
        "id": "song-04",
        "title": "Bloody Valentine",
        "artist": "Machine Gun Kelly (Instrumental)",
        "collection": "Instrumental Essentials",
        "fileName": "Bloody Valentine (Instrumental).mp3",
        "fileSize": 3552822,
        "duration": 205.0
    },
    {
        "id": "song-05",
        "title": "Bum Baa Diga Diga",
        "artist": "Dance & Electro Beats",
        "collection": "High Energy & Bass",
        "fileName": "Bum Baa Diga Diga.mp3",
        "fileSize": 3324267,
        "duration": 138.0
    },
    {
        "id": "song-06",
        "title": "Das and Parvathy",
        "artist": "Cinema Score (Instrumental)",
        "collection": "Instrumental Essentials",
        "fileName": "Das and Parvathy (Instrumental).mp3",
        "fileSize": 2943919,
        "duration": 122.0
    },
    {
        "id": "song-07",
        "title": "Don't Give A Damn",
        "artist": "Alt Rock / Heavy",
        "collection": "High Energy & Bass",
        "fileName": "Don't Give A Damn.mp3",
        "fileSize": 2994908,
        "duration": 124.0
    },
    {
        "id": "song-08",
        "title": "Echoes of DC",
        "artist": "Ambient Score (Instrumental)",
        "collection": "Instrumental Essentials",
        "fileName": "Echoes of DC (Instrumental).mp3",
        "fileSize": 6153478,
        "duration": 256.0
    },
    {
        "id": "song-09",
        "title": "Hangova",
        "artist": "Club Bounce / Urban",
        "collection": "High Energy & Bass",
        "fileName": "Hangova.mp3",
        "fileSize": 8406117,
        "duration": 350.0
    },
    {
        "id": "song-10",
        "title": "Last 7 Minutes",
        "artist": "Climax Score",
        "collection": "Tamil Hits & Scores",
        "fileName": "Last-7-Minutes-MassTamilan.dev.mp3",
        "fileSize": 783524,
        "duration": 32.0
    },
    {
        "id": "song-11",
        "title": "Maamadurai",
        "artist": "Jigarthanda DoubleX",
        "collection": "Tamil Hits & Scores",
        "fileName": "Maamadurai-MassTamilan.dev.mp3",
        "fileSize": 2790110,
        "duration": 116.0
    },
    {
        "id": "song-12",
        "title": "Magale",
        "artist": "Melody Score",
        "collection": "Tamil Hits & Scores",
        "fileName": "Magale.mp3",
        "fileSize": 4195046,
        "duration": 174.0
    },
    {
        "id": "song-13",
        "title": "One Sun One Moon",
        "artist": "Indie Acoustic",
        "collection": "Acoustic & Melodic",
        "fileName": "One Sun One Moon.mp3",
        "fileSize": 7132881,
        "duration": 297.0
    },
    {
        "id": "song-14",
        "title": "Ooroda Oththa Don",
        "artist": "Tamil Cinema Hit",
        "collection": "Tamil Hits & Scores",
        "fileName": "Ooroda Oththa Don.mp3",
        "fileSize": 3460738,
        "duration": 144.0
    },
    {
        "id": "song-15",
        "title": "Please Don't Forget Me",
        "artist": "Acoustic Ballad",
        "collection": "Acoustic & Melodic",
        "fileName": "Please-Don't-Forget-Me-MassTamilan.dev.mp3",
        "fileSize": 1223803,
        "duration": 51.0
    },
    {
        "id": "song-16",
        "title": "Pullinangal",
        "artist": "A.R. Rahman (2.0)",
        "collection": "Tamil Hits & Scores",
        "fileName": "Pullinangal-MassTamilan.com.mp3",
        "fileSize": 4777131,
        "duration": 199.0
    },
    {
        "id": "song-17",
        "title": "Raga of Madness",
        "artist": "Orchestral Theme",
        "collection": "Instrumental Essentials",
        "fileName": "Raga of Madness.mp3",
        "fileSize": 3214756,
        "duration": 133.0
    },
    {
        "id": "song-18",
        "title": "Raga of Revenge",
        "artist": "Cinematic Drama",
        "collection": "Instrumental Essentials",
        "fileName": "Raga of Revenge.mp3",
        "fileSize": 4469575,
        "duration": 186.0
    },
    {
        "id": "song-19",
        "title": "Thaalam Trip",
        "artist": "Percussion Instrumental",
        "collection": "Instrumental Essentials",
        "fileName": "Thaalam Trip (Instrumental).mp3",
        "fileSize": 4823133,
        "duration": 200.0
    },
    {
        "id": "song-20",
        "title": "The Rose",
        "artist": "Acoustic Instrumental",
        "collection": "Instrumental Essentials",
        "fileName": "The Rose (Instrumental).mp3",
        "fileSize": 4616392,
        "duration": 192.0
    }
]

def get_demo_catalog():
    """Returns the stable catalog entries for the 20 demo tracks."""
    catalog = []
    for item in DEMO_SONGS:
        catalog.append({
            **item,
            "audioUrl": f"/api/demo-audio/{item['id']}/"
        })
    return catalog

def get_demo_song(song_id):
    """Find a demo track by ID."""
    for s in DEMO_SONGS:
        if s["id"] == song_id:
            return {
                **s,
                "audioUrl": f"/api/demo-audio/{s['id']}/"
            }
    return None
