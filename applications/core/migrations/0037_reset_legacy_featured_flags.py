from django.db import migrations


def reset_legacy_featured_flags(apps, schema_editor):
    Listing = apps.get_model('core', 'Listing')
    Listing.objects.all().update(is_featured_paid=False)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_systempaymentsetting'),
    ]

    operations = [
        migrations.RunPython(reset_legacy_featured_flags, migrations.RunPython.noop),
    ]
