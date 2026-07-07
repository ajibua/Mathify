from rest_framework import serializers
from .models import TutorProfile, ChatSession, SessionMessage


class TutorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TutorProfile
        fields = ['id', 'name', 'subject', 'description', 'avatar', 'is_active']


class SessionMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionMessage
        fields = ['id', 'role', 'content', 'file_data', 'file_name', 'file_mime', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    tutor = TutorProfileSerializer(read_only=True)
    tutor_id = serializers.PrimaryKeyRelatedField(
        queryset=TutorProfile.objects.filter(is_active=True),
        source='tutor', write_only=True, required=False, allow_null=True
    )
    messages = SessionMessageSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = [
            'id', 'user', 'tutor', 'tutor_id', 'title',
            'messages', 'last_message', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        last = obj.messages.last()
        return SessionMessageSerializer(last).data if last else None


class ChatSessionListSerializer(ChatSessionSerializer):
    """Lighter serializer for list view — excludes full message history."""
    class Meta(ChatSessionSerializer.Meta):
        fields = ['id', 'user', 'tutor', 'title', 'last_message', 'updated_at']


class SendMessageSerializer(serializers.Serializer):
    """Validates incoming user message before passing to AI."""
    content = serializers.CharField(min_length=1, max_length=4000)
    file_data = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    file_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    file_mime = serializers.CharField(required=False, allow_null=True, allow_blank=True)