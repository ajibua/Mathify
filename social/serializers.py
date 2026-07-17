from rest_framework import serializers
from .models import Group, GroupMembership, Message, Call


class GroupMembershipSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = GroupMembership
        fields = ['id', 'user', 'role', 'joined_at']


class GroupSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'group_type', 'avatar',
            'created_by', 'is_private', 'member_count', 'is_member', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.memberships.filter(user=request.user).exists()
        return False


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'group', 'recipient', 'content', 'media', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']


class CallSerializer(serializers.ModelSerializer):
    initiator = serializers.StringRelatedField(read_only=True)
    initiator_username = serializers.CharField(source='initiator.username', read_only=True)
    participants = serializers.SlugRelatedField(many=True, read_only=True, slug_field='username')
    participants_count = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            'id', 'initiator', 'initiator_username', 'group', 'status',
            'participants', 'participants_count', 'started_at', 'ended_at', 'created_at'
        ]
        read_only_fields = ['id', 'initiator', 'created_at']

    def get_participants_count(self, obj):
        return obj.participants.count()