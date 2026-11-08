from django.db import migrations


PRESET = {
    "name": "Navidad",
    "active": True,
    "title": "¡Feliz Navidad!",
    "message": (
        "Esta Navidad, en IGUALO queremos agradecerte por confiar en nosotros "
        "para comprar, vender y conectar con tu comunidad.\n"
        "Que estas fiestas llenen tu hogar de alegría, amor y buenos momentos.\n"
        "¡Feliz Navidad y próspero Año Nuevo! 🎁\n"
        "— Con cariño, el equipo de IGUALO 🎅"
    ),
    "order": 5,
}


def create_preset(apps, schema_editor):
    SystemAlert = apps.get_model("core", "SystemAlert")
    with schema_editor.connection.cursor() as cursor:
        table = schema_editor.connection.ops.quote_name("core_systemalert")
        cursor.execute(
            f"SELECT setval(pg_get_serial_sequence('core_systemalert', 'id'), "
            f"GREATEST((SELECT COALESCE(MAX(id), 1) FROM {table}), 1))"
        )
    SystemAlert.objects.update_or_create(
        name=PRESET["name"],
        defaults={
            "active": PRESET["active"],
            "title": PRESET["title"],
            "message": PRESET["message"],
            "order": PRESET["order"],
        },
    )


def remove_preset(apps, schema_editor):
    SystemAlert = apps.get_model("core", "SystemAlert")
    SystemAlert.objects.filter(name=PRESET["name"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0069_alter_systemalert_options_systemalert_ends_at_and_more"),
    ]

    operations = [
        migrations.RunPython(create_preset, remove_preset),
    ]
