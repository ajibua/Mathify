from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, TagViewSet, ResourceViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('tags', TagViewSet, basename='tag')
router.register('resources', ResourceViewSet, basename='resource')

urlpatterns = [path('', include(router.urls))]