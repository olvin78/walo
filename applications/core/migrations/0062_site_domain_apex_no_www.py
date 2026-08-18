from django.db import migrations


def set_apex_domain(apps, schema_editor):
    """3A — Unificación de dominio: la autoridad canónica pasa a ser
    https://igualo.com (sin www), decisión de negocio. Sustituye a la
    0058, que había fijado www.igualo.com."""
    Site = apps.get_model("sites", "Site")
    Site.objects.update_or_create(
        id=1,
        defaults={"domain": "igualo.com", "name": "Igualo"},
    )


def revert_apex_domain(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    Site.objects.filter(id=1).update(domain="www.igualo.com", name="Igualo")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0061_add_department_status_index"),
    ]

    operations = [
        migrations.RunPython(set_apex_domain, revert_apex_domain),
    ]
