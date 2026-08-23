from django.db import migrations


def add_seguros_category(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    seguros_category, _ = Category.objects.update_or_create(
        slug='seguros',
        defaults={
            'name': 'Seguros',
            'icon': '🛡️',
            'description': 'Seguros de auto, moto, hogar, salud, vida, viajes y negocios en Nicaragua.',
            'keywords': 'seguros, aseguradora, poliza, seguro de auto, seguro de casa, seguro medico, seguro de vida, cobertura, INISER, aseguradora nicaragua',
            'order': 100,
        }
    )

    subcategories = [
        {'name': 'Seguros de Auto', 'slug': 'seguros-auto', 'icon': '🚘', 'description': 'Seguros de vehículo con cobertura contra daños, robo y responsabilidad civil.', 'order': 10},
        {'name': 'Seguros de Moto', 'slug': 'seguros-moto', 'icon': '🏍️', 'description': 'Coberturas para motocicletas y scooters.', 'order': 20},
        {'name': 'Seguros de Hogar', 'slug': 'seguros-hogar', 'icon': '🏡', 'description': 'Protege tu casa contra incendios, terremotos, robo y más.', 'order': 30},
        {'name': 'Seguros de Salud', 'slug': 'seguros-salud', 'icon': '🩺', 'description': 'Pólizas médicas, hospitalización y gastos médicos mayores.', 'order': 40},
        {'name': 'Seguros de Vida', 'slug': 'seguros-vida', 'icon': '❤️', 'description': 'Respaldo económico para tu familia ante cualquier imprevisto.', 'order': 50},
        {'name': 'Seguros de Viaje', 'slug': 'seguros-viaje', 'icon': '✈️', 'description': 'Cobertura médica y asistencia durante tus viajes.', 'order': 60},
        {'name': 'Seguros Empresariales', 'slug': 'seguros-empresariales', 'icon': '💼', 'description': 'Protección para negocios, locales comerciales y flotas de trabajo.', 'order': 70},
        {'name': 'Otros Seguros', 'slug': 'seguros-otros', 'icon': '📄', 'description': 'Otras pólizas y coberturas especiales.', 'order': 80},
    ]

    for sub in subcategories:
        Subcategory.objects.update_or_create(
            slug=sub['slug'],
            defaults={
                'category': seguros_category,
                'name': sub['name'],
                'icon': sub['icon'],
                'description': sub['description'],
                'keywords': sub['name'].lower() + ', seguros, poliza',
                'order': sub['order'],
            }
        )


def remove_seguros_category(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Category.objects.filter(slug='seguros').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0062_site_domain_apex_no_www'),
    ]

    operations = [
        migrations.RunPython(add_seguros_category, remove_seguros_category),
    ]
