import os
import re
from pathlib import Path
from django.http import JsonResponse, HttpResponse, Http404
from django.conf import settings
from .models import get_demo_catalog, get_demo_song

def song_list(request):
    """
    GET /api/songs/
    Returns the complete 20 demo songs catalog.
    Supports optional ?collection= and ?q= query parameters.
    """
    catalog = get_demo_catalog()
    
    collection = request.GET.get('collection')
    query = request.GET.get('q')

    if collection and collection.lower() != 'all':
        catalog = [s for s in catalog if s['collection'].lower() == collection.lower()]
        
    if query:
        q_lower = query.lower()
        catalog = [
            s for s in catalog
            if q_lower in s['title'].lower() or q_lower in s['artist'].lower()
        ]

    collections_summary = [
        {"name": "All Tracks", "count": len(get_demo_catalog())},
        {"name": "Tamil Hits & Scores", "count": len([s for s in get_demo_catalog() if s['collection'] == 'Tamil Hits & Scores'])},
        {"name": "Instrumental Essentials", "count": len([s for s in get_demo_catalog() if s['collection'] == 'Instrumental Essentials'])},
        {"name": "Acoustic & Melodic", "count": len([s for s in get_demo_catalog() if s['collection'] == 'Acoustic & Melodic'])},
        {"name": "High Energy & Bass", "count": len([s for s in get_demo_catalog() if s['collection'] == 'High Energy & Bass'])},
    ]

    return JsonResponse({
        'count': len(catalog),
        'results': catalog,
        'collections': collections_summary
    }, safe=False)

def song_detail(request, song_id):
    """
    GET /api/songs/<song_id>/
    Returns metadata for a single track.
    """
    song = get_demo_song(song_id)
    if not song:
        return JsonResponse({'error': f'Track with ID {song_id} not found'}, status=404)
    return JsonResponse(song)

def stream_demo_audio(request, song_id):
    """
    GET /api/demo-audio/<song_id>/
    Streams the playable MP3 for initial host acquisition.
    Supports HTTP Range requests for seamless browser seeking.
    """
    song = get_demo_song(song_id)
    if not song:
        raise Http404(f"Song {song_id} not found in catalog")

    file_name = song['fileName']
    
    # Locate the file in configured demo audio directories
    audio_file_path = None
    for audio_dir in getattr(settings, 'DEMO_AUDIO_DIRS', []):
        candidate = Path(audio_dir) / file_name
        if candidate.exists() and candidate.is_file():
            audio_file_path = candidate
            break

    if not audio_file_path:
        # Fallback to local paths
        fallbacks = [
            Path(settings.BASE_DIR) / 'data' / 'audio' / 'demo' / file_name,
            Path(settings.BASE_DIR) / 'audio' / 'demo' / file_name,
            Path(settings.BASE_DIR).parent / 'frontend' / 'public' / 'audio' / file_name,
        ]
        for fb in fallbacks:
            if fb.exists() and fb.is_file():
                audio_file_path = fb
                break

    if not audio_file_path or not audio_file_path.exists():
        raise Http404(f"Audio file '{file_name}' not found on server")

    file_size = os.path.getsize(audio_file_path)
    range_header = request.META.get('HTTP_RANGE', '').strip()
    range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)

    if range_match:
        start = int(range_match.group(1))
        end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(audio_file_path, 'rb') as f:
            f.seek(start)
            data = f.read(length)

        response = HttpResponse(data, status=206, content_type='audio/mpeg')
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(length)
    else:
        with open(audio_file_path, 'rb') as f:
            data = f.read()
        response = HttpResponse(data, status=200, content_type='audio/mpeg')
        response['Content-Length'] = str(file_size)

    response['Accept-Ranges'] = 'bytes'
    response['Cache-Control'] = 'public, max-age=86400'
    response['Access-Control-Allow-Origin'] = '*'
    response['Content-Disposition'] = f'inline; filename="{file_name}"'
    return response
