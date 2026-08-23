from django.db import migrations


def apply_changes(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    # Destacar "Empleo" para que aparezca cerca del inicio del listado de categorías.
    Category.objects.filter(slug='empleo').update(order=2)

    # Los íconos de Seguros ya se habían aplicado con la migración 0063 antes de
    # pulirlos para que no se repitan entre sí; se corrigen aquí sobre datos existentes.
    icon_fixes = {
        'seguros-auto': '🚘',
        'seguros-hogar': '🏡',
        'seguros-salud': '🩺',
        'seguros-otros': '📄',
    }
    for slug, icon in icon_fixes.items():
        Subcategory.objects.filter(slug=slug).update(icon=icon)


def revert_changes(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    Category.objects.filter(slug='empleo').update(order=100)

    icon_reverts = {
        'seguros-auto': '🚗',
        'seguros-hogar': '🏠',
        'seguros-salud': '🏥',
        'seguros-otros': '🛡️',
    }
    for slug, icon in icon_reverts.items():
        Subcategory.objects.filter(slug=slug).update(icon=icon)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0064_add_empleo_formacion_categories'),
    ]

    operations = [
        migrations.RunPython(apply_changes, revert_changes),
    ]
