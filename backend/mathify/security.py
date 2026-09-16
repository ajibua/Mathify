from django.conf import settings


PRIVATE_CACHE_CONTROL = 'private, no-cache, no-store, must-revalidate'


class SecurityHeadersMiddleware:
    """Apply security headers and prevent caching of private API responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        is_private = (
            request.method != 'GET'
            or request.path.startswith(('/api/auth/', '/api/token/', '/admin/'))
            or request.path.startswith('/api/accounts/me')
            or request.headers.get('Authorization')
            or getattr(request.user, 'is_authenticated', False)
            or response.get('Content-Type', '').startswith('text/event-stream')
        )
        if is_private:
            response['Cache-Control'] = PRIVATE_CACHE_CONTROL
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'

        backend_origin = getattr(settings, 'FRONTEND_BACKEND_ORIGIN', '').strip()
        connect_sources = "'self' https://mathify-backend-one.vercel.app"
        if backend_origin:
            connect_sources += f' {backend_origin}'
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "base-uri 'self'; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            f"connect-src {connect_sources};"
        )
        response['X-Frame-Options'] = 'DENY'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

        return response