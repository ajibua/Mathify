from django.shortcuts import render

def landing(request):
    return render(request, 'landing/code.html')

def login(request):
    return render(request, 'login/code.html')

def register(request):
    return render(request, 'register/code.html')

def feed(request):
    return render(request, 'feed/code.html')

def profile(request):
    return render(request, 'profile/code.html')

def profile_edit(request):
    from django.shortcuts import redirect
    return redirect('/profile/?edit=true')

def groups(request):
    return render(request, 'groups_chats/code.html')

def groups_calls(request):
    return render(request, 'groups_chats/code.html')

def leaderboard(request):
    return render(request, 'leaderboard/code.html')

def competitions(request):
    return render(request, 'competitions/code.html')

def library(request):
    return render(request, 'library/code.html')

def studio(request):
    return render(request, 'studio/code.html')

def ai_chat(request):
    return render(request, 'ai_chat/code.html')