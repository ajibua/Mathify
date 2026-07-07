from rest_framework import serializers
from .models import Badge, UserBadge, Competition, Score


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ['id', 'name', 'description', 'icon', 'criteria', 'points_required']


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = UserBadge
        fields = ['id', 'user', 'badge', 'awarded_at']


class CompetitionSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Competition
        fields = ['id', 'name', 'description', 'start_date', 'end_date', 'created_by', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class ScoreSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    competition = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Score
        fields = ['id', 'user', 'competition', 'points', 'period', 'updated_at']
        read_only_fields = ['id', 'user', 'updated_at']


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    user = serializers.StringRelatedField()
    points = serializers.IntegerField()
    badge_count = serializers.IntegerField()