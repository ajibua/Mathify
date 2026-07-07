from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} — {self.name}"

    class Meta:
        ordering = ['name']


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class Profile(models.Model):
    YEAR_CHOICES = [
        (1, 'Year 1'), (2, 'Year 2'), (3, 'Year 3'),
        (4, 'Year 4'), (5, 'Postgraduate'),
    ]

    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name='profile'
    )
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='students'
    )
    year_of_study = models.PositiveSmallIntegerField(
        choices=YEAR_CHOICES, null=True, blank=True
    )
    axiom_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user.email})"