from rest_framework import generics, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
import urllib.request
import urllib.parse
import json
from django.conf import settings
from decouple import config
import secrets

from rest_framework_simplejwt.views import TokenObtainPairView
from .models import CustomUser, Profile, Department
from .serializers import (
    UserSerializer, PublicUserSerializer, RegisterSerializer,
    ProfileSerializer, DepartmentSerializer,
    EmailOrUsernameTokenObtainPairSerializer,
)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer
    throttle_scope = 'auth'


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'


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
    """Public profile lookup by user ID — uses PublicUserSerializer to protect private user emails."""
    serializer_class = PublicUserSerializer
    queryset = CustomUser.objects.select_related('profile__department')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class UserListView(generics.ListAPIView):
    """Member directory lookup — uses PublicUserSerializer to prevent email enumeration."""
    serializer_class = PublicUserSerializer
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


def is_allowed_origin(url):
    """Dynamically validates that a candidate redirect origin matches configured CORS or FRONTEND_URL."""
    if not url:
        return False
    try:
        import re
        parsed = urllib.parse.urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip('/')

        configured = config('FRONTEND_URL', default='').strip().rstrip('/')
        if configured and origin == configured:
            return True

        cors_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
        if origin in cors_origins:
            return True
        cors_regexes = getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', [])
        for pattern in cors_regexes:
            if re.match(pattern, origin):
                return True

        if getattr(settings, 'DEBUG', False):
            if parsed.hostname in ('localhost', '127.0.0.1'):
                return True

        return False
    except Exception:
        return False


def get_frontend_url(request, state_frontend=None):
    """
    Safely resolves the frontend URL without allowing open redirects.
    Candidate URLs from state or query parameters MUST match trusted origins.
    """
    if state_frontend and is_allowed_origin(state_frontend):
        return state_frontend.rstrip('/')

    req_param = request.GET.get('frontend_redirect', '').strip()
    if req_param and is_allowed_origin(req_param):
        return req_param.rstrip('/')
    header_origin = request.headers.get('origin') or request.headers.get('referer')
    if header_origin:
        try:
            parsed = urllib.parse.urlparse(header_origin)
            origin = f"{parsed.scheme}://{parsed.netloc}".rstrip('/')
            if is_allowed_origin(origin):
                return origin
        except Exception:
            pass

    configured = config('FRONTEND_URL', default='').strip().rstrip('/')
    if configured:
        return configured

    cors_origins = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])
    if cors_origins:
        return cors_origins[0].rstrip('/')

    return ''

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_url = get_frontend_url(request)
        client_id = config('GOOGLE_OAUTH_CLIENT_ID', default='').strip()
        client_secret = config('GOOGLE_OAUTH_CLIENT_SECRET', default='').strip()
        
        if not client_id or not client_secret:
            err = urllib.parse.quote("Google OAuth credentials are not configured on the backend. Please add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel environment variables.")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        base_override = config('OAUTH_REDIRECT_BASE_URL', default='').strip()
        if base_override:
            redirect_uri = base_override
        else:
            redirect_uri = request.build_absolute_uri('/api/accounts/oauth/google/callback/')
            if request.is_secure() or request.headers.get('x-forwarded-proto') == 'https':
                redirect_uri = redirect_uri.replace('http://', 'https://')

        state_payload = json.dumps({'frontend_url': frontend_url})
        state_token = urlsafe_base64_encode(force_bytes(state_payload))

        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            'access_type': 'offline',
            'prompt': 'select_account',
            'state': state_token,
        }
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
        return redirect(auth_url)


class GoogleCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Extract frontend URL from state
        raw_state = request.GET.get('state', '')
        state_frontend = ''
        if raw_state:
            try:
                state_data = json.loads(force_str(urlsafe_base64_decode(raw_state)))
                state_frontend = state_data.get('frontend_url', '')
            except Exception:
                pass
        frontend_url = get_frontend_url(request, state_frontend)

        code = request.GET.get('code')
        if not code:
            err = urllib.parse.quote('Google authorization code missing or canceled.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)
            
        client_id = config('GOOGLE_OAUTH_CLIENT_ID', default='').strip()
        client_secret = config('GOOGLE_OAUTH_CLIENT_SECRET', default='').strip()
        base_override = config('OAUTH_REDIRECT_BASE_URL', default='').strip()
        if base_override:
            redirect_uri = base_override
        else:
            redirect_uri = request.build_absolute_uri('/api/accounts/oauth/google/callback/')
            if request.is_secure() or request.headers.get('x-forwarded-proto') == 'https':
                redirect_uri = redirect_uri.replace('http://', 'https://')

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
            err = urllib.parse.quote(f"Google token exchange failed: {e}")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        if not access_token:
            err = urllib.parse.quote('Failed to obtain Google access token.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        # Retrieve profile info from Google
        profile_url = f'https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}'
        try:
            with urllib.request.urlopen(profile_url) as response:
                profile_data = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            err = urllib.parse.quote(f"Failed to fetch Google user profile: {e}")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        email = profile_data.get('email')
        if not email:
            err = urllib.parse.quote('Google account has no associated email address.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

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

        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        refresh_str = str(refresh)

        callback_path = f"/oauth/callback?access={access}&refresh={refresh_str}"
        target = f"{frontend_url}{callback_path}" if frontend_url else callback_path
        return redirect(target)


class MicrosoftLoginView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_url = get_frontend_url(request)
        client_id = config('MICROSOFT_OAUTH_CLIENT_ID', default='').strip()
        client_secret = config('MICROSOFT_OAUTH_CLIENT_SECRET', default='').strip()

        if not client_id or not client_secret:
            err = urllib.parse.quote("Microsoft OAuth credentials are not configured on the backend. Please add MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in Vercel environment variables.")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        base_override = config('MICROSOFT_OAUTH_REDIRECT_BASE_URL', default='').strip()
        if base_override:
            redirect_uri = base_override
        else:
            redirect_uri = request.build_absolute_uri('/api/accounts/oauth/microsoft/callback/')
            if request.is_secure() or request.headers.get('x-forwarded-proto') == 'https':
                redirect_uri = redirect_uri.replace('http://', 'https://')
        
        state_payload = json.dumps({'frontend_url': frontend_url})
        state_token = urlsafe_base64_encode(force_bytes(state_payload))

        params = {
            'client_id': client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'response_mode': 'query',
            'scope': 'https://graph.microsoft.com/User.Read',
            'state': state_token,
        }
        auth_url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' + urllib.parse.urlencode(params)
        return redirect(auth_url)


class MicrosoftCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        raw_state = request.GET.get('state', '')
        state_frontend = ''
        if raw_state:
            try:
                state_data = json.loads(force_str(urlsafe_base64_decode(raw_state)))
                state_frontend = state_data.get('frontend_url', '')
            except Exception:
                pass
        frontend_url = get_frontend_url(request, state_frontend)

        code = request.GET.get('code')
        if not code:
            err = urllib.parse.quote('Microsoft authorization code missing or canceled.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        client_id = config('MICROSOFT_OAUTH_CLIENT_ID', default='').strip()
        client_secret = config('MICROSOFT_OAUTH_CLIENT_SECRET', default='').strip()
        base_override = config('MICROSOFT_OAUTH_REDIRECT_BASE_URL', default='').strip()
        if base_override:
            redirect_uri = base_override
        else:
            redirect_uri = request.build_absolute_uri('/api/accounts/oauth/microsoft/callback/')
            if request.is_secure() or request.headers.get('x-forwarded-proto') == 'https':
                redirect_uri = redirect_uri.replace('http://', 'https://')

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
            err = urllib.parse.quote(f"Microsoft token exchange failed: {e}")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        if not access_token:
            err = urllib.parse.quote('Failed to obtain Microsoft access token.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        # Retrieve profile from Microsoft Graph API
        profile_url = 'https://graph.microsoft.com/v1.0/me'
        try:
            req = urllib.request.Request(profile_url, headers={'Authorization': f'Bearer {access_token}'})
            with urllib.request.urlopen(req) as response:
                profile_data = json.loads(response.read().decode('utf-8'))
        except Exception as e:
            err = urllib.parse.quote(f"Failed to fetch Microsoft profile: {e}")
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        # Microsoft Graph API might return mail or userPrincipalName
        email = profile_data.get('mail') or profile_data.get('userPrincipalName')
        if not email:
            err = urllib.parse.quote('Microsoft account has no associated email.')
            target = f"{frontend_url}/login?error={err}" if frontend_url else f"/login?error={err}"
            return redirect(target)

        first_name = profile_data.get('givenName', '')
        last_name = profile_data.get('surname', '')
        if not first_name and not last_name:
            display_name = profile_data.get('displayName', '')
            if display_name:
                parts = display_name.split(' ', 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ''

        # create CustomUser
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

        # Generate SimpleJWT tokens
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        refresh_str = str(refresh)

        callback_path = f"/oauth/callback?access={access}&refresh={refresh_str}"
        target = f"{frontend_url}{callback_path}" if frontend_url else callback_path
        return redirect(target)


# Password Reset Views
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = CustomUser.objects.filter(email=email).first()
        if user:
            # Generate token and uid
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
                      # Construct reset link pointing to the user's frontend client
            frontend_url = get_frontend_url(request)
            if frontend_url:
                reset_url = f"{frontend_url}/login?reset=true&uid={uid}&token={token}"
            else:
                reset_url = request.build_absolute_uri(f'/login/?reset=true&uid={uid}&token={token}')
            
            # Send email
            subject = "Mathify Password Reset Request"
            message = (
                f"Hello {user.username},\n\n"
                f"We received a request to reset your password for your Mathify account.\n"
                f"Please click the link below to set a new password:\n\n"
                f"{reset_url}\n\n"
                f"If you did not request this, please ignore this email.\n"
            )
            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=False,
                )
            except Exception as e:
                print(f"FAILED TO SEND EMAIL: {e}. FALLBACK MESSAGE:\n", message)
                
        # Return success to prevent email enumeration
        return Response({'message': 'If an account exists with this email, a reset link has been sent.'}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')
        
        if not uidb64 or not token or not new_password:
            return Response({'error': 'UID, token, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            return Response({'error': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Reset token is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce academic-grade password complexity via Django's configured validators
        try:
            validate_password(new_password, user=user)
        except ValidationError as e:
            return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
            
        # Set new password
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)