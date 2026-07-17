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
            .filter(period=period, competition__isnull=True)
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


class ScoreViewSet(viewsets.ModelViewSet):
    serializer_class = ScoreSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Score.objects.all()

    @action(detail=False, methods=['post'])
    def award_points(self, request):
        competition_id = request.data.get('competition_id')
        if not competition_id:
            from rest_framework import status
            return Response({'detail': 'competition_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        from rest_framework import status
        from .models import Competition

        comp = Competition.objects.filter(id=competition_id, is_active=True).first()
        if not comp:
            return Response({'detail': 'Active competition not found.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if now < comp.start_date or now > comp.end_date:
            return Response({'detail': 'Competition is not currently active.'}, status=status.HTTP_400_BAD_REQUEST)

        points = 10  # Enforce strictly 10 points per participation request
        user = request.user
        
        # Increment user Profile points
        profile = user.profile
        profile.axiom_points += points
        profile.save()

        # Increment global standings score
        score_global, _ = Score.objects.get_or_create(
            user=user, period=Score.PERIOD_ALL_TIME, competition=None
        )
        score_global.points += points
        score_global.save()

        # Increment competition standings score
        score_comp, _ = Score.objects.get_or_create(
            user=user, period=Score.PERIOD_ALL_TIME, competition=comp
        )
        score_comp.points += points
        score_comp.save()

        return Response({
            'axiom_points': profile.axiom_points,
            'global_points': score_global.points,
            'competition_points': score_comp.points
        })