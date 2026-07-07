from django.db import models
from django.conf import settings


class Post(models.Model):
    TYPE_TEXT = 'text'
    TYPE_FORMULA = 'formula'
    TYPE_IMAGE = 'image'
    TYPE_VIDEO = 'video'
    POST_TYPES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_FORMULA, 'Formula'),
        (TYPE_IMAGE, 'Image'),
        (TYPE_VIDEO, 'Video'),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts'
    )
    content = models.TextField()
    latex_content = models.TextField(blank=True)  # raw LaTeX for formula posts
    media = models.FileField(upload_to='posts/media/', blank=True, null=True)
    post_type = models.CharField(max_length=20, choices=POST_TYPES, default=TYPE_TEXT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author.username} — {self.post_type} ({self.pk})"

    @property
    def likes_count(self):
        return self.likes.count()

    @property
    def comments_count(self):
        return self.comments.filter(parent__isnull=True).count()


class Like(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='liked_posts'
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')

    def __str__(self):
        return f"{self.user.username} ♥ post {self.post_id}"


class Comment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments'
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.CASCADE, related_name='replies'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username} on post {self.post_id}"


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='following'
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower.username} → {self.following.username}"