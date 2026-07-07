from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from .models import Post

User = get_user_model()


class PostDeleteTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@example.com',
            username='alice',
            password='password123'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com',
            username='bob',
            password='password123'
        )
        self.post = Post.objects.create(
            author=self.user1,
            content="Alice's first axiom",
            post_type=Post.TYPE_TEXT
        )
        self.url = reverse('post-detail', kwargs={'pk': self.post.pk})

    def test_delete_post_unauthenticated(self):
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_post_by_non_author(self):
        self.client.force_authenticate(user=self.user2)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Post.objects.filter(pk=self.post.pk).exists())

    def test_delete_post_by_author(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())
