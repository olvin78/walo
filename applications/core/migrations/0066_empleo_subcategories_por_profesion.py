from django.db import migrations


REMOVED_SLUGS = ['empleo-tiempo-completo', 'empleo-medio-tiempo', 'empleo-freelance']

# Subcategorías que ya existían y solo se reordenan / actualizan.
UPDATED = [
    {'slug': 'empleo-remoto', 'name': 'Remoto y Freelance', 'icon': '🌐', 'description': 'Trabajo remoto y proyectos freelance desde casa.', 'order': 160},
    {'slug': 'empleo-practicas', 'name': 'Prácticas y Pasantías', 'icon': '🎓', 'description': 'Oportunidades de práctica profesional y pasantías.', 'order': 25},
    {'slug': 'empleo-oficios', 'name': 'Construcción y Oficios', 'icon': '🔨', 'description': 'Albañilería, electricidad, plomería y otros oficios.', 'order': 30},
    {'slug': 'empleo-ventas', 'name': 'Ventas y Atención al Cliente', 'icon': '🛒', 'description': 'Vacantes de ventas, call center y atención al cliente.', 'order': 80},
    {'slug': 'empleo-otros', 'name': 'Otros Empleos', 'icon': '📋', 'description': 'Otras ofertas de trabajo.', 'order': 170},
]

# Subcategorías nuevas por profesión/rubro, las más buscadas en Nicaragua.
NEW = [
    {'slug': 'empleo-salud', 'name': 'Salud y Medicina', 'icon': '🩺', 'description': 'Médicos, enfermeras, odontólogos y personal de salud.', 'order': 10},
    {'slug': 'empleo-educacion', 'name': 'Educación y Docencia', 'icon': '🍎', 'description': 'Maestros, profesores y personal educativo.', 'order': 20},
    {'slug': 'empleo-domestico', 'name': 'Servicio Doméstico y Cuidado', 'icon': '🧹', 'description': 'Empleadas domésticas, niñeras y cuidadores.', 'order': 40},
    {'slug': 'empleo-transporte', 'name': 'Choferes y Transporte', 'icon': '🚛', 'description': 'Choferes particulares, de carga y motorizados.', 'order': 50},
    {'slug': 'empleo-seguridad', 'name': 'Seguridad', 'icon': '👮', 'description': 'Guardias y personal de seguridad.', 'order': 60},
    {'slug': 'empleo-restaurantes', 'name': 'Restaurantes y Turismo', 'icon': '🍽️', 'description': 'Meseros, cocineros, hotelería y turismo.', 'order': 70},
    {'slug': 'empleo-oficina', 'name': 'Oficina y Administración', 'icon': '🗄️', 'description': 'Asistentes, recepcionistas y personal administrativo.', 'order': 90},
    {'slug': 'empleo-callcenter', 'name': 'Call Center y Telemercadeo', 'icon': '📞', 'description': 'Agentes de call center y telemercadeo.', 'order': 100},
    {'slug': 'empleo-tecnologia', 'name': 'Tecnología e Informática', 'icon': '💻', 'description': 'Desarrolladores, soporte técnico y sistemas.', 'order': 110},
    {'slug': 'empleo-contabilidad', 'name': 'Contabilidad y Finanzas', 'icon': '🧮', 'description': 'Contadores, auxiliares contables y finanzas.', 'order': 120},
    {'slug': 'empleo-legal', 'name': 'Legal', 'icon': '⚖️', 'description': 'Abogados y asistentes legales.', 'order': 130},
    {'slug': 'empleo-belleza', 'name': 'Belleza y Estética', 'icon': '💇', 'description': 'Estilistas, barberos y personal de estética.', 'order': 140},
    {'slug': 'empleo-agricultura', 'name': 'Agricultura y Campo', 'icon': '🌾', 'description': 'Trabajo agrícola, ganadero y de campo.', 'order': 150},
]


def apply_changes(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    empleo = Category.objects.filter(slug='empleo').first()
    if not empleo:
        return

    Subcategory.objects.filter(slug__in=REMOVED_SLUGS).delete()

    for sub in UPDATED + NEW:
        Subcategory.objects.update_or_create(
            slug=sub['slug'],
            defaults={
                'category': empleo,
                'name': sub['name'],
                'icon': sub['icon'],
                'description': sub['description'],
                'keywords': sub['name'].lower() + ', empleo, trabajo, vacante',
                'order': sub['order'],
            }
        )


def revert_changes(apps, schema_editor):
    Category = apps.get_model('core', 'Category')
    Subcategory = apps.get_model('core', 'Subcategory')

    empleo = Category.objects.filter(slug='empleo').first()
    if not empleo:
        return

    Subcategory.objects.filter(slug__in=[sub['slug'] for sub in NEW]).delete()

    restored = [
        {'slug': 'empleo-tiempo-completo', 'name': 'Tiempo Completo', 'icon': '💼', 'description': 'Vacantes de trabajo a tiempo completo.', 'order': 10},
        {'slug': 'empleo-medio-tiempo', 'name': 'Medio Tiempo', 'icon': '⏰', 'description': 'Empleos de medio tiempo y horarios flexibles.', 'order': 20},
        {'slug': 'empleo-freelance', 'name': 'Freelance y Por Proyecto', 'icon': '💻', 'description': 'Trabajos independientes y por proyecto.', 'order': 30},
        {'slug': 'empleo-remoto', 'name': 'Remoto', 'icon': '🌐', 'description': 'Empleos 100% remotos, trabaja desde casa.', 'order': 40},
        {'slug': 'empleo-practicas', 'name': 'Prácticas y Pasantías', 'icon': '🎓', 'description': 'Oportunidades de práctica profesional y pasantías.', 'order': 50},
        {'slug': 'empleo-oficios', 'name': 'Oficios y Construcción', 'icon': '🔨', 'description': 'Albañilería, electricidad, plomería y otros oficios.', 'order': 60},
        {'slug': 'empleo-ventas', 'name': 'Ventas y Atención al Cliente', 'icon': '🛒', 'description': 'Vacantes de ventas, call center y atención al cliente.', 'order': 70},
        {'slug': 'empleo-otros', 'name': 'Otros Empleos', 'icon': '📋', 'description': 'Otras ofertas de trabajo.', 'order': 80},
    ]
    for sub in restored:
        Subcategory.objects.update_or_create(
            slug=sub['slug'],
            defaults={
                'category': empleo,
                'name': sub['name'],
                'icon': sub['icon'],
                'description': sub['description'],
                'keywords': sub['name'].lower() + ', empleo, trabajo',
                'order': sub['order'],
            }
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0065_feature_empleo_fix_seguros_icons'),
    ]

    operations = [
        migrations.RunPython(apply_changes, revert_changes),
    ]
