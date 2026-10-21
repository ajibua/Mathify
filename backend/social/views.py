from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
import secrets

from .models import Group, GroupMembership, GroupJoinRequest, Message, Call, CallSignal
from .serializers import GroupSerializer, GroupMembershipSerializer, GroupJoinRequestSerializer, MessageSerializer, CallSerializer


def _sync_call_ended(call, user=None):
    from django.utils import timezone
    from django.db.models import Q
    if not call:
        return
    call.status = Call.STATUS_ENDED
    if not call.ended_at:
        call.ended_at = timezone.now()
    call.save(update_fields=['status', 'ended_at'])

    if call.group:
        group = call.group
        
        if getattr(group, 'active_call_id', None) == call.id:
            group.active_call = None
            group.save(update_fields=['active_call'])

        initiator_name = (
            call.initiator.username
            if getattr(call, 'initiator', None)
            else (getattr(user, 'username', None) or 'host')
        )
        ended_content = f"[MEETING]:{call.id}:{call.meeting_code}:{call.title}:{initiator_name}:ended:"

           
        prefix = f"[MEETING]:{call.id}:"
        code_sub = f":{call.meeting_code}:"
        existing_msgs = list(group.messages.filter(
            Q(content__startswith=prefix) | Q(content__contains=code_sub)
        ).order_by('id'))

        if existing_msgs:
           
            last_msg = existing_msgs[-1]
            if last_msg.content != ended_content:
                last_msg.content = ended_content
                last_msg.save(update_fields=['content'])
           
            if len(existing_msgs) > 1:
                duplicate_ids = [m.id for m in existing_msgs[:-1]]
                group.messages.filter(id__in=duplicate_ids).delete()
        else:
           
            group.messages.create(
                sender=user if (user and getattr(user, 'is_authenticated', False)) else (call.initiator or None),
                content=ended_content
            )


class CallSignalThrottle(ScopedRateThrottle):
    scope = 'call_signal'


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'messages', 'current_call', 'call_signals']:
            return [permissions.IsAuthenticatedOrReadOnly()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Group.objects.prefetch_related('memberships')
        
        joined = self.request.query_params.get('joined')
        if joined == 'true':
            if self.request.user.is_authenticated:
                qs = qs.filter(memberships__user=self.request.user)
            else:
                return qs.none()
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
        if group.is_private and not group.memberships.filter(user=request.user).exists():
            join_request, created = GroupJoinRequest.objects.get_or_create(user=request.user, group=group)
            if join_request.status == GroupJoinRequest.STATUS_APPROVED:
                return Response({'detail': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
            if not created and join_request.status == GroupJoinRequest.STATUS_PENDING:
                return Response(GroupJoinRequestSerializer(join_request).data, status=status.HTTP_200_OK)
            join_request.status = GroupJoinRequest.STATUS_PENDING
            join_request.save(update_fields=['status', 'updated_at'])
            return Response(GroupJoinRequestSerializer(join_request).data, status=status.HTTP_201_CREATED)
        membership, created = GroupMembership.objects.get_or_create(
            user=request.user, group=group
        )
        if not created:
            return Response({'detail': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GroupMembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        group = self.get_object()
        is_creator = group.created_by_id == request.user.id
        is_admin_member = group.memberships.filter(user=request.user, role=GroupMembership.ROLE_ADMIN).exists()
        if not (is_creator or is_admin_member or request.user.is_staff):
            return Response({'detail': 'Only the group creator or admin can update room details.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        is_creator = group.created_by_id == request.user.id
        is_admin_member = group.memberships.filter(user=request.user, role=GroupMembership.ROLE_ADMIN).exists()
        if not (is_creator or is_admin_member or request.user.is_staff):
            return Response({'detail': 'Only the group creator or admin can delete this group.'}, status=status.HTTP_403_FORBIDDEN)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        group = self.get_object()
        GroupMembership.objects.filter(user=request.user, group=group).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        group = self.get_object()
        if not group.memberships.filter(user=request.user).exists() and group.created_by_id != request.user.id:
            return Response({'detail': 'Join the group to view its members.'}, status=status.HTTP_403_FORBIDDEN)
        memberships = group.memberships.select_related('user', 'user__profile').all()
        return Response(GroupMembershipSerializer(memberships, many=True).data)

    @action(detail=True, methods=['get'])
    def join_requests(self, request, pk=None):
        group = self.get_object()
        if group.created_by_id != request.user.id:
            return Response({'detail': 'Only the group creator can manage requests.'}, status=status.HTTP_403_FORBIDDEN)
        requests = group.join_requests.select_related('user', 'user__profile').filter(status=GroupJoinRequest.STATUS_PENDING)
        return Response(GroupJoinRequestSerializer(requests, many=True).data)

    @action(detail=True, methods=['post'], url_path=r'join-requests/(?P<request_id>[^/.]+)/approve')
    def approve_join_request(self, request, pk=None, request_id=None):
        group = self.get_object()
        if group.created_by_id != request.user.id:
            return Response({'detail': 'Only the group creator can approve requests.'}, status=status.HTTP_403_FORBIDDEN)
        join_request = group.join_requests.filter(id=request_id, status=GroupJoinRequest.STATUS_PENDING).first()
        if not join_request:
            return Response({'detail': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)
        GroupMembership.objects.get_or_create(user=join_request.user, group=group)
        join_request.status = GroupJoinRequest.STATUS_APPROVED
        join_request.save(update_fields=['status', 'updated_at'])
        return Response(GroupJoinRequestSerializer(join_request).data)

    @action(detail=True, methods=['post'], url_path=r'join-requests/(?P<request_id>[^/.]+)/decline')
    def decline_join_request(self, request, pk=None, request_id=None):
        group = self.get_object()
        if group.created_by_id != request.user.id:
            return Response({'detail': 'Only the group creator can decline requests.'}, status=status.HTTP_403_FORBIDDEN)
        join_request = group.join_requests.filter(id=request_id, status=GroupJoinRequest.STATUS_PENDING).first()
        if not join_request:
            return Response({'detail': 'Pending request not found.'}, status=status.HTTP_404_NOT_FOUND)
        join_request.status = GroupJoinRequest.STATUS_DECLINED
        join_request.save(update_fields=['status', 'updated_at'])
        return Response(GroupJoinRequestSerializer(join_request).data)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required to access group messages.'}, status=status.HTTP_401_UNAUTHORIZED)
        group = self.get_object()
        if not group.memberships.filter(user=request.user).exists() and group.created_by_id != getattr(request.user, 'id', None):
            return Response({'detail': 'Join this group to access its chat.'}, status=status.HTTP_403_FORBIDDEN)
        if request.method == 'POST':
            content = request.data.get('content', '').strip()
            media = request.FILES.get('media')
            if media and media.size > 50 * 1024 * 1024:
                return Response({'detail': 'Attachments must be 50 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)
            if not content and not media:
                return Response({'detail': 'Message content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required to post in study groups.'}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Ensure membership or automatically join if public
            GroupMembership.objects.get_or_create(user=request.user, group=group)
            msg = Message.objects.create(
                sender=request.user,
                group=group,
                content=content,
                media=media,
            )
            return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

        qs = group.messages.select_related('sender').order_by('created_at')
        since_id = request.query_params.get('since_id')
        if since_id and since_id.isdigit():
            qs = qs.filter(id__gt=int(since_id))
        else:
            # Self-healing cleanup of any legacy duplicate [MEETING] messages
            meeting_msgs = list(group.messages.filter(content__startswith='[MEETING]:').order_by('id'))
            seen_codes = {}
            to_delete_ids = []
            for m in meeting_msgs:
                parts = m.content.split(':')
                code = parts[2] if len(parts) > 2 else None
                if code:
                    if code in seen_codes:
                        to_delete_ids.append(seen_codes[code].id)
                        seen_codes[code] = m
                    else:
                        seen_codes[code] = m
            if to_delete_ids:
                group.messages.filter(id__in=to_delete_ids).delete()
                qs = group.messages.select_related('sender').order_by('created_at')
        return Response(MessageSerializer(qs, many=True).data)

    @action(detail=True, methods=['get', 'post'])
    def current_call(self, request, pk=None):
        from django.utils import timezone
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if request.method == 'POST':
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required to start or join seminar call.'}, status=status.HTTP_401_UNAUTHORIZED)
            if not call:
                unique_code = f"mtf-{secrets.token_urlsafe(9)}"
                call = Call.objects.create(
                    group=group,
                    initiator=request.user,
                    meeting_code=unique_code,
                    status=Call.STATUS_ACTIVE,
                    started_at=timezone.now()
                )
            elif not call.meeting_code:
                call.meeting_code = f"mtf-{secrets.token_urlsafe(9)}"
                call.save(update_fields=['meeting_code'])
            call.participants.add(request.user)
            return Response(CallSerializer(call).data)
        if call:
            return Response(CallSerializer(call).data)
        return Response({'status': 'idle', 'participants_count': 0})

    @action(detail=True, methods=['post'])
    def leave_call(self, request, pk=None):
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if call and request.user.is_authenticated:
            call.participants.remove(request.user)
            if call.participants.count() == 0:
                _sync_call_ended(call, request.user)
            return Response(CallSerializer(call).data)
        return Response({'status': 'none'})

    @action(detail=True, methods=['post'])
    def end_call(self, request, pk=None):
        group = self.get_object()
        call = group.calls.filter(status__in=[Call.STATUS_PENDING, Call.STATUS_ACTIVE]).first()
        if not call:
            call = group.calls.order_by('-created_at').first()
        if call:
            _sync_call_ended(call, request.user)
            return Response(CallSerializer(call).data)
        return Response({'status': 'none'})


    @action(detail=True, methods=['get', 'post'], throttle_classes=[CallSignalThrottle])
    def call_signals(self, request, pk=None):
        import datetime
        from django.utils import timezone
        from django.db.models import Q
        group = self.get_object()

        # Proactively ensure CallSignal table exists
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS social_callsignal (
                        id BIGSERIAL PRIMARY KEY,
                        signal_type VARCHAR(50) NOT NULL,
                        payload JSONB DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        call_id BIGINT,
                        group_id BIGINT NOT NULL,
                        recipient_id BIGINT,
                        sender_id BIGINT NOT NULL
                    );
                """)
        except Exception:
            pass

        if request.method == 'POST':
            if not request.user.is_authenticated:
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            recipient_username = request.data.get('recipient')
            signal_type = request.data.get('type', '')
            payload = request.data.get('payload', {})

            recipient = None
            if recipient_username:
                from accounts.models import CustomUser
                recipient = CustomUser.objects.filter(username=recipient_username).first()

            call = group.calls.filter(status=Call.STATUS_ACTIVE).first()
            try:
                sig = CallSignal.objects.create(
                    call=call,
                    group=group,
                    sender=request.user,
                    recipient=recipient,
                    signal_type=signal_type,
                    payload=payload
                )
                # Cleanup older signals (> 3 mins)
                cutoff = timezone.now() - datetime.timedelta(minutes=3)
                CallSignal.objects.filter(group=group, created_at__lt=cutoff).delete()
                return Response({'status': 'ok', 'id': sig.id}, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # GET signals
        if not request.user.is_authenticated:
            return Response([])

        since_id = request.query_params.get('since_id', 0)
        try:
            qs = CallSignal.objects.filter(group=group).filter(
                Q(recipient=request.user) | Q(recipient__isnull=True)
            ).exclude(sender=request.user)

            if since_id and str(since_id).isdigit() and int(since_id) > 0:
                qs = qs.filter(id__gt=int(since_id))

            signals_data = [{
                'id': s.id,
                'sender': s.sender.username,
                'recipient': s.recipient.username if s.recipient else None,
                'type': s.signal_type,
                'payload': s.payload,
                'created_at': s.created_at.isoformat()
            } for s in qs[:60]]
            return Response(signals_data)
        except Exception:
            return Response([])

    @action(detail=True, methods=['get', 'post'])
    def meetings(self, request, pk=None):
        import uuid
        from django.utils import timezone
        from django.db.models import Q
        group = self.get_object()

        if request.method == 'GET':
            calls = group.calls.filter(
                Q(status=Call.STATUS_ACTIVE) | Q(status=Call.STATUS_PENDING)
            ).order_by('-created_at')[:20]
            return Response(CallSerializer(calls, many=True).data)

        # POST: create instant or scheduled meeting
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)

        title = request.data.get('title', '').strip() or f"{group.name} Seminar"
        description = request.data.get('description', '').strip()
        scheduled_for_raw = request.data.get('scheduled_for')
        is_instant = request.data.get('is_instant', True)
        if isinstance(is_instant, str):
            is_instant = is_instant.lower() in ('true', '1', 'yes')

        scheduled_for = None
        if scheduled_for_raw:
            try:
                from django.utils.dateparse import parse_datetime
                scheduled_for = parse_datetime(scheduled_for_raw)
            except Exception:
                scheduled_for = None

        unique_suffix = uuid.uuid4().hex[:6]
        meeting_code = f"mtf-{unique_suffix[:3]}-{unique_suffix[3:]}"

        existing_active = group.calls.filter(status=Call.STATUS_ACTIVE).first()
        if is_instant and existing_active:
            existing_active.participants.add(request.user)
            return Response(CallSerializer(existing_active).data)

        status_val = Call.STATUS_ACTIVE if is_instant else Call.STATUS_PENDING
        started_at_val = timezone.now() if is_instant else None

        call = Call.objects.create(
            initiator=request.user,
            group=group,
            title=title,
            description=description,
            meeting_code=meeting_code,
            is_instant=is_instant,
            status=status_val,
            started_at=started_at_val,
            scheduled_for=scheduled_for,
        )
        if is_instant:
            call.participants.add(request.user)

        # Drop meeting card into group chat
        try:
            msg_status = "active" if is_instant else "scheduled"
            sched_str = call.scheduled_for.isoformat() if call.scheduled_for else ""
            Message.objects.create(
                sender=request.user,
                group=group,
                content=f"[MEETING]:{call.id}:{call.meeting_code}:{call.title}:{request.user.username}:{msg_status}:{sched_str}"
            )
        except Exception:
            pass

        return Response(CallSerializer(call).data, status=status.HTTP_201_CREATED)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Message.objects.none()
        from django.db.models import Q
        return Message.objects.filter(
            Q(sender=self.request.user) |
            Q(recipient=self.request.user) |
            Q(group__created_by=self.request.user) |
            Q(group__memberships__user=self.request.user, group__memberships__role=GroupMembership.ROLE_ADMIN)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in permissions.SAFE_METHODS:
            is_sender = obj.sender == request.user
            is_group_admin = (
                obj.group and (
                    obj.group.created_by == request.user or
                    obj.group.memberships.filter(user=request.user, role=GroupMembership.ROLE_ADMIN).exists()
                )
            )
            if not (is_sender or is_group_admin or request.user.is_staff):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only modify or delete messages you authored, or moderate messages in groups you manage.")

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
        if not self.request.user.is_authenticated:
            return Call.objects.none()
        from django.db.models import Q
        user = self.request.user
        return Call.objects.filter(
            Q(initiator=user) | Q(group__memberships__user=user) | Q(participants=user)
        ).distinct()

    def perform_create(self, serializer):
        from django.utils import timezone
        code = f"mtf-{secrets.token_urlsafe(9)}"
        call = serializer.save(
            initiator=self.request.user,
            meeting_code=code,
            status=Call.STATUS_ACTIVE,
            started_at=timezone.now()
        )
        call.participants.add(self.request.user)

    def perform_update(self, serializer):
        call = serializer.save()
        if call.group:
            prefix = f"[MEETING]:{call.id}:"
            code_sub = f":{call.meeting_code}:"
            from django.db.models import Q
            for msg in call.group.messages.filter(Q(content__startswith=prefix) | Q(content__contains=code_sub)):
                parts = msg.content.split(':')
                if len(parts) >= 6:
                    parts[3] = call.title
                    msg.content = ':'.join(parts)
                    msg.save(update_fields=['content'])

    @action(detail=False, methods=['get'], url_path='by-code/(?P<code>[^/.]+)', permission_classes=[permissions.AllowAny])
    def by_code(self, request, code=None):
        call = Call.objects.filter(meeting_code=code).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
        if call.status == Call.STATUS_ENDED:
            return Response({'detail': 'This meeting has ended.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        from django.utils import timezone
        call = Call.objects.filter(id=pk).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
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
        call = Call.objects.filter(id=pk).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.is_authenticated:
            call.participants.remove(request.user)
        if call.participants.count() == 0:
            _sync_call_ended(call, request.user)
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        call = Call.objects.filter(id=pk).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        is_host = bool(
            call.initiator_id == user.id or
            (call.group and (call.group.created_by_id == user.id or call.group.memberships.filter(user=user, role='admin').exists())) or
            user.is_staff
        )
        if not is_host:
            return Response({'detail': 'Only the host can end the meeting for everyone.'}, status=status.HTTP_403_FORBIDDEN)
        _sync_call_ended(call, request.user)
        return Response(CallSerializer(call).data)

    @action(detail=True, methods=['get'], url_path='token')
    def token(self, request, pk=None):
        call = Call.objects.filter(id=pk).first()
        if not call:
            return Response({'detail': 'Meeting not found.'}, status=status.HTTP_404_NOT_FOUND)
        if call.status == Call.STATUS_ENDED:
            return Response({'detail': 'Call has already ended.'}, status=status.HTTP_400_BAD_REQUEST)

        # Record authenticated user as participant upon token retrieval
        call.participants.add(request.user)

        from decouple import config
        livekit_url = config('LIVEKIT_URL', default=None)
        api_key = config('LIVEKIT_API_KEY', default=None)
        api_secret = config('LIVEKIT_API_SECRET', default=None)

        if not livekit_url or not api_key or not api_secret:
            return Response({
                'fallback_mode': True,
                'message': 'LiveKit SFU not configured. Operating in WebRTC P2P fallback mode.'
            })

        try:
            from livekit import api
            user = request.user
            is_host = bool(
                call.initiator_id == user.id or
                (call.group and (call.group.created_by_id == user.id or call.group.memberships.filter(user=user, role='admin').exists())) or
                user.is_staff
            )

            token = api.AccessToken(api_key, api_secret) \
                .with_identity(user.username) \
                .with_name(user.get_full_name() or user.username) \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=call.meeting_code or f"call-{call.id}",
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                    room_admin=is_host,
                ))

            call.participants.add(user)
            if call.status == Call.STATUS_PENDING:
                from django.utils import timezone
                call.status = Call.STATUS_ACTIVE
                if not call.started_at:
                    call.started_at = timezone.now()
                call.save()

            return Response({
                'token': token.to_jwt(),
                'server_url': livekit_url,
                'room_name': call.meeting_code or f"call-{call.id}",
                'fallback_mode': False,
                'is_host': is_host,
            })
        except Exception as e:
            return Response({
                'fallback_mode': True,
                'error': str(e),
                'message': 'Error initializing LiveKit token. Reverting to WebRTC P2P fallback mode.'
            })