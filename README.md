# Mathify Backend — Setup Guide

## 1. Drop these files into your project

Place the contents of this zip inside your existing `backend/` folder so the
structure looks like:

```
backend/
├── mathify/          ← updated settings.py, urls.py
├── accounts/
├── feed/
├── social/
├── library/
├── studio/
├── rankings/
├── ai_tutor/
├── requirements.txt
├── .env.example
└── manage.py         ← already exists, leave it
```

---

## 2. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

## 3. Create your .env file

```bash
cp .env.example .env
# then edit .env and set a real SECRET_KEY
```

---

## 4. Run migrations

```bash
python manage.py makemigrations accounts feed social library studio rankings ai_tutor
python manage.py migrate
```

---

## 5. Create a superuser

```bash
python manage.py createsuperuser
```

---

## 6. Start the dev server

```bash
python manage.py runserver
```

---

## API endpoints at a glance

| App        | Base URL                  | Key routes                                      |
|------------|---------------------------|-------------------------------------------------|
| auth       | `/api/auth/`              | `token/`, `token/refresh/`                      |
| accounts   | `/api/accounts/`          | `register/`, `me/`, `me/profile/`, `users/<id>/`|
| feed       | `/api/feed/`              | `posts/`, `posts/<id>/like/`, `follows/`        |
| social     | `/api/social/`            | `groups/`, `groups/<id>/join/`, `messages/`     |
| library    | `/api/library/`           | `resources/`, `resources/<id>/bookmark/`        |
| studio     | `/api/studio/`            | `formulas/`, `creations/`                       |
| rankings   | `/api/rankings/`          | `leaderboard/?period=weekly`, `competitions/`   |
| ai_tutor   | `/api/ai-tutor/`          | `tutors/`, `sessions/`, `sessions/<id>/send/`   |
| notify     | `/api/`                   | `notifications/`, `notifications/<id>/read/`   |

---

## Wiring up the AI (ai_tutor app)

Open `ai_tutor/views.py` and replace the `_get_ai_reply()` stub with your SDK
call. Examples for both Anthropic and OpenAI are included as comments in that
method.

---

## Switching to Postgres (recommended for production)

```python
# mathify/settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mathify',
        'USER': 'postgres',
        'PASSWORD': 'yourpassword',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

Add `psycopg2-binary` to `requirements.txt`.

---

## Feed API usage (real-time via real users)

Create a text post:

```bash
curl -X POST http://127.0.0.1:8000/api/feed/posts/ \
    -H "Authorization: Bearer <ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"content":"Hello Math Axiom!","post_type":"text"}'
```

Create a formula post:

```bash
curl -X POST http://127.0.0.1:8000/api/feed/posts/ \
    -H "Authorization: Bearer <ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"post_type":"formula","latex_content":"E=mc^2","content":"Energy mass equivalence"}'
```

Create an image post (multipart):

```bash
curl -X POST http://127.0.0.1:8000/api/feed/posts/ \
    -H "Authorization: Bearer <ACCESS_TOKEN>" \
    -F "post_type=image" \
    -F "content=Proof sketch" \
    -F "media=@/path/to/image.jpg"
```

Like a post:

```bash
curl -X POST http://127.0.0.1:8000/api/feed/posts/<id>/like/ \
    -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Add a comment:

```bash
curl -X POST http://127.0.0.1:8000/api/feed/posts/<id>/comments/ \
    -H "Authorization: Bearer <ACCESS_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"content":"Nice proof."}'
```

Filter posts:

```bash
curl "http://127.0.0.1:8000/api/feed/posts/?q=calculus&post_type=text"
```

## Feed validation rules

- Post must include at least one of: `content`, `latex_content`, or `media`.
- `post_type=image` accepts png/jpg/gif/webp.
- `post_type=video` accepts mp4/webm/ogg.
- Media is limited to 10 MB.
- Formula posts require `latex_content`.
