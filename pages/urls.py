from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login, name='login'),
    path('register/', views.register, name='register'),
    path('', views.landing, name='landing'),
    path('feed/', views.feed, name='feed'),
    path('profile/', views.profile, name='profile'),
    path('profile/edit/', views.profile_edit, name='profile_edit'),
    path('groups/', views.groups, name='groups'),
    path('groups/calls/', views.groups_calls, name='groups_calls'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('competitions/', views.competitions, name='competitions'),
    path('library/', views.library, name='library'),
    path('studio/', views.studio, name='studio'),
    path('tutor/', views.ai_chat, name='ai_chat'),
    path('tutor/chat/', views.ai_chat, name='ai_chat_old'),
]