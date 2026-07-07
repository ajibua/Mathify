from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'actor', 'verb', 'target_type', 'target_id',
            'data', 'is_read', 'created_at',
        ]
        read_only_fields = ['id', 'actor', 'created_at']
