from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0049_expand_tech_gaming'),
    ]

    operations = [
        migrations.AddField(
            model_name='message',
            name='file',
            field=models.FileField(blank=True, null=True, upload_to='chat_files/'),
        ),
    ]
