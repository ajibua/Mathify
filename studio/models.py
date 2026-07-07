from django.db import models
from django.conf import settings


class Formula(models.Model):
    name = models.CharField(max_length=200)
    latex_expression = models.TextField()
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='formulas'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['-created_at']


class Creation(models.Model):
    VISIBILITY_PUBLIC = 'public'
    VISIBILITY_PRIVATE = 'private'
    VISIBILITY_GROUP = 'group'
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, 'Public'),
        (VISIBILITY_PRIVATE, 'Private'),
        (VISIBILITY_GROUP, 'Group Only'),
    ]

    title = models.CharField(max_length=300)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creations'
    )
    content = models.TextField(blank=True)         # rich text / markdown
    latex_content = models.TextField(blank=True)   # raw LaTeX source
    formulas = models.ManyToManyField(Formula, blank=True, related_name='used_in')
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-updated_at']