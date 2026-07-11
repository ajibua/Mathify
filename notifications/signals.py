from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from feed.models import Like, Comment, Follow
from .models import Notification

User = get_user_model()

@receiver(post_save, sender=Like)
def create_like_notification(sender, instance, created, **kwargs):
    if created:
        # Don't notify if user liked their own post
        if instance.user != instance.post.author:
            Notification.objects.create(
                user=instance.post.author,
                actor=instance.user,
                verb='liked your post',
                target_type='post',
                target_id=instance.post.id,
                data={'post_content': instance.post.content[:50]}
            )

@receiver(post_save, sender=Comment)
def create_comment_notification(sender, instance, created, **kwargs):
    if created:
        # Don't notify if user commented on their own post
        if instance.user != instance.post.author:
            Notification.objects.create(
                user=instance.post.author,
                actor=instance.user,
                verb='commented on your post',
                target_type='post',
                target_id=instance.post.id,
                data={'comment_content': instance.content[:50]}
            )
        # Notify user when their comment receives a reply
        if instance.parent and instance.user != instance.parent.user:
            Notification.objects.create(
                user=instance.parent.user,
                actor=instance.user,
                verb='replied to your comment',
                target_type='comment',
                target_id=instance.parent.id,
                data={'comment_content': instance.content[:50]}
            )

@receiver(post_save, sender=Follow)
def create_follow_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.following,
            actor=instance.follower,
            verb='started following you',
            target_type='user',
            target_id=instance.follower.id
        )
