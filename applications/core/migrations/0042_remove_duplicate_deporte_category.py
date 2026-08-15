from django.db import migrations


def remove_duplicate_deporte(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Category.objects.filter(slug='deportes').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0041_add_requested_categories'),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_deporte, migrations.RunPython.noop),
    ]
