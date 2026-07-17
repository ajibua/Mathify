from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser, Profile, Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description']


class ProfileSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department',
        write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Profile
        fields = [
            'id', 'avatar', 'bio', 'department', 'department_id',
            'year_of_study', 'axiom_points', 'updated_at',
        ]
        read_only_fields = ['axiom_points']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else data
        if 'year_of_study' in data and data['year_of_study'] == '':
            data['year_of_study'] = None
        if 'department_id' in data and data['department_id'] == '':
            data['department_id'] = None
        return super().to_internal_value(data)


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = CustomUser
        fields = ['email', 'username', 'first_name', 'last_name', 'password', 'password2', 'department_id']

    def validate(self, data):
        if data['password'] != data.pop('password2'):
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        department = validated_data.pop('department_id', None)
        user = CustomUser.objects.create_user(**validated_data)
        if department:
            profile = user.profile
            profile.department = department
            profile.save()
        return user