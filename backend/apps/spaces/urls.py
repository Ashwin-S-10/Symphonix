from django.urls import path
from .views import create_space, join_space, space_status, send_signal, poll_signals, leave_space, get_ice_servers

urlpatterns = [
    path('', create_space, name='create_space'),
    path('ice-servers/', get_ice_servers, name='get_ice_servers'),
    path('<str:code>/join/', join_space, name='join_space'),
    path('<str:code>/status/', space_status, name='space_status'),
    path('<str:code>/signals/', send_signal, name='send_signal'),
    path('<str:code>/signals/poll/', poll_signals, name='poll_signals'),
    path('<str:code>/leave/', leave_space, name='leave_space'),
]
