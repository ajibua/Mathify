from django.db import models
from django.conf import settings


class TutorProfile(models.Model):
    SUBJECT_CALCULUS = 'calculus'
    SUBJECT_ALGEBRA = 'algebra'
    SUBJECT_STATISTICS = 'statistics'
    SUBJECT_GEOMETRY = 'geometry'
    SUBJECT_NUMBER_THEORY = 'number_theory'
    SUBJECT_GENERAL = 'general'
    SUBJECTS = [
        (SUBJECT_CALCULUS, 'Calculus'),
        (SUBJECT_ALGEBRA, 'Algebra'),
        (SUBJECT_STATISTICS, 'Statistics'),
        (SUBJECT_GEOMETRY, 'Geometry'),
        (SUBJECT_NUMBER_THEORY, 'Number Theory'),
        (SUBJECT_GENERAL, 'General Math'),
    ]

    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=50, choices=SUBJECTS, default=SUBJECT_GENERAL)
    description = models.TextField()
    avatar = models.ImageField(upload_to='tutors/', blank=True, null=True)
    
    model_config = models.JSONField(
        default=dict,
        help_text='Keys: system_prompt, temperature, model_id'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_subject_display()})"

    class Meta:
        ordering = ['subject', 'name']


class ChatSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_sessions'
    )
    tutor = models.ForeignKey(
        TutorProfile, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sessions'
    )
    title = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — {self.title or 'Untitled session'}"

    class Meta:
        ordering = ['-updated_at']


class SessionMessage(models.Model):
    ROLE_USER = 'user'
    ROLE_ASSISTANT = 'assistant'
    ROLES = [
        (ROLE_USER, 'User'),
        (ROLE_ASSISTANT, 'Assistant'),
    ]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=20, choices=ROLES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    file_data = models.TextField(blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_mime = models.CharField(max_length=100, blank=True, null=True)
    def __str__(self):
        return f"[{self.role}] session {self.session_id}"

    class Meta:
        ordering = ['created_at']