from rest_framework import generics, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import CustomUser, Profile, Department
from .serializers import (
    UserSerializer, RegisterSerializer,
    ProfileSerializer, DepartmentSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(Profile, user=self.request.user)


class UserDetailView(generics.RetrieveAPIView):
    """Public profile lookup by user ID."""
    serializer_class = UserSerializer
    queryset = CustomUser.objects.select_related('profile__department')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = CustomUser.objects.select_related('profile__department').exclude(id=self.request.user.id)
        q = self.request.query_params.get('q')
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )
        return qs


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


# ── OAuth 2.0 Identity Provider Views ───────────────────────
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
import urllib.request
import urllib.parse
import json
from decouple import config
import secrets

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        client_id = config('GOOGLE_OAUTH_CLIENT_ID', default='')
        redirect_uri = request.build_absolute_uri('/api/accounts/oauth/google/callback/')
        
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            'access_type': 'offline',
            'prompt': 'select_account',
        }
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
        return redirect(auth_url)


class GoogleCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get('code')
        if not code:
            return redirect('/login/?error=no_code')
            
        client_id = config('GOOGLE_OAUTH_CLIENT_ID', default='')
        client_secret = config('GOOGLE_OAUTH_CLIENT_SECRET', default='')
        redirect_uri = request.build_absolute_uri('/api/accounts/oauth/google/callback/')

        # Exchange auth code for access token
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = urllib.parse.urlencode({
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }).encode('utf-8')

        try:
            req = urllib.request.Request(token_url, data=token_data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                access_token = res_data.get('access_token')
        except Exception as e:
            return redirect(f'/login/?error=token_exchange_failed&msg={urllib.parse.quote(str(e))}')

        if not access_token:
            return redirect('/login/?error=no_access_token')

        # Retrieve profile info from Google
        profile_url = f'https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}'
        try:
            with urllib.request.urlopen(profile_url) as response:
                profile_data = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            return redirect(f'/login/?error=profile_fetch_failed&msg={urllib.parse.quote(str(e))}')

        email = profile_data.get('email')
        if not email:
            return redirect('/login/?error=no_email')

        first_name = profile_data.get('given_name', '')
        last_name = profile_data.get('family_name', '')

        # Get or create CustomUser
        user = CustomUser.objects.filter(email=email).first()
        if not user:
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"{username_base}{counter}"
                counter += 1
            user = CustomUser.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                password=secrets.token_urlsafe(32)
            )
            Profile.objects.create(user=user)

        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        return redirect(f'/login/?access={refresh.access_token}&refresh={refresh}')


class MicrosoftLoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        client_id = config('MICROSOFT_OAUTH_CLIENT_ID', default='')
        redirect_uri = request.build_absolute_uri('/api/accounts/oauth/microsoft/callback/')
        if '127.0.0.1' in redirect_uri:
            redirect_uri = redirect_uri.replace('127.0.0.1', 'localhost')
        
        params = {
            'client_id': client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'response_mode': 'query',
            'scope': 'https://graph.microsoft.com/User.Read',
        }
        auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + urllib.parse.urlencode(params)
        return redirect(auth_url)


class MicrosoftCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get('code')
        if not code:
            return redirect('/login/?error=no_code')

        client_id = config('MICROSOFT_OAUTH_CLIENT_ID', default='')
        client_secret = config('MICROSOFT_OAUTH_CLIENT_SECRET', default='')
        redirect_uri = request.build_absolute_uri('/api/accounts/oauth/microsoft/callback/')
        if '127.0.0.1' in redirect_uri:
            redirect_uri = redirect_uri.replace('127.0.0.1', 'localhost')

        # Exchange auth code for access token
        token_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
        token_data = urllib.parse.urlencode({
            'client_id': client_id,
            'scope': 'https://graph.microsoft.com/User.Read',
            'code': code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
            'client_secret': client_secret,
        }).encode('utf-8')

        try:
            req = urllib.request.Request(token_url, data=token_data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                access_token = res_data.get('access_token')
        except Exception as e:
            return redirect(f'/login/?error=token_exchange_failed&msg={urllib.parse.quote(str(e))}')

        if not access_token:
            return redirect('/login/?error=no_access_token')

        # Retrieve profile from Microsoft Graph API
        profile_url = 'https://graph.microsoft.com/v1.0/me'
        try:
            req = urllib.request.Request(profile_url, headers={'Authorization': f'Bearer {access_token}'})
            with urllib.request.urlopen(req) as response:
                profile_data = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            return redirect(f'/login/?error=profile_fetch_failed&msg={urllib.parse.quote(str(e))}')

        # Microsoft Graph API might return mail or userPrincipalName
        email = profile_data.get('mail') or profile_data.get('userPrincipalName')
        if not email:
            return redirect('/login/?error=no_email')

        first_name = profile_data.get('givenName', '')
        last_name = profile_data.get('surname', '')
        if not first_name and not last_name:
            display_name = profile_data.get('displayName', '')
            if display_name:
                parts = display_name.split(' ', 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ''

        # Get or create CustomUser
        user = CustomUser.objects.filter(email=email).first()
        if not user:
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            while CustomUser.objects.filter(username=username).exists():
                username = f"{username_base}{counter}"
                counter += 1
            user = CustomUser.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                password=secrets.token_urlsafe(32)
            )
            Profile.objects.create(user=user)

        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        return redirect(f'/login/?access={refresh.access_token}&refresh={refresh}')