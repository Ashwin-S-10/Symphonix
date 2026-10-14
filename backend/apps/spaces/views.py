import json
import time
import uuid
import random
import string
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# In-memory room and signaling state (reliable, fast, no external Redis required)
ROOMS = {}

def generate_room_code():
    chars = string.ascii_uppercase + string.digits
    # Generate 6-char code like 'SPX-3928'
    random_part = ''.join(random.choice(chars) for _ in range(4))
    return f"SPX-{random_part}"

def cleanup_stale_rooms():
    now = time.time()
    stale_codes = []
    for code, room in ROOMS.items():
        # Clean rooms inactive for > 4 hours
        if now - room.get('last_activity', now) > 14400:
            stale_codes.append(code)
    for code in stale_codes:
        ROOMS.pop(code, None)

@csrf_exempt
def create_space(request):
    """
    POST /api/spaces/
    Creates a new listening space with an authoritative host.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    cleanup_stale_rooms()

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        body = {}

    host_peer_id = body.get('hostPeerId') or str(uuid.uuid4())
    host_name = body.get('displayName') or 'Host'
    room_name = body.get('name') or f"{host_name}'s Space"

    room_code = generate_room_code()
    while room_code in ROOMS:
        room_code = generate_room_code()

    now = time.time()
    ROOMS[room_code] = {
        'code': room_code,
        'name': room_name,
        'host_peer_id': host_peer_id,
        'host_name': host_name,
        'created_at': now,
        'last_activity': now,
        'participants': {
            host_peer_id: {
                'peerId': host_peer_id,
                'displayName': host_name,
                'isHost': True,
                'joinedAt': now,
                'lastSeen': now
            }
        },
        'signal_queues': {
            host_peer_id: []
        }
    }

    return JsonResponse({
        'code': room_code,
        'name': room_name,
        'hostPeerId': host_peer_id,
        'isHost': True,
        'createdAt': now,
        'message': f"Space {room_code} created successfully."
    }, status=201)

@csrf_exempt
def join_space(request, code):
    """
    POST /api/spaces/<code colon or slash>/join/
    Joins an existing space as a participant.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        return JsonResponse({'error': f"Space code '{code}' not found or has expired"}, status=404)

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
    except Exception:
        body = {}

    peer_id = body.get('peerId') or str(uuid.uuid4())
    display_name = body.get('displayName') or f"Guest {len(room['participants'])}"

    now = time.time()
    room['last_activity'] = now
    room['participants'][peer_id] = {
        'peerId': peer_id,
        'displayName': display_name,
        'isHost': False,
        'joinedAt': now,
        'lastSeen': now
    }

    if peer_id not in room['signal_queues']:
        room['signal_queues'][peer_id] = []

    # Notify the host that a new guest joined so host can initiate RTCPeerConnection offer!
    host_id = room['host_peer_id']
    if host_id in room['signal_queues'] and host_id != peer_id:
        room['signal_queues'][host_id].append({
            'id': str(uuid.uuid4()),
            'type': 'peer-joined',
            'fromPeer': peer_id,
            'toPeer': host_id,
            'displayName': display_name,
            'timestamp': now
        })

    return JsonResponse({
        'code': room['code'],
        'name': room['name'],
        'hostPeerId': room['host_peer_id'],
        'hostName': room['host_name'],
        'peerId': peer_id,
        'isHost': False,
        'participants': list(room['participants'].values())
    })

def space_status(request, code):
    """
    GET /api/spaces/<code colon or slash>/status/
    Returns active room info and connected participants.
    """
    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        return JsonResponse({'error': f"Space '{code}' not found"}, status=404)

    peer_id = request.GET.get('peerId')
    if peer_id and peer_id in room['participants']:
        room['participants'][peer_id]['lastSeen'] = time.time()

    return JsonResponse({
        'code': room['code'],
        'name': room['name'],
        'hostPeerId': room['host_peer_id'],
        'hostName': room['host_name'],
        'participantCount': len(room['participants']),
        'participants': list(room['participants'].values()),
        'createdAt': room['created_at']
    })

