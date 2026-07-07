from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BadgeViewSet, UserBadgeViewSet, CompetitionViewSet, LeaderboardView

router = DefaultRouter()
router.register('badges', BadgeViewSet, basename='badge')
router.register('user-badges', UserBadgeViewSet, basename='user-badge')
router.register('competitions', CompetitionViewSet, basename='competition')

urlpatterns = [
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('', include(router.urls)),
]