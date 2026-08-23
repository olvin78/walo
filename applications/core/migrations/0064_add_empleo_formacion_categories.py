from django.db import migrations


def add_categories(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    empleo_category, _ = Category.objects.update_or_create(
        slug='empleo',
        defaults={
            'name': 'Empleo',
            'icon': '💼',
            'description': 'Ofertas de trabajo, empleos de tiempo completo, medio tiempo, remoto y freelance en Nicaragua.',
            'keywords': 'empleo, trabajo, vacante, oferta laboral, freelance, remoto, medio tiempo, tiempo completo, bolsa de trabajo',
            'order': 100,
        }
    )

    empleo_subcategories = [
        {'name': 'Tiempo Completo', 'slug': 'empleo-tiempo-completo', 'icon': '💼', 'description': 'Vacantes de trabajo a tiempo completo.', 'order': 10},
        {'name': 'Medio Tiempo', 'slug': 'empleo-medio-tiempo', 'icon': '⏰', 'description': 'Empleos de medio tiempo y horarios flexibles.', 'order': 20},
        {'name': 'Freelance y Por Proyecto', 'slug': 'empleo-freelance', 'icon': '💻', 'description': 'Trabajos independientes y por proyecto.', 'order': 30},
        {'name': 'Remoto', 'slug': 'empleo-remoto', 'icon': '🌐', 'description': 'Empleos 100% remotos, trabaja desde casa.', 'order': 40},
        {'name': 'Prácticas y Pasantías', 'slug': 'empleo-practicas', 'icon': '🎓', 'description': 'Oportunidades de práctica profesional y pasantías.', 'order': 50},
        {'name': 'Oficios y Construcción', 'slug': 'empleo-oficios', 'icon': '🔨', 'description': 'Albañilería, electricidad, plomería y otros oficios.', 'order': 60},
        {'name': 'Ventas y Atención al Cliente', 'slug': 'empleo-ventas', 'icon': '🛒', 'description': 'Vacantes de ventas, call center y atención al cliente.', 'order': 70},
        {'name': 'Otros Empleos', 'slug': 'empleo-otros', 'icon': '📋', 'description': 'Otras ofertas de trabajo.', 'order': 80},
    ]

    for sub in empleo_subcategories:
        Subcategory.objects.update_or_create(
            slug=sub['slug'],
            defaults={
                'category': empleo_category,
                'name': sub['name'],
                'icon': sub['icon'],
                'description': sub['description'],
                'keywords': sub['name'].lower() + ', empleo, trabajo',
                'order': sub['order'],
            }
        )

    formacion_category, _ = Category.objects.update_or_create(
        slug='formacion',
        defaults={
            'name': 'Formación',
            'icon': '🎓',
            'description': 'Cursos de inglés, matemáticas, informática y clases particulares en Nicaragua.',
            'keywords': 'formacion, cursos, clases, cursos de ingles, cursos de matematicas, clases particulares, academia, capacitacion, tutorias',
            'order': 100,
        }
    )

    formacion_subcategories = [
        {'name': 'Idiomas (Inglés y más)', 'slug': 'formacion-idiomas', 'icon': '🗣️', 'description': 'Cursos de inglés y otros idiomas.', 'order': 10},
        {'name': 'Matemáticas y Reforzamiento', 'slug': 'formacion-matematicas', 'icon': '➗', 'description': 'Clases de matemáticas y reforzamiento escolar.', 'order': 20},
        {'name': 'Informática y Tecnología', 'slug': 'formacion-informatica', 'icon': '💻', 'description': 'Cursos de computación, programación y tecnología.', 'order': 30},
        {'name': 'Música y Arte', 'slug': 'formacion-musica-arte', 'icon': '🎵', 'description': 'Clases de música, canto, dibujo y arte.', 'order': 40},
        {'name': 'Manualidades y Oficios', 'slug': 'formacion-manualidades', 'icon': '🎨', 'description': 'Cursos de manualidades, cocina y oficios técnicos.', 'order': 50},
        {'name': 'Preparación Universitaria', 'slug': 'formacion-preparacion', 'icon': '📝', 'description': 'Tutorías y preparación para exámenes de admisión.', 'order': 60},
        {'name': 'Cursos en Línea', 'slug': 'formacion-en-linea', 'icon': '🖥️', 'description': 'Cursos y talleres virtuales a tu propio ritmo.', 'order': 70},
        {'name': 'Otra Formación', 'slug': 'formacion-otros', 'icon': '📚', 'description': 'Otros cursos y clases particulares.', 'order': 80},
    ]

    for sub in formacion_subcategories:
        Subcategory.objects.update_or_create(
            slug=sub['slug'],
            defaults={
                'category': formacion_category,
                'name': sub['name'],
                'icon': sub['icon'],
                'description': sub['description'],
                'keywords': sub['name'].lower() + ', formacion, cursos, clases',
                'order': sub['order'],
            }
        )


def remove_categories(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Category.objects.filter(slug__in=['empleo', 'formacion']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0063_add_seguros_category'),
    ]

    operations = [
        migrations.RunPython(add_categories, remove_categories),
    ]