@csrf_exempt
def send_signal(request, code):
    """
    POST /api/spaces/<code colon or slash>/signals/
    Sends WebRTC signaling messages (offer, answer, candidate) between peers.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        return JsonResponse({'error': f"Space '{code}' not found"}, status=404)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'error': f"Invalid JSON payload: {str(e)}"}, status=400)

    from_peer = body.get('fromPeer')
    to_peer = body.get('toPeer')
    sig_type = body.get('type')  # 'offer', 'answer', 'ice-candidate', etc.
    payload = body.get('payload')

    if not from_peer or not to_peer or not sig_type:
        return JsonResponse({'error': 'fromPeer, toPeer, and type are required'}, status=400)

    # Server-side validation: sender must be part of room
    if from_peer not in room['participants']:
        return JsonResponse({'error': 'Sender is not a registered member of this room'}, status=403)

    # Update activity
    now = time.time()
    room['last_activity'] = now
    if from_peer in room['participants']:
        room['participants'][from_peer]['lastSeen'] = now

    # Ensure queue exists for target
    if to_peer not in room['signal_queues']:
        room['signal_queues'][to_peer] = []

    signal_message = {
        'id': str(uuid.uuid4()),
        'type': sig_type,
        'fromPeer': from_peer,
        'toPeer': to_peer,
        'payload': payload,
        'timestamp': now
    }
    room['signal_queues'][to_peer].append(signal_message)

    return JsonResponse({'status': 'queued', 'messageId': signal_message['id']})

def poll_signals(request, code):
    """
    GET /api/spaces/<code colon or slash>/signals/?peerId=...
    Consumes pending WebRTC signals addressed to the given peer.
    """
    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        return JsonResponse({'error': f"Space '{code}' not found"}, status=404)

    peer_id = request.GET.get('peerId')
    if not peer_id:
        return JsonResponse({'error': 'peerId query parameter is required'}, status=400)

    queue = room['signal_queues'].get(peer_id, [])
    # Drain the queue atomically for this peer
    messages = list(queue)
    room['signal_queues'][peer_id] = []

    # Update heartbeat
    if peer_id in room['participants']:
        room['participants'][peer_id]['lastSeen'] = time.time()

    return JsonResponse({
        'signals': messages,
        'count': len(messages)
    })

@csrf_exempt
def leave_space(request, code):
    """
    POST /api/spaces/<code colon or slash>/leave/
    Leaves a space and cleans up queues.
    """
    code = code.upper().strip()
    room = ROOMS.get(code)
    if not room:
        return JsonResponse({'status': 'ok'})

    try:
        body = json.loads(request.body.decode('utf-8')) if request.body else {}
        peer_id = body.get('peerId')
    except Exception:
        peer_id = None

    if peer_id:
        room['participants'].pop(peer_id, None)
        room['signal_queues'].pop(peer_id, None)

        # Broadcast peer departure to remaining peers
        for target_id in room['signal_queues']:
            room['signal_queues'][target_id].append({
                'id': str(uuid.uuid4()),
                'type': 'peer-left',
                'fromPeer': peer_id,
                'toPeer': target_id,
                'timestamp': time.time()
            })

    # If host leaves and room is empty, remove room
    if not room['participants'] or (peer_id == room['host_peer_id'] and len(room['participants']) == 0):
        ROOMS.pop(code, None)

    return JsonResponse({'status': 'left'})

def get_ice_servers(request):
    """
    GET /api/spaces/ice-servers/
    Returns STUN/TURN server configurations for WebRTC ICE negotiation.
    """
    ice_servers = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
        {"urls": "stun:stun3.l.google.com:19302"},
        {"urls": "stun:stun4.l.google.com:19302"},
    ]
    return JsonResponse({'iceServers': ice_servers})
