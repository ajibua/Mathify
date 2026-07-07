from rest_framework import serializers
from .models import Formula, Creation


class FormulaSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Formula
        fields = ['id', 'name', 'latex_expression', 'description', 'category', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']


class CreationSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    formulas = FormulaSerializer(many=True, read_only=True)
    formula_ids = serializers.PrimaryKeyRelatedField(
        queryset=Formula.objects.all(), source='formulas',
        many=True, write_only=True, required=False
    )

    class Meta:
        model = Creation
        fields = [
            'id', 'title', 'author', 'content', 'latex_content',
            'formulas', 'formula_ids', 'visibility', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']