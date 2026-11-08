from django.db import migrations


PRESET = {
    "name": "Verificacion",
    "active": True,
    "title": "Verifica tu perfil",
    "message": (
        "Los compradores confían más en vendedores verificados… ¡y eso se "
        "traduce en más ventas! 📈\n"
        "Verificarte es gratis y solo te toma 1 minuto: agrega tu número de "
        "móvil y una foto de tu rostro para lucir un perfil creíble y seguro.\n"
        "¡Hazlo ahora y empieza a vender con confianza!\n"
        "— El equipo de IGUALO"
    ),
    "order": 6,
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
        ("core", "0070_systemalert_navidad_preset"),
    ]

    operations = [
        migrations.RunPython(create_preset, remove_preset),
    ]
