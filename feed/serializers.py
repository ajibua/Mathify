from rest_framework import serializers
from .models import Post, Like, Comment, Follow


class CommentSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'user', 'content', 'parent', 'replies', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_replies(self, obj):
        if obj.replies.exists():
            return CommentSerializer(obj.replies.all(), many=True).data
        return []


class PostSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    author_id = serializers.ReadOnlyField(source='author.id')
    likes_count = serializers.ReadOnlyField()
    comments_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()

    MAX_CONTENT_LENGTH = 4000
    MAX_LATEX_LENGTH = 8000
    MAX_MEDIA_BYTES = 10 * 1024 * 1024
    IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'}
    VIDEO_TYPES = {'video/mp4', 'video/webm', 'video/ogg'}

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'author_id', 'content', 'latex_content', 'media',
            'post_type', 'likes_count', 'comments_count', 'is_liked',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'author_id', 'created_at', 'updated_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        post_type = attrs.get('post_type', getattr(instance, 'post_type', Post.TYPE_TEXT))
        content = attrs.get('content', getattr(instance, 'content', '')) or ''
        latex_content = attrs.get('latex_content', getattr(instance, 'latex_content', '')) or ''
        media = attrs.get('media', getattr(instance, 'media', None))

        content = content.strip()
        latex_content = latex_content.strip()

        if not content and not latex_content and not media:
            raise serializers.ValidationError('Post requires content, latex_content, or media.')

        if len(content) > self.MAX_CONTENT_LENGTH:
            raise serializers.ValidationError({'content': 'Content is too long.'})

        if len(latex_content) > self.MAX_LATEX_LENGTH:
            raise serializers.ValidationError({'latex_content': 'LaTeX content is too long.'})

        if post_type == Post.TYPE_FORMULA and not latex_content:
            raise serializers.ValidationError({'latex_content': 'Formula posts require LaTeX content.'})

        if media is not None:
            if media.size > self.MAX_MEDIA_BYTES:
                raise serializers.ValidationError({'media': 'Media file is too large.'})

            content_type = getattr(media, 'content_type', '')
            if post_type == Post.TYPE_IMAGE and content_type not in self.IMAGE_TYPES:
                raise serializers.ValidationError({'media': 'Invalid image type.'})
            if post_type == Post.TYPE_VIDEO and content_type not in self.VIDEO_TYPES:
                raise serializers.ValidationError({'media': 'Invalid video type.'})
            if post_type in {Post.TYPE_TEXT, Post.TYPE_FORMULA}:
                raise serializers.ValidationError({'media': 'Media not allowed for this post type.'})

        return attrs


class LikeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Like
        fields = ['id', 'post', 'created_at']
        read_only_fields = ['id', 'created_at']


class FollowSerializer(serializers.ModelSerializer):
    follower = serializers.StringRelatedField(read_only=True)
    following = serializers.StringRelatedField(read_only=True)
    following_user_id = serializers.ReadOnlyField(source='following.id')
    following_id = serializers.PrimaryKeyRelatedField(
        source='following', queryset=__import__('accounts.models', fromlist=['CustomUser']).CustomUser.objects.all(),
        write_only=True,
    )

    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'following_id', 'following_user_id', 'created_at']
        read_only_fields = ['id', 'follower', 'following', 'following_user_id', 'created_at']