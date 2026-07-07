from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum

from .models import Badge, UserBadge, Competition, Score
from .serializers import (
    BadgeSerializer, UserBadgeSerializer,
    CompetitionSerializer, ScoreSerializer, LeaderboardEntrySerializer,
)


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BadgeSerializer
    queryset = Badge.objects.all()


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserBadgeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = UserBadge.objects.select_related('user', 'badge')
        user_id = self.request.query_params.get('user')
        if user_id:
            return qs.filter(user_id=user_id)
        if self.request.user.is_authenticated:
            return qs.filter(user=self.request.user)
        return qs.none()


class CompetitionViewSet(viewsets.ModelViewSet):
    serializer_class = CompetitionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    queryset = Competition.objects.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class LeaderboardView(generics.ListAPIView):
    """
    GET /api/rankings/leaderboard/?period=weekly
    Returns ranked list of users by total points for the given period.
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request, *args, **kwargs):
        period = request.query_params.get('period', Score.PERIOD_ALL_TIME)
        scores = (
            Score.objects
            .filter(period=period)
            .select_related('user')
            .order_by('-points')
        )
        data = []
        for rank, score in enumerate(scores, start=1):
            data.append({
                'rank': rank,
                'user': str(score.user),
                'points': score.points,
                'badge_count': score.user.earned_badges.count(),
            })
        serializer = LeaderboardEntrySerializer(data, many=True)
        return Response(serializer.data)