from django.db import models
from django.conf import settings


class Badge(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    icon = models.CharField(max_length=100, blank=True)  # icon name or path
    criteria = models.TextField()
    points_required = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['points_required']


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='earned_badges'
    )
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='holders')
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'badge')

    def __str__(self):
        return f"{self.user.username} — {self.badge.name}"


class Competition(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_competitions'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-start_date']


class Score(models.Model):
    PERIOD_DAILY = 'daily'
    PERIOD_WEEKLY = 'weekly'
    PERIOD_MONTHLY = 'monthly'
    PERIOD_ALL_TIME = 'all_time'
    PERIOD_CHOICES = [
        (PERIOD_DAILY, 'Daily'),
        (PERIOD_WEEKLY, 'Weekly'),
        (PERIOD_MONTHLY, 'Monthly'),
        (PERIOD_ALL_TIME, 'All Time'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scores'
    )
    competition = models.ForeignKey(
        Competition, on_delete=models.CASCADE,
        related_name='scores', null=True, blank=True
    )
    points = models.PositiveIntegerField(default=0)
    period = models.CharField(max_length=20, choices=PERIOD_CHOICES, default=PERIOD_ALL_TIME)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-points']

    def __str__(self):
        return f"{self.user.username}: {self.points}pts ({self.period})"