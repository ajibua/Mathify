from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Category, Tag, Resource, Bookmark
from .serializers import CategorySerializer, TagSerializer, ResourceSerializer, BookmarkSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TagSerializer
    queryset = Tag.objects.all()


class ResourceViewSet(viewsets.ModelViewSet):
    serializer_class = ResourceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Resource.objects.select_related('category', 'uploaded_by').prefetch_related('tags', 'bookmarks')
        resource_type = self.request.query_params.get('type')
        category = self.request.query_params.get('category')
        bookmarked = self.request.query_params.get('bookmarked')
        
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if category:
            qs = qs.filter(category__slug=category)
        if bookmarked == 'true' and self.request.user.is_authenticated:
            qs = qs.filter(bookmarks__user=self.request.user)
        
        query = self.request.query_params.get('q')
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=query) | Q(description__icontains=query))
            
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def bookmark(self, request, pk=None):
        resource = self.get_object()
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, resource=resource)
        if not created:
            bookmark.delete()
            return Response({'bookmarked': False})
        return Response({'bookmarked': True}, status=status.HTTP_201_CREATED)