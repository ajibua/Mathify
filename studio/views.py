from rest_framework import viewsets, permissions
from .models import Formula, Creation
from .serializers import FormulaSerializer, CreationSerializer


class FormulaViewSet(viewsets.ModelViewSet):
    serializer_class = FormulaSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Formula.objects.select_related('created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CreationViewSet(viewsets.ModelViewSet):
    serializer_class = CreationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Creation.objects.filter(
            author=user
        ) | Creation.objects.filter(visibility=Creation.VISIBILITY_PUBLIC)
        
        query = self.request.query_params.get('q')
        if query:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=query) | Q(content__icontains=query))
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        serializer.save()