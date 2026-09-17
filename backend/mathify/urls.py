"""
URL configuration for mathify project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView
from django.views.generic import TemplateView
from accounts.views import MeView, EmailOrUsernameTokenObtainPairView


urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT auth (supports both email and username seamlessly)
    path('api/auth/token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/', EmailOrUsernameTokenObtainPairView.as_view(), name='token_obtain_pair_alias'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh_alias'),
    path('api/auth/me/', MeView.as_view(), name='auth_me_direct'),

    # apps
    path('api/accounts/', include('accounts.urls')),
    path('api/feed/', include('feed.urls')),
    path('api/social/', include('social.urls')),
    path('api/library/', include('library.urls')),
    path('api/studio/', include('studio.urls')),
    path('api/rankings/', include('rankings.urls')),
    path('api/ai-tutor/', include('ai_tutor.urls')),
    path('api/', include('notifications.urls')),
]

if getattr(settings, 'MEDIA_ROOT', None) and str(getattr(settings, 'MEDIA_URL', '')).startswith('/'):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
if getattr(settings, 'STATIC_ROOT', None) and str(getattr(settings, 'STATIC_URL', '')).startswith('/'):
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

from django.views.static import serve


def spa_or_api_root(request, *args, **kwargs):
    """
    If the compiled frontend bundle (index.html) exists, render the React SPA.
    If deployed as a standalone backend (e.g. on Vercel), return a JSON status
    confirming the backend API is online and healthy.
    """
    dist_dir = getattr(settings, 'FRONTEND_DIST', None)
    if dist_dir and (dist_dir / 'index.html').exists():
        from django.shortcuts import render
        return render(request, 'index.html')
    return JsonResponse({
        'name': 'Mathify Backend API',
        'status': 'online',
        'version': '1.0.0',
        'message': 'Mathify Backend API is running smoothly. Connect your frontend client or explore the endpoints below.',
        'endpoints': {
            'auth_token': '/api/auth/token/',
            'auth_refresh': '/api/auth/token/refresh/',
            'me': '/api/accounts/me/',
            'feed': '/api/feed/posts/',
            'competitions': '/api/rankings/competitions/',
            'leaderboard': '/api/rankings/leaderboard/',
            'library': '/api/library/resources/',
            'studio': '/api/studio/creations/',
            'ai_tutor': '/api/ai-tutor/chat/',
            'study_rooms': '/api/social/groups/',
            'admin': '/admin/',
        }
    })


# Route Vite compiled assets if dist exists
if getattr(settings, 'FRONTEND_DIST', None) and settings.FRONTEND_DIST.exists():
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': settings.FRONTEND_DIST / 'assets'}),
        re_path(r'^(?P<path>[^/]+\.(?:svg|png|ico|json|webmanifest))$', serve, {'document_root': settings.FRONTEND_DIST}),
    ]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^(?!api/|admin/|media/|static/|assets/).*$', spa_or_api_root, name='spa_catchall'),
]

