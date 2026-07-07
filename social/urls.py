from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GroupViewSet, MessageViewSet, CallViewSet

router = DefaultRouter()
router.register('groups', GroupViewSet, basename='group')
router.register('messages', MessageViewSet, basename='message')
router.register('calls', CallViewSet, basename='call')

urlpatterns = [path('', include(router.urls))]