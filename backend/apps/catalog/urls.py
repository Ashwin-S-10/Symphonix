from django.urls import path
from .views import song_list, song_detail

urlpatterns = [
    path('', song_list, name='song_list'),
    path('<str:song_id>/', song_detail, name='song_detail'),
]
