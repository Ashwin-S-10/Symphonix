from django.test import TestCase, Client
from apps.catalog.models import get_demo_catalog, get_demo_song

class CatalogTestCase(TestCase):
    def setUp(self):
        self.client = Client()

    def test_catalog_contains_all_20_songs(self):
        catalog = get_demo_catalog()
        self.assertEqual(len(catalog), 20)

    def test_catalog_song_lookup(self):
        song = get_demo_song("song-01")
        self.assertIsNotNone(song)
        self.assertEqual(song["title"], "Pirates of the Caribbean")
        self.assertEqual(song["collection"], "Instrumental Essentials")

    def test_api_songs_list(self):
        response = self.client.get('/api/songs/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 20)
        self.assertEqual(len(data['results']), 20)
        self.assertTrue(len(data['collections']) >= 4)

    def test_api_songs_filter_by_collection(self):
        response = self.client.get('/api/songs/?collection=Instrumental Essentials')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['count'] > 0)
        for s in data['results']:
            self.assertEqual(s['collection'], 'Instrumental Essentials')
