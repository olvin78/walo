from django.db import migrations, models


PRESETS = [
    {
        "name": "Mejoras",
        "active": True,
        "title": "🚧 Estamos mejorando Igualo ✨",
        "message": "La plataforma está recibiendo nuevas funciones y ajustes en estos momentos. Si notas algo distinto o algún comportamiento raro, es parte de las mejoras — todo sigue funcionando con normalidad.",
        "order": 10,
    },
    {
        "name": "Mantenimiento",
        "active": False,
        "title": "🔧 Mantenimiento programado",
        "message": "Hoy de 2:00 a 4:00 am haremos mantenimiento de la plataforma. La web podría estar unos minutos indisponible.",
        "order": 20,
    },
    {
        "name": "Incidente",
        "active": False,
        "title": "⚠️ Estamos resolviendo un problema técnico",
        "message": "Estamos presentando fallas intermitentes en algunos servicios. Nuestro equipo ya está trabajando en ello y lo solucionaremos lo antes posible.",
        "order": 30,
    },
    {
        "name": "Novedad",
        "active": False,
        "title": "🎉 Nueva función disponible",
        "message": "Ya está disponible lo nuevo de Igualo. Descubre las mejoras y aprovecha para publicar y llegar a más clientes.",
        "order": 40,
    },
    {
        "name": "Campana",
        "active": False,
        "title": "📣 ¡Esta semana publica gratis y destaca!",
        "message": "Publica tu anuncio esta semana y consigue más visitas. Entre todos hacemos el mercado de Nicaragua más grande.",
        "order": 50,
    },
    {
        "name": "Seguridad",
        "active": False,
        "title": "🛡️ Consejo de seguridad",
        "message": "Igualo nunca te pedirá tu contraseña ni pagos fuera de la plataforma. Ante cualquier sospecha, reporta el anuncio o el chat.",
        "order": 60,
    },
    {
        "name": "Aviso legal",
        "active": False,
        "title": "📜 Actualización de nuestros términos",
        "message": "Hemos actualizado los términos de uso de la plataforma. Revisa las novedades para seguir publicando sin problemas.",
        "order": 70,
    },
]


def create_presets(apps, schema_editor):
    SystemAlert = apps.get_model("core", "SystemAlert")
    # El antiguo modelo forzaba pk=1 en cada guardado; la secuencia de IDs
    # puede estar atrasada y provocar colisiones al insertar.
    with schema_editor.connection.cursor() as cursor:
        table = schema_editor.connection.ops.quote_name("core_systemalert")
        cursor.execute(
            f"SELECT setval(pg_get_serial_sequence('core_systemalert', 'id'), "
            f"GREATEST((SELECT COALESCE(MAX(id), 1) FROM {table}), 1))"
        )
    for preset in PRESETS:
        SystemAlert.objects.update_or_create(
            name=preset["name"],
            defaults={
                "active": preset["active"],
                "title": preset["title"],
                "message": preset["message"],
                "order": preset["order"],
            },
        )


def remove_presets(apps, schema_editor):
    SystemAlert = apps.get_model("core", "SystemAlert")
    SystemAlert.objects.filter(name__in=[p["name"] for p in PRESETS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0067_systemalert"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemalert",
            name="name",
            field=models.CharField(default="General", max_length=60, unique=True, verbose_name="Nombre interno"),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="systemalert",
            name="order",
            field=models.PositiveIntegerField(default=100, verbose_name="orden"),
        ),
        migrations.AlterField(
            model_name="systemalert",
            name="title",
            field=models.CharField(max_length=120, verbose_name="Título del aviso"),
        ),
        migrations.AlterField(
            model_name="systemalert",
            name="message",
            field=models.TextField(verbose_name="Mensaje"),
        ),
        migrations.AlterField(
            model_name="systemalert",
            name="active",
            field=models.BooleanField(default=False, help_text="Enciende o apaga este aviso en toda la web.", verbose_name="Activa"),
        ),
        migrations.RunPython(create_presets, remove_presets),
    ]
