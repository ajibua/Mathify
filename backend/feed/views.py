from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q, Exists, OuterRef, Value, BooleanField
from mathify.permissions import IsOwnerOrReadOnly

from .models import Post, Like, Comment, Follow
from .serializers import PostSerializer, LikeSerializer, CommentSerializer, FollowSerializer


class IsAuthorOrReadOnly(IsOwnerOrReadOnly):
    """
    Object-level permission to only allow authors of a post to edit or delete it.
    """
    pass


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    throttle_scope = 'feed_post'

    def get_queryset(self):
        user = self.request.user
        qs = Post.objects.select_related('author__profile')

        if user.is_authenticated:
            is_liked_sub = Exists(Like.objects.filter(post=OuterRef('pk'), user=user))
            qs = qs.annotate(_is_liked=is_liked_sub)
        else:
            qs = qs.annotate(_is_liked=Value(False, output_field=BooleanField()))

        author = self.request.query_params.get('author')
        if author:
            qs = qs.filter(author_id=author)

        post_type = self.request.query_params.get('post_type')
        if post_type:
            qs = qs.filter(post_type=post_type)

        query = self.request.query_params.get('q')
        if query:
            qs = qs.filter(Q(content__icontains=query) | Q(latex_content__icontains=query))

        # /api/feed/posts/?feed=following  → posts by users a person follows.
        if self.request.query_params.get('feed') == 'following' and user.is_authenticated:
            followed_ids = user.following.values_list('following_id', flat=True)
            return qs.filter(author_id__in=followed_ids)

        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def upload_url(self, request):
        """
        Generate a presigned S3 PUT URL for direct-to-storage upload,
        bypassing Vercel's 4.5 MB serverless function payload limit.
        """
        import uuid
        import re
        from django.conf import settings
        from decouple import config

        filename = request.data.get('filename', 'media')
        content_type = request.data.get('content_type', 'application/octet-stream')

        safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
        file_key = f"posts/media/{uuid.uuid4().hex}_{safe_name}"

        use_supabase = getattr(settings, 'USE_SUPABASE_STORAGE', False)
        if use_supabase:
            import boto3
            bucket_name = config('SUPABASE_STORAGE_BUCKET_NAME', default='mathify-media').strip()
            endpoint = config('SUPABASE_STORAGE_ENDPOINT', default='').strip()
            access_key = config('SUPABASE_STORAGE_ACCESS_KEY', default='').strip()
            secret_key = config('SUPABASE_STORAGE_SECRET_KEY', default='').strip()
            region = config('SUPABASE_STORAGE_REGION', default='eu-west-1').strip()

            try:
                s3_client = boto3.client(
                    's3',
                    endpoint_url=endpoint,
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                )
                upload_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': bucket_name,
                        'Key': file_key,
                        'ContentType': content_type,
                    },
                    ExpiresIn=3600,
                )
                media_url = f"{settings.MEDIA_URL.rstrip('/')}/{file_key}"
                return Response({
                    'upload_url': upload_url,
                    'file_key': file_key,
                    'media_url': media_url,
                    'direct_upload': True,
                })
            except Exception as e:
                print(f"[UploadUrl] S3 presign failed: {e}")

        return Response({'direct_upload': False, 'message': 'Direct storage upload not configured.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({'liked': False})
        return Response({'liked': True}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], permission_classes=[permissions.IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            qs = post.comments.filter(parent__isnull=True).select_related('user__profile')
            return Response(CommentSerializer(qs, many=True, context={'request': request}).data)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, post=post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FollowViewSet(viewsets.ModelViewSet):
    serializer_class = FollowSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = Follow.objects.all()
        follower = self.request.query_params.get('follower')
        following = self.request.query_params.get('following')

        if follower:
            qs = qs.filter(follower_id=follower)
        if following:
            qs = qs.filter(following_id=following)

        if not follower and not following:
            qs = qs.filter(follower=self.request.user)

        return qs

    def perform_create(self, serializer):
        serializer.save(follower=self.request.user)

    def perform_destroy(self, instance):
        if instance.follower != self.request.user:
            raise PermissionDenied("You can only unfollow your own follow relationships.")
        instance.delete()

    @action(detail=False, methods=['get'])
    def friends(self, request):
        user = request.user
        # Mutual follows: current user follows them, and they follow current user back
        following_ids = Follow.objects.filter(follower=user).values_list('following_id', flat=True)
        mutual_follows = Follow.objects.filter(
            follower_id__in=following_ids,
            following=user
        ).select_related('follower__profile__department')
        
        # Serialize the matching users
        from accounts.serializers import UserSerializer
        users = [f.follower for f in mutual_follows]
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)