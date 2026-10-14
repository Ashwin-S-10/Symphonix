import json
from django.test import TestCase, Client

class SpacesSignalingTestCase(TestCase):
    def setUp(self):
        self.client = Client()

    def test_create_and_join_space_flow(self):
        # 1. Host creates space
        res = self.client.post(
            '/api/spaces/',
            data=json.dumps({'hostPeerId': 'host-peer-1', 'displayName': 'Host User'}),
            content_type='application/json'
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        code = data['code']
        self.assertTrue(code.startswith('SPX-'))
        self.assertTrue(data['isHost'])

        # 2. Guest joins space
        join_res = self.client.post(
            f'/api/spaces/{code}/join/',
            data=json.dumps({'peerId': 'guest-peer-2', 'displayName': 'Guest User'}),
            content_type='application/json'
        )
        self.assertEqual(join_res.status_code, 200)
        join_data = join_res.json()
        self.assertEqual(len(join_data['participants']), 2)

        # 3. Host polls and should receive 'peer-joined' notification
        poll_host = self.client.get(f'/api/spaces/{code}/signals/poll/?peerId=host-peer-1')
        self.assertEqual(poll_host.status_code, 200)
        signals = poll_host.json()['signals']
        self.assertTrue(any(s['type'] == 'peer-joined' and s['fromPeer'] == 'guest-peer-2' for s in signals))

        # 4. Host sends WebRTC offer to guest
        offer_res = self.client.post(
            f'/api/spaces/{code}/signals/',
            data=json.dumps({
                'fromPeer': 'host-peer-1',
                'toPeer': 'guest-peer-2',
                'type': 'offer',
                'payload': {'sdp': 'v=0\r\no=host 123 456...'}
            }),
            content_type='application/json'
        )
        self.assertEqual(offer_res.status_code, 200)

        # 5. Guest polls and receives the SDP offer
        poll_guest = self.client.get(f'/api/spaces/{code}/signals/poll/?peerId=guest-peer-2')
        self.assertEqual(poll_guest.status_code, 200)
        guest_signals = poll_guest.json()['signals']
        self.assertTrue(any(s['type'] == 'offer' and s['fromPeer'] == 'host-peer-1' for s in guest_signals))
