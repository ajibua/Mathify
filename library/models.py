from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='subcategories'
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'categories'
        ordering = ['name']


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class Resource(models.Model):
    TYPE_NOTE = 'note'
    TYPE_FORMULA = 'formula_sheet'
    TYPE_VIDEO = 'video'
    TYPE_PROBLEM = 'problem_set'
    TYPE_TEXTBOOK = 'textbook'
    RESOURCE_TYPES = [
        (TYPE_NOTE, 'Note'),
        (TYPE_FORMULA, 'Formula Sheet'),
        (TYPE_VIDEO, 'Video'),
        (TYPE_PROBLEM, 'Problem Set'),
        (TYPE_TEXTBOOK, 'Textbook'),
    ]

    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPES)
    file = models.FileField(upload_to='library/', blank=True, null=True)
    url = models.URLField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='resources'
    )
    tags = models.ManyToManyField(Tag, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_resources'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']

    @property
    def bookmark_count(self):
        return self.bookmarks.count()


class Bookmark(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks'
    )
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'resource')

    def __str__(self):
        return f"{self.user.username} bookmarked {self.resource.title}"