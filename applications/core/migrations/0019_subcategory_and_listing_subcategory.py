from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_listing_latitude_listing_longitude"),
    ]

    operations = [
        migrations.CreateModel(
            name="Subcategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("icon", models.CharField(help_text="Emoji o clase de icono", max_length=50)),
                ("description", models.TextField(blank=True, help_text="Palabras clave para el buscador")),
                ("slug", models.SlugField(unique=True)),
                (
                    "category",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subcategories", to="core.category"),
                ),
            ],
            options={
                "verbose_name_plural": "Subcategories",
            },
        ),
        migrations.AddField(
            model_name="listing",
            name="subcategory",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="listings", to="core.subcategory"),
        ),
    ]
