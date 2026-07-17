from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Group, GroupMembership, Message, Call
from .serializers import GroupSerializer, GroupMembershipSerializer, MessageSerializer, CallSerializer


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Group.objects.prefetch_related('memberships')
        
        joined = self.request.query_params.get('joined')
        if joined == 'true' and self.request.user.is_authenticated:
            qs = qs.filter(memberships__user=self.request.user)
        elif joined == 'false' and self.request.user.is_authenticated:
            qs = qs.exclude(memberships__user=self.request.user)

        query = self.request.query_params.get('q')
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=query) | Q(description__icontains=query))
        group_type = self.request.query_params.get('group_type')
        if group_type:
            qs = qs.filter(group_type=group_type)
        return qs

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # creator becomes admin automatically
        GroupMembership.objects.create(
            user=self.request.user, group=group, role=GroupMembership.ROLE_ADMIN
        )

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        group = self.get_object()
        membership, created = GroupMembership.objects.get_or_create(
            user=request.user, group=group
        )
        if not created:
            return Response({'detail': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GroupMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        group = self.get_object()
        GroupMembership.objects.filter(user=request.user, group=group).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        group = self.get_object()
        qs = group.messages.select_related('sender').order_by('created_at')
        return Response(MessageSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def current_call(self, request, pk=None):
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if call:
            return Response(CallSerializer(call).data)
        return Response(None)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(
            sender=self.request.user
        ) | Message.objects.filter(recipient=self.request.user)

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['get'])
    def conversations(self, request):
        from django.db.models import Q
        user = request.user
        # Find all direct messages (where group is null and sender or recipient is current user)
        direct_msgs = Message.objects.filter(
            group__isnull=True
        ).filter(
            Q(sender=user) | Q(recipient=user)
        ).order_by('-created_at')
        
        seen_partners = set()
        conversations = []
        for msg in direct_msgs:
            partner = msg.recipient if msg.sender == user else msg.sender
            if not partner or partner.id in seen_partners:
                continue
            seen_partners.add(partner.id)
            
            # Serialize partner using UserSerializer
            from accounts.serializers import UserSerializer
            conversations.append({
                'id': partner.id,
                'user': UserSerializer(partner).data,
                'last_message': {
                    'content': msg.content,
                    'media': msg.media.url if msg.media else None,
                    'created_at': msg.created_at,
                    'sender': msg.sender.username
                }
            })
            
        return Response(conversations)

    @action(detail=False, methods=['get'])
    def history(self, request):
        from django.db.models import Q
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id query param required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        messages = Message.objects.filter(
            group__isnull=True
        ).filter(
            (Q(sender=user) & Q(recipient_id=user_id)) |
            (Q(sender_id=user_id) & Q(recipient=user))
        ).order_by('created_at')
        
        # Mark incoming messages as read
        messages.filter(recipient=user, is_read=False).update(is_read=True)
        
        return Response(MessageSerializer(messages, many=True).data)


class CallViewSet(viewsets.ModelViewSet):
    serializer_class = CallSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        return Call.objects.filter(
            Q(initiator=user) | Q(group__memberships__user=user)
        ).distinct()

    def perform_create(self, serializer):
        from django.utils import timezone
        call = serializer.save(
            initiator=self.request.user,
            status=Call.STATUS_ACTIVE,
            started_at=timezone.now()
        )
        call.participants.add(self.request.user)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        from django.utils import timezone
        call = self.get_object()
        if call.status == Call.STATUS_ENDED:
            return Response({'detail': 'Call has already ended.'}, status=status.HTTP_400_BAD_REQUEST)
        call.participants.add(request.user)
        if call.status == Call.STATUS_PENDING:
            call.status = Call.STATUS_ACTIVE
            if not call.started_at:
                call.started_at = timezone.now()
            call.save()
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        from django.utils import timezone
        call = self.get_object()
        call.participants.remove(request.user)
        if call.participants.count() == 0:
            call.status = Call.STATUS_ENDED
            call.ended_at = timezone.now()
            call.save()
        return Response(CallSerializer(call).data)