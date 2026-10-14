from django.urls import path
from .views import stream_demo_audio

urlpatterns = [
    path('<str:song_id>/', stream_demo_audio, name='stream_demo_audio'),
]
