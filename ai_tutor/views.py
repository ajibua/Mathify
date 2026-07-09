from django.http import StreamingHttpResponse
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import TutorProfile, ChatSession, SessionMessage
from .serializers import (
    TutorProfileSerializer,
    ChatSessionSerializer,
    ChatSessionListSerializer,
    SessionMessageSerializer,
    SendMessageSerializer,
)


class TutorProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """Directory of available AI tutors."""
    serializer_class = TutorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = TutorProfile.objects.filter(is_active=True)
        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject=subject)
        return qs


class ChatSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ChatSessionListSerializer
        return ChatSessionSerializer

    def get_queryset(self):
        return (
            ChatSession.objects
            .filter(user=self.request.user)
            .select_related('tutor')
            .prefetch_related('messages')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='send')
    def send_message(self, request, pk=None):
        """
        POST /api/ai-tutor/sessions/<id>/send/
        Body: { "content": "..." }

        Saves the user message, calls the AI, saves and returns the assistant reply.
        """
        session = self.get_object()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_content = serializer.validated_data['content']
        file_data = serializer.validated_data.get('file_data')
        file_name = serializer.validated_data.get('file_name')
        file_mime = serializer.validated_data.get('file_mime')

        # Save the user turn
        SessionMessage.objects.create(
            session=session,
            role=SessionMessage.ROLE_USER,
            content=user_content,
            file_data=file_data,
            file_name=file_name,
            file_mime=file_mime
        )

        # Build message history for the AI call
        history = [
            {
                'role': m.role,
                'content': m.content,
                'file_data': m.file_data,
                'file_mime': m.file_mime,
                'file_name': m.file_name,
            }
            for m in SessionMessage.objects.filter(session=session)
        ]
        
        ai_content = self._get_ai_reply(session, history)
        assistant_msg = SessionMessage.objects.create(
            session=session, role=SessionMessage.ROLE_ASSISTANT, content=ai_content
        )

        session.save(update_fields=['updated_at'])

        return Response(
            SessionMessageSerializer(assistant_msg).data,
            status=status.HTTP_201_CREATED,
        )

    # AI integration 
    @action(detail=True, methods=['post'], url_path='send-stream')
    def send_stream(self, request, pk=None):
        """
        POST /api/ai-tutor/sessions/<id>/send-stream/
        Body: { "content": "..." }

        Returns a StreamingHttpResponse yielding Server-Sent Events (SSE).
        """
        session = self.get_object()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_content = serializer.validated_data['content']
        file_data = serializer.validated_data.get('file_data')
        file_name = serializer.validated_data.get('file_name')
        file_mime = serializer.validated_data.get('file_mime')

        SessionMessage.objects.create(
            session=session,
            role=SessionMessage.ROLE_USER,
            content=user_content,
            file_data=file_data,
            file_name=file_name,
            file_mime=file_mime
        )

        history = [
            {
                'role': m.role,
                'content': m.content,
                'file_data': m.file_data,
                'file_mime': m.file_mime,
                'file_name': m.file_name,
            }
            for m in SessionMessage.objects.filter(session=session)
        ]

        # Return streaming response
        response = StreamingHttpResponse(
            self._stream_ai_reply(session, history),
            content_type='text/event-stream'
        )
        response['X-Accel-Buffering'] = 'no'  
        return response

    def _stream_ai_reply(self, session: ChatSession, history: list):
        import os
        import urllib.request
        import json
        import time
        from decouple import config

        # 1. call system prompt
        system_prompt = (session.tutor.model_config.get('system_prompt', '')
                         if session.tutor else 'You are a helpful math tutor.')
        system_prompt = f"{system_prompt}\n\n{self._get_app_context_prompt(session.user)}"
        
        # 2. call api keys from  .env
        gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        try:
            if not gemini_key:
                gemini_key = config('GEMINI_API_KEY', default=None) or config('GOOGLE_API_KEY', default=None)
        except Exception:
            pass
        if gemini_key:
            gemini_key = gemini_key.strip()



        full_text = ""

        # 3. Stream from Gemini REST
        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key={gemini_key}"
                contents = []
                for m in history:
                    role = 'model' if m['role'] == 'assistant' else 'user'
                    parts = []
                    if m.get('file_data') and m.get('file_mime'):
                        parts.append({
                            "inlineData": {
                                "mimeType": m['file_mime'],
                                "data": m['file_data']
                            }
                        })
                    parts.append({"text": m['content']})
                    contents.append({
                        "role": role,
                        "parts": parts
                    })
                
                payload = {
                    "contents": contents,
                    "systemInstruction": {
                        "parts": [{"text": system_prompt}]
                    }
                }
                
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                
                with urllib.request.urlopen(req, timeout=15) as response:
                    for line in response:
                        if line.startswith(b'data: '):
                            data_str = line[6:].decode('utf-8').strip()
                            try:
                                chunk_data = json.loads(data_str)
                                text_chunk = chunk_data['candidates'][0]['content']['parts'][0].get('text', '')
                                if text_chunk:
                                    full_text += text_chunk
                                    yield f"data: {json.dumps({'text': text_chunk})}\n\n"
                            except Exception:
                                pass

                if full_text:
                    SessionMessage.objects.create(
                        session=session, role=SessionMessage.ROLE_ASSISTANT, content=full_text
                    )
                    session.save(update_fields=['updated_at'])
                return
            except Exception as e:
                err_msg = f"[AI Tutor Connection Error (Gemini Stream)]: {str(e)}"
                yield f"data: {json.dumps({'text': err_msg})}\n\n"
                SessionMessage.objects.create(
                    session=session, role=SessionMessage.ROLE_ASSISTANT, content=err_msg
                )
                return



        # 5. Offline Fallback Mock Response Streaming (Uses SymPy calculations if requested)
        mock_reply = self._get_offline_mock_reply(session, history)
        words = mock_reply.split(' ')
        for i, word in enumerate(words):
            chunk = word + (' ' if i < len(words) - 1 else '')
            full_text += chunk
            yield f"data: {json.dumps({'text': chunk})}\n\n"
            time.sleep(0.02)  # Fast simulated typing

        SessionMessage.objects.create(
            session=session, role=SessionMessage.ROLE_ASSISTANT, content=full_text
        )
        session.save(update_fields=['updated_at'])

    def _get_ai_reply(self, session: ChatSession, history: list) -> str:
        # Standard blocking request (retained as compatibility fallback)
        import os
        import urllib.request
        import json
        from decouple import config

        system_prompt = (session.tutor.model_config.get('system_prompt', '')
                         if session.tutor else 'You are a helpful math tutor.')
        system_prompt = f"{system_prompt}\n\n{self._get_app_context_prompt(session.user)}"
        
        gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        try:
            if not gemini_key:
                gemini_key = config('GEMINI_API_KEY', default=None) or config('GOOGLE_API_KEY', default=None)
        except Exception:
            pass
        if gemini_key:
            gemini_key = gemini_key.strip()



        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
                contents = []
                for m in history:
                    role = 'model' if m['role'] == 'assistant' else 'user'
                    parts = []
                    if m.get('file_data') and m.get('file_mime'):
                        parts.append({
                            "inlineData": {
                                "mimeType": m['file_mime'],
                                "data": m['file_data']
                            }
                        })
                    parts.append({"text": m['content']})
                    contents.append({
                        "role": role,
                        "parts": parts
                    })
                payload = {"contents": contents, "systemInstruction": {"parts": [{"text": system_prompt}]}}
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_data = json.loads(response.read().decode('utf-8'))
                    return res_data['candidates'][0]['content']['parts'][0]['text']
            except Exception as e:
                return f"[AI Tutor Connection Error (Gemini)]: {str(e)}"



        return self._get_offline_mock_reply(session, history)

    def _get_offline_mock_reply(self, session: ChatSession, history: list) -> str:
        last_msg = history[-1]['content'].lower() if history else ""
        tutor_name = session.tutor.name if session.tutor else "Math Tutor"
        
        fallback_msg = (
            f"### [Offline Mode] {tutor_name} Response\n\n"
            f"Configure `GEMINI_API_KEY` in your `.env` file to enable live AI conversations. "
            f"Here is a simulated response:\n\n"
        )

        if any(w in last_msg for w in ["leaderboard", "rank", "standing", "competition", "battle", "participate", "points", "proof"]):
            context_prompt = self._get_app_context_prompt(session.user)
            return fallback_msg + (
                "Here is the current status of the leaderboard and active competitions:\n\n"
                f"{context_prompt}\n\n"
                "Let me know if you need help on how to join a competition or write a proof!"
            )
        
        if "derivative" in last_msg or "differentiate" in last_msg:
            try:
                from .math_solver import solve_derivative
                import re
                expr = "x**2"
                match = re.search(r"(?:derivative of|differentiate)\s+([a-zA-Z0-9\s\*\+\-\^\(\)\/]+)", last_msg)
                if match:
                    expr = match.group(1).strip()
                res = solve_derivative(expr)
                if res['success']:
                    return fallback_msg + (
                        f"I've calculated the symbolic derivative using **SymPy**:\n\n"
                        f"Expression: ${expr}$\n\n"
                        f"Derivative: $${res['result_latex']}$$\n\n"
                        f"Calculation verified: $\\frac{{d}}{{dx}}[{expr}] = {res['result_str']}$."
                    )
            except Exception as e:
                print("DEBUG FALLBACK ERROR DERIVATIVE:", e)
            
            return fallback_msg + (
                "To differentiate an expression, use standard calculus rules:\n"
                "- **Power Rule**: $\\frac{d}{dx}[x^n] = n x^{n-1}$\n"
                "- **Chain Rule**: $\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)$\n"
                "- **Leibniz Rule**: $\\frac{d}{dx}\\left[\\int_{a}^{h(x)} f(t)dt\\right] = f(h(x))\\cdot h'(x)$"
            )
        elif "integral" in last_msg or "integrate" in last_msg:
            try:
                from .math_solver import solve_integral
                import re
                expr = "x**2"
                match = re.search(r"(?:integral of|integrate)\s+([a-zA-Z0-9\s\*\+\-\^\(\)\/]+)", last_msg)
                if match:
                    expr = match.group(1).strip()
                res = solve_integral(expr)
                if res['success']:
                    return fallback_msg + (
                        f"I've calculated the symbolic integral using **SymPy**:\n\n"
                        f"Expression: ${expr}$\n\n"
                        f"Integral: $${res['result_latex']} + C$$\n\n"
                        f"Calculated antiderivative: ${res['result_str']}$."
                    )
            except Exception as e:
                print("DEBUG FALLBACK ERROR INTEGRAL:", e)

            return fallback_msg + (
                "For integration, some fundamental methods are:\n"
                "- **Substitution**: Let $u = g(x)$, then $du = g'(x)dx$.\n"
                "- **Parts**: $\\int u \\, dv = uv - \\int v \\, du$ (based on the product rule).\n"
                "- **Trig Integrals**: Remember $\\int \\sin(x)dx = -\\cos(x) + C$."
            )
        elif "matrix" in last_msg or "eigenvalue" in last_msg:
            return fallback_msg + (
                "In Linear Algebra:\n"
                "- **Eigenvalue Equation**: $A\\mathbf{v} = \\lambda\\mathbf{v}$\n"
                "- **Characteristic Equation**: $\\det(A - \\lambda I) = 0$\n"
                "Solve the characteristic equation to find the eigenvalues $\\lambda$, then solve the homogeneous system $(A - \\lambda I)\\mathbf{v} = \\mathbf{0}$ to obtain the eigenvectors."
            )
        else:
            return fallback_msg + (
                f"Hello! I am {tutor_name}. I can help you with topics like calculus, algebra, topology, and number theory. "
                f"What mathematical concepts or proof sketches would you like to explore today?"
            )

    def _get_app_context_prompt(self, user):
        from django.utils import timezone
        from rankings.models import Score, Competition

        # Active Competitions
        active_comps = Competition.objects.filter(is_active=True, end_date__gt=timezone.now())
        comps_list = []
        for c in active_comps:
            comps_list.append(f"- Competition: '{c.name}' (ID: {c.id}). Description: {c.description}. Active until {c.end_date.strftime('%Y-%m-%d %H:%M')}.")
        comps_str = "\n".join(comps_list) if comps_list else "There are currently no active competitions."

        # Global Standings
        top_scores = Score.objects.filter(period=Score.PERIOD_ALL_TIME, competition__isnull=True).select_related('user').order_by('-points')[:5]
        leaderboard_list = []
        for i, s in enumerate(top_scores, 1):
            leaderboard_list.append(f"Rank {i}: {s.user.username} with {s.points} points.")
        leaderboard_str = "\n".join(leaderboard_list) if leaderboard_list else "No scores recorded on the leaderboard yet."

        # User's status
        user_points = 0
        user_rank = "Unranked"
        try:
            profile = user.profile
            user_points = profile.axiom_points
            user_score = Score.objects.filter(user=user, period=Score.PERIOD_ALL_TIME, competition__isnull=True).first()
            if user_score:
                user_rank = Score.objects.filter(period=Score.PERIOD_ALL_TIME, competition__isnull=True, points__gt=user_score.points).count() + 1
        except Exception:
            pass

        return f"""
[MATHIFY EVENT & STANDING STATUS]
- Active Competitions:
{comps_str}
- Global Leaderboard (Top 5):
{leaderboard_str}
- Current User Status:
  * Username: @{user.username}
  * Points: {user_points}
  * Rank: {user_rank}

- Rules/Participation Info:
  * Publish a proof by going to the Math Studio, creating a creation, choosing 'Public' visibility, and saving it (+50 pts).
  * Participate in live competitions by visiting the 'Competitions' page, viewing active events, and solving/submitting solutions (+10 pts per submit).
  * Direct the user if they get lost!
"""