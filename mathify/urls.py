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
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.views.generic import TemplateView
 

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('pages.urls')),
 
    # JWT auth
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
 
    # apps
    path('api/accounts/', include('accounts.urls')),
    path('api/feed/', include('feed.urls')),
    path('api/social/', include('social.urls')),
    path('api/library/', include('library.urls')),
    path('api/studio/', include('studio.urls')),
    path('api/rankings/', include('rankings.urls')),
    path('api/ai-tutor/', include('ai_tutor.urls')),
    path('api/', include('notifications.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# ── Frontend template routes ───────────────────────────────────────────────

TEMPLATE_ROUTES = [
    ('ai-tutor-directory/', 'ai_tutor_directory/code.html'),
    ('axiom-rank-leaderboard/', 'axiom_rank_leaderboard/code.html'),
    ('calculus-ai-chat/', 'calculus_ai_chat/code.html'),
    ('feed-math-toks/', 'feed_math_toks/code.html'),
    ('groups-chats/', 'groups_chats/code.html'),
    ('groups-chats-with-calls/', 'groups_chats_with_calls/code.html'),
    ('join-the-department/', 'join_the_department/code.html'),
    ('login-to-axiom/', 'login_to_axiom/code.html'),
    ('math-library/', 'math_library/code.html'),
    ('math-studio/', 'math_studio/code.html'),
    ('study-groups-competitions/', 'study_groups_competitions/code.html'),
]

for route, template_name in TEMPLATE_ROUTES:
    urlpatterns.append(
        path(
            route,
            TemplateView.as_view(template_name=template_name),
            name=template_name.replace('/', '_').replace('.html', ''),
        )
    )

