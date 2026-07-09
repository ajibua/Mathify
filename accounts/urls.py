from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, MeView, ProfileView, UserDetailView, UserListView, DepartmentViewSet,
    GoogleLoginView, GoogleCallbackView, MicrosoftLoginView, MicrosoftCallbackView
)

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('me/profile/', ProfileView.as_view(), name='my-profile'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    
    # OAuth Endpoints
    path('oauth/google/login/', GoogleLoginView.as_view(), name='google-login'),
    path('oauth/google/callback/', GoogleCallbackView.as_view(), name='google-callback'),
    path('oauth/microsoft/login/', MicrosoftLoginView.as_view(), name='microsoft-login'),
    path('oauth/microsoft/callback/', MicrosoftCallbackView.as_view(), name='microsoft-callback'),

    path('', include(router.urls)),
]