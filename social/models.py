from django.db import models
from django.conf import settings


class Group(models.Model):
    TYPE_STUDY = 'study'
    TYPE_DEPT = 'department'
    TYPE_COMP = 'competition'
    GROUP_TYPES = [
        (TYPE_STUDY, 'Study Group'),
        (TYPE_DEPT, 'Department'),
        (TYPE_COMP, 'Competition'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    group_type = models.CharField(max_length=20, choices=GROUP_TYPES, default=TYPE_STUDY)
    avatar = models.ImageField(upload_to='groups/', blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_groups'
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='GroupMembership', related_name='joined_groups'
    )
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']


class GroupMembership(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_MOD = 'moderator'
    ROLE_MEMBER = 'member'
    ROLES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_MOD, 'Moderator'),
        (ROLE_MEMBER, 'Member'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships'
    )
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLES, default=ROLE_MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'group')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.role})"


class Message(models.Model):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages'
    )
    # group message OR direct message
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE,
        related_name='messages', null=True, blank=True
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='received_messages', null=True, blank=True
    )
    content = models.TextField()
    media = models.FileField(upload_to='messages/', blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        target = self.group or self.recipient
        return f"{self.sender.username} → {target}"


class Call(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACTIVE = 'active'
    STATUS_ENDED = 'ended'
    STATUS_MISSED = 'missed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_ENDED, 'Ended'),
        (STATUS_MISSED, 'Missed'),
    ]

    initiator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='initiated_calls'
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE,
        related_name='calls', null=True, blank=True
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Call by {self.initiator.username} [{self.status}]"