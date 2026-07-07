from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from .models import Post, Like, Comment, Follow
from .serializers import PostSerializer, LikeSerializer, CommentSerializer, FollowSerializer


class IsAuthorOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow authors of a post to edit or delete it.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Post.objects.select_related('author').prefetch_related('likes', 'comments')

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
            qs = post.comments.filter(parent__isnull=True).select_related('user')
            return Response(CommentSerializer(qs, many=True, context={'request': request}).data)
        serializer = CommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, post=post)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FollowViewSet(viewsets.ModelViewSet):
    serializer_class = FollowSerializer
    permission_classes = [permissions.IsAuthenticated]

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