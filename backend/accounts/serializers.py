from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser, Profile, Department
from mathify.media_fields import HybridImageField


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepts either 'username', 'email', or both in the request payload,
    allowing users to sign in seamlessly via their username or email address.
    """
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        login_identifier = (
            attrs.get('username') or
            attrs.get('email') or
            attrs.get(self.username_field) or
            ''
        ).strip()
        password = attrs.get('password', '')

        if not login_identifier:
            raise serializers.ValidationError({
                'detail': 'Please enter your username or email address.'
            })

        if not password:
            raise serializers.ValidationError({
                'detail': 'Please enter your password.'
            })

        request = self.context.get('request')
        user = authenticate(request=request, username=login_identifier, password=password)

        if not user:
            raise serializers.ValidationError({
                'detail': 'No active account found with the given credentials.'
            })

        if not user.is_active:
            raise serializers.ValidationError({
                'detail': 'This account has been deactivated.'
            })

        self.user = user
        refresh = self.get_token(user)

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description']


class ProfileSerializer(serializers.ModelSerializer):
    avatar = HybridImageField(required=False, allow_null=True)
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department',
        write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Profile
        fields = [
            'id', 'role', 'avatar', 'bio', 'department', 'department_id',
            'year_of_study', 'institution', 'designation', 'axiom_points', 'updated_at',
        ]
        read_only_fields = ['role', 'axiom_points']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else data
        if 'year_of_study' in data and data['year_of_study'] == '':
            data['year_of_study'] = None
        if 'department_id' in data and data['department_id'] == '':
            data['department_id'] = None
        return super().to_internal_value(data)


class UserSerializer(serializers.ModelSerializer):
    """Full user profile including private email — strictly for the authenticated user's own profile (/me/)."""
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id']


class PublicUserSerializer(serializers.ModelSerializer):
    """Safe public serializer that protects the user's private email address from scrapers."""
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(
        choices=Profile.ROLE_CHOICES, default=Profile.ROLE_STUDENT, required=False
    )
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), write_only=True, required=False, allow_null=True
    )
    department = serializers.CharField(write_only=True, required=False, allow_blank=True)
    year_of_study = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    institution = serializers.CharField(write_only=True, required=False, allow_blank=True)
    designation = serializers.CharField(write_only=True, required=False, allow_blank=True)
    bio = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = [
            'email', 'username', 'first_name', 'last_name', 'password', 'password2',
            'role', 'department_id', 'department', 'year_of_study', 'institution', 'designation', 'bio',
        ]

    def validate(self, data):
        if data['password'] != data.pop('password2'):
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('role', None)
        role = Profile.ROLE_STUDENT
        department_obj = validated_data.pop('department_id', None)
        dept_name = validated_data.pop('department', None)
        year_of_study = validated_data.pop('year_of_study', None)
        institution = validated_data.pop('institution', '').strip()
        designation = validated_data.pop('designation', '').strip()
        bio = validated_data.pop('bio', '').strip()

        # If department was given as a string name rather than an ID, match it
        if not department_obj and dept_name:
            department_obj = (
                Department.objects.filter(name__iexact=dept_name).first() or
                Department.objects.filter(code__iexact=dept_name).first()
            )

        user = CustomUser.objects.create_user(**validated_data)
        profile = user.profile
        profile.role = role
        if department_obj:
            profile.department = department_obj
        if role == Profile.ROLE_STUDENT and year_of_study:
            profile.year_of_study = year_of_study
        else:
            profile.year_of_study = None

        if institution:
            profile.institution = institution
        if designation:
            profile.designation = designation
        if bio:
            profile.bio = bio
        profile.save()
        return user