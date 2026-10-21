from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('studio', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='creation',
            name='media',
            field=models.FileField(blank=True, null=True, upload_to='studio/media/'),
        ),
    ]
