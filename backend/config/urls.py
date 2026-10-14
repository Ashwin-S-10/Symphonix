from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok', 'app': 'Symphonix API', 'version': '1.0.0'})

urlpatterns = [
    path('api/health/', health_check, name='health_check'),
    path('api/songs/', include('apps.catalog.urls')),
    path('api/demo-audio/', include('apps.catalog.audio_urls')),
    path('api/spaces/', include('apps.spaces.urls')),
]
