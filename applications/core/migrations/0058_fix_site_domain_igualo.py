from django.db import migrations


def fix_site_domain(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        id=1,
        defaults={"domain": "www.igualo.com", "name": "Igualo"},
    )


def revert_site_domain(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.filter(id=1).update(domain="example.com", name="example.com")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0057_story_expires_at_is_active_text"),
        ("sites", "0002_alter_domain_unique"),
    ]

    operations = [
        migrations.RunPython(fix_site_domain, revert_site_domain),
    ]