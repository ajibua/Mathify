from rest_framework import serializers
from .models import Category, Tag, Resource, Bookmark


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'parent']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']


class ResourceSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField(read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category',
        write_only=True, required=False, allow_null=True
    )
    tags = TagSerializer(many=True, read_only=True)
    bookmark_count = serializers.ReadOnlyField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'resource_type', 'file', 'url',
            'category', 'category_id', 'tags', 'uploaded_by',
            'bookmark_count', 'is_bookmarked', 'created_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.bookmarks.filter(user=request.user).exists()
        return False


class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ['id', 'resource', 'created_at']
        read_only_fields = ['id', 'created_at']