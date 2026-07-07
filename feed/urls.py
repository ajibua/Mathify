from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PostViewSet, FollowViewSet

router = DefaultRouter()
router.register('posts', PostViewSet, basename='post')
router.register('follows', FollowViewSet, basename='follow')

urlpatterns = [
    path('', include(router.urls)),
]