from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FormulaViewSet, CreationViewSet

router = DefaultRouter()
router.register('formulas', FormulaViewSet, basename='formula')
router.register('creations', CreationViewSet, basename='creation')

urlpatterns = [path('', include(router.urls))]