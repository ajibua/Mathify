import os
from pathlib import Path
from datetime import timedelta
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = 'VERCEL' in os.environ or config('VERCEL', default=False, cast=bool)

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')

DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='*').split(',') if h.strip()]
if 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'storages',

    # local
    'accounts',
    'feed',
    'social',
    'library',
    'studio',
    'rankings',
    'ai_tutor',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'mathify.security.SecurityHeadersMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mathify.urls'
APPEND_SLASH = True

FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'
FRONTEND_BACKEND_ORIGIN = config('FRONTEND_BACKEND_ORIGIN', default='').strip().rstrip('/')

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIST] if FRONTEND_DIST.exists() else [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mathify.wsgi.application'

DATABASE_URL = config('DATABASE_URL', default=None)
USE_POSTGRES = config('USE_POSTGRES', default=bool(DATABASE_URL), cast=bool)

def parse_database_url(url, conn_max_age=600, ssl_require=True):
    try:
        import dj_database_url
        return dj_database_url.parse(url, conn_max_age=conn_max_age, ssl_require=ssl_require)
    except ImportError:
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        engine_map = {
            'postgres': 'django.db.backends.postgresql',
            'postgresql': 'django.db.backends.postgresql',
            'sqlite': 'django.db.backends.sqlite3',
            'mysql': 'django.db.backends.mysql',
        }
        engine = engine_map.get(parsed.scheme, 'django.db.backends.postgresql')
        db_config = {
            'ENGINE': engine,
            'NAME': urllib.parse.unquote(parsed.path.lstrip('/')),
            'USER': urllib.parse.unquote(parsed.username or ''),
            'PASSWORD': urllib.parse.unquote(parsed.password or ''),
            'HOST': parsed.hostname or '',
            'PORT': parsed.port or '',
            'CONN_MAX_AGE': conn_max_age,
        }
        if ssl_require and 'postgresql' in engine:
            db_config['OPTIONS'] = {'sslmode': 'require'}
        return db_config

if DATABASE_URL:
    try:
        DATABASES = {
            'default': parse_database_url(
                DATABASE_URL,
                conn_max_age=config('DB_CONN_MAX_AGE', default=(0 if IS_VERCEL else 600), cast=int),
                ssl_require=config('DB_SSL_REQUIRE', default=True, cast=bool)
            )
        }
    except Exception as e:
        print(f"[Warning] Failed to parse DATABASE_URL ({e}), falling back to SQLite.")
        sqlite_file = config('SQLITE_DB_NAME', default='db.sqlite3')
        sqlite_path = Path('/tmp') / sqlite_file if IS_VERCEL else BASE_DIR / sqlite_file
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': sqlite_path,
            }
        }
else:
    if IS_VERCEL:
        print("[CRITICAL PRODUCTION WARNING] Running on Vercel without DATABASE_URL! Ephemeral SQLite in /tmp will cause user session disconnects across serverless lambda containers. Please supply your Supabase DATABASE_URL in Vercel Environment Variables.")
    sqlite_file = config('SQLITE_DB_NAME', default='db.sqlite3')
    sqlite_path = Path('/tmp') / sqlite_file if IS_VERCEL else BASE_DIR / sqlite_file
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': sqlite_path,
        }
    }

REDIS_URL = config('REDIS_URL', default=None)
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'mathify-locmem-cache',
        }
    }

AUTH_USER_MODEL = 'accounts.CustomUser'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    d for d in [BASE_DIR / 'static', FRONTEND_DIST / 'assets'] if d.exists()
]

USE_SUPABASE_STORAGE = config(
    'USE_SUPABASE_STORAGE',
    default=bool(config('SUPABASE_STORAGE_ACCESS_KEY', default='').strip() or config('SUPABASE_STORAGE_ENDPOINT', default='').strip()),
    cast=bool
)

if USE_SUPABASE_STORAGE:
    AWS_ACCESS_KEY_ID = config('SUPABASE_STORAGE_ACCESS_KEY', default='').strip()
    AWS_SECRET_ACCESS_KEY = config('SUPABASE_STORAGE_SECRET_KEY', default='').strip()
    AWS_STORAGE_BUCKET_NAME = config('SUPABASE_STORAGE_BUCKET_NAME', default='mathify-media').strip()
    AWS_S3_ENDPOINT_URL = config('SUPABASE_STORAGE_ENDPOINT', default='').strip()
    AWS_S3_REGION_NAME = config('SUPABASE_STORAGE_REGION', default='eu-west-1').strip()
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False

    endpoint_clean = AWS_S3_ENDPOINT_URL.rstrip('/')
    if 'supabase.co/storage/v1/s3' in endpoint_clean:
        base_supabase = endpoint_clean.replace('/storage/v1/s3', '')
        AWS_S3_CUSTOM_DOMAIN = f"{base_supabase.replace('https://', '')}/storage/v1/object/public/{AWS_STORAGE_BUCKET_NAME}"
        MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
    else:
        custom_domain = config('AWS_S3_CUSTOM_DOMAIN', default=None)
        if custom_domain:
            AWS_S3_CUSTOM_DOMAIN = custom_domain
            MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/"
        else:
            MEDIA_URL = f"{endpoint_clean}/{AWS_STORAGE_BUCKET_NAME}/"

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_ROOT = ''
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }
    MEDIA_URL = '/media/'
    MEDIA_ROOT = (Path('/tmp') / 'media') if IS_VERCEL else (BASE_DIR / 'media')
    if not IS_VERCEL:
        try:
            MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

# Request body and upload sizes (prevent 400 RequestDataTooBig on valid media/video attachments)
DATA_UPLOAD_MAX_MEMORY_SIZE = config('DATA_UPLOAD_MAX_MEMORY_SIZE', default=50 * 1024 * 1024, cast=int)  # 50 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = config('FILE_UPLOAD_MAX_MEMORY_SIZE', default=50 * 1024 * 1024, cast=int)  # 50 MB

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': config('REST_PAGE_SIZE', default=20, cast=int),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON_RATE', default='200/day'),
        'user': config('THROTTLE_USER_RATE', default='2000/day'),
        'auth': config('THROTTLE_AUTH_RATE', default='15/minute'),
        'password_reset': config('THROTTLE_PW_RESET_RATE', default='5/hour'),
        'ai_tutor': config('THROTTLE_AI_TUTOR_RATE', default='30/minute'),
        'feed_post': config('THROTTLE_FEED_RATE', default='25/minute'),
        'score_award': config('THROTTLE_SCORE_RATE', default='15/hour'),
        'competition_answer': config('THROTTLE_COMPETITION_ANSWER_RATE', default='30/minute'),
    }
}

# JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=config('JWT_ACCESS_DAYS', default=1, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_DAYS', default=30, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
}

# CORS 
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=DEBUG, cast=bool)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in config('CORS_ALLOWED_ORIGINS', default='http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174').split(',') if origin.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
]

# Email & SMTP Configuration
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@mathify.local')

# AI Tutor (Gemini API)
GEMINI_API_KEY = config('GEMINI_API_KEY', default='').strip()
GEMINI_DEFAULT_MODEL = config('GEMINI_DEFAULT_MODEL', default='gemini-2.5-flash').strip()
AI_TIMEOUT_SECONDS = config('AI_TIMEOUT_SECONDS', default=20, cast=int)

