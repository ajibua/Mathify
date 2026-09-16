import base64
import binascii
import mimetypes
import uuid
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from rest_framework import serializers


def _guess_file_extension(data_bytes, mime_type=None):
    """
    Determines file extension using header magic bytes with fallback to mime_type.
    """
    if data_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    elif data_bytes.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    elif data_bytes.startswith(b'GIF87a') or data_bytes.startswith(b'GIF89a'):
        return 'gif'
    elif len(data_bytes) >= 12 and data_bytes[:4] == b'RIFF' and data_bytes[8:12] == b'WEBP':
        return 'webp'
    elif data_bytes.startswith(b'%PDF-'):
        return 'pdf'
    elif data_bytes.startswith(b'PK\x03\x04'):
        return 'zip'
    elif data_bytes.startswith(b'\x1aE\xdf\xa3'):
        return 'webm'
    
    if mime_type:
        ext = mimetypes.guess_extension(mime_type)
        if ext:
            return ext.lstrip('.')
    return 'bin'


class HybridFileField(serializers.FileField):
    """
    A versatile DRF FileField that seamlessly accepts:
    1. Standard multipart UploadedFile (<input type="file"> via FormData)
    2. Base64 Data URL (e.g. "data:image/png;base64,iVBORw0KGgo...")
    3. Raw Base64 string
    4. Existing URLs or paths (safely preserved if untouched)
    """

    def __init__(self, *args, max_upload_size_mb=25, allowed_extensions=None, **kwargs):
        self.max_upload_size_bytes = max_upload_size_mb * 1024 * 1024
        self.allowed_extensions = [e.lower().lstrip('.') for e in allowed_extensions] if allowed_extensions else None
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        if data in (None, '', 'null'):
            if self.allow_null or not self.required:
                return None
            raise serializers.ValidationError('This file field is required.')

        if isinstance(data, UploadedFile):
            if data.size > self.max_upload_size_bytes:
                max_mb = self.max_upload_size_bytes // (1024 * 1024)
                raise serializers.ValidationError(f'Uploaded file exceeds maximum allowed size of {max_mb} MB.')
            if self.allowed_extensions:
                ext = (data.name.split('.')[-1] if '.' in data.name else '').lower()
                if ext not in self.allowed_extensions:
                    raise serializers.ValidationError(f'Unsupported file type: .{ext}. Allowed: {", ".join(self.allowed_extensions)}')
            return super().to_internal_value(data)

        if isinstance(data, str):
            data_str = data.strip()

            # Pre-uploaded storage key (e.g. "posts/media/abc_123.mp4")
            if data_str.startswith('posts/media/') or data_str.startswith('media/') or data_str.startswith('avatars/'):
                return data_str

            if data_str.startswith('http://') or data_str.startswith('https://') or data_str.startswith('/media/'):
                if self.root.instance:
                    return getattr(self.root.instance, self.source or self.field_name, None)
                from django.conf import settings
                media_url = getattr(settings, 'MEDIA_URL', '')
                if media_url and data_str.startswith(media_url):
                    return data_str[len(media_url):].lstrip('/')
                return data_str

            # Base64 Data URL parsing
            header_mime = None
            raw_base64 = data_str

            if ';base64,' in data_str:
                header, raw_base64 = data_str.split(';base64,', 1)
                if header.startswith('data:'):
                    header_mime = header[5:].strip()

            try:
                decoded_bytes = base64.b64decode(raw_base64)
            except (binascii.Error, ValueError):
                raise serializers.ValidationError('Invalid base64-encoded file payload.')

            if len(decoded_bytes) > self.max_upload_size_bytes:
                max_mb = self.max_upload_size_bytes // (1024 * 1024)
                raise serializers.ValidationError(f'Uploaded file exceeds maximum allowed size of {max_mb} MB.')

            ext = _guess_file_extension(decoded_bytes, header_mime)
            if self.allowed_extensions and ext not in self.allowed_extensions:
                raise serializers.ValidationError(f'Unsupported file type: .{ext}. Allowed: {", ".join(self.allowed_extensions)}')

            filename = f"upload_{uuid.uuid4().hex[:10]}.{ext}"
            return ContentFile(decoded_bytes, name=filename)

        return super().to_internal_value(data)


class HybridImageField(HybridFileField):
    """
    Subclass tailored specifically for images (JPEG, PNG, WEBP, GIF, SVG).
    """
    DEFAULT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']

    def __init__(self, *args, **kwargs):
        if 'allowed_extensions' not in kwargs:
            kwargs['allowed_extensions'] = self.DEFAULT_IMAGE_EXTENSIONS
        if 'max_upload_size_mb' not in kwargs:
            kwargs['max_upload_size_mb'] = 10  
        super().__init__(*args, **kwargs)
