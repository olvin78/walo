from django.db import migrations


def add_requested_categories(apps, schema_editor):
    Category = apps.get_model('core', 'Category')

    categories = [
        {
            'name': 'Nino',
            'slug': 'nino',
            'icon': '🧒',
            'description': 'Ropa, calzado, juguetes y accesorios para ninos.',
            'keywords': 'nino, ninos, infantil, ropa de nino, juguetes, colegio, bebe varon',
            'order': 100,
        },
        {
            'name': 'Nina',
            'slug': 'nina',
            'icon': '👧',
            'description': 'Ropa, calzado, juguetes y accesorios para ninas.',
            'keywords': 'nina, ninas, infantil, ropa de nina, juguetes, colegio, bebe mujer',
            'order': 100,
        },
        {
            'name': 'Mascotas',
            'slug': 'mascotas',
            'icon': '🐾',
            'description': 'Todo para mascotas: alimento, accesorios, higiene y cuidado.',
            'keywords': 'mascotas, perros, gatos, aves, peces, alimento, veterinaria, accesorios para mascotas',
            'order': 100,
        },
        {
            'name': 'Jardineria',
            'slug': 'jardineria',
            'icon': '🌿',
            'description': 'Herramientas, plantas, macetas y productos de jardineria.',
            'keywords': 'jardineria, jardin, plantas, macetas, semillas, herramientas de jardin, vivero',
            'order': 100,
        },
    ]

    for category in categories:
        Category.objects.update_or_create(
            slug=category['slug'],
            defaults=category,
        )


def remove_requested_categories(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Category.objects.filter(slug__in=['nino', 'nina', 'mascotas', 'jardineria']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_listingreport'),
    ]

    operations = [
        migrations.RunPython(add_requested_categories, remove_requested_categories),
    ]
