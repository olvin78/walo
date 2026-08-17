from django.db import migrations


ICON_FIXES = [
    # slug, new_icon
    ("electro-linea-blanca", "⚙️"),
    ("electro-refrigeradoras", "🥶"),
    ("electro-pequenos-electrodomesticos", "🔌"),
    ("electro-clima-y-ventilacion", "🌡️"),
    ("motores", "⚙️"),
    ("nino", "👦"),
]


def apply_fixes(apps, schema_editor):
    Category = apps.get_model("core", "Category")
    Subcategory = apps.get_model("core", "Subcategory")
    for slug, icon in ICON_FIXES:
        Subcategory.objects.filter(slug=slug).update(icon=icon)
        Category.objects.filter(slug=slug).update(icon=icon)


def revert_fixes(apps, schema_editor):
    # No-op: los iconos anteriores eran duplicados/rotos, no hay nada útil a lo que volver.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0051_profile_expo_push_token"),
    ]

    operations = [
        migrations.RunPython(apply_fixes, revert_fixes),
    ]
