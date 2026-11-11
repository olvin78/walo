from django.db import migrations, models


APP_ALERT = {
    "name": "AppIgualo",
    "active": True,
    "title": "¡IGUALO ya está en tu celular!",
    "message": (
        "Descargá la nueva app de IGUALO y llevá tus compras y ventas a donde vayas.\n"
        "Encontrá oportunidades, publicá anuncios y conectate con Nicaragua desde tu teléfono."
    ),
    "button_text": "Descargar la app",
    "order": 4,
}


def create_app_alert(apps, schema_editor):
    SystemAlert = apps.get_model("core", "SystemAlert")
    SystemAlert.objects.update_or_create(
        name=APP_ALERT["name"],
        defaults={key: value for key, value in APP_ALERT.items() if key != "name"},
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0071_systemalert_verificacion_preset")]

    operations = [
        migrations.AddField(
            model_name="systemalert",
            name="image",
            field=models.ImageField(
                blank=True,
                help_text="Imagen opcional para alertas promocionales.",
                null=True,
                upload_to="alerts/",
                verbose_name="Imagen promocional",
            ),
        ),
        migrations.AddField(
            model_name="systemalert",
            name="link_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="URL opcional para el botón principal.",
                verbose_name="Enlace del botón",
            ),
        ),
        migrations.AddField(
            model_name="systemalert",
            name="button_text",
            field=models.CharField(
                blank=True,
                default="",
                max_length=40,
                verbose_name="Texto del botón",
            ),
        ),
        migrations.RunPython(create_app_alert, migrations.RunPython.noop),
    ]
