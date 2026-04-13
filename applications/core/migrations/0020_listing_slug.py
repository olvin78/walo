from django.db import migrations, models
from django.utils.text import slugify


def backfill_listing_slug(apps, schema_editor):
    Listing = apps.get_model("core", "Listing")
    for listing in Listing.objects.all():
        if listing.slug:
            continue
        base = slugify(listing.title or "anuncio")
        if not base:
            base = f"anuncio-{listing.id}"
        listing.slug = base
        listing.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0019_subcategory_and_listing_subcategory"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="slug",
            field=models.SlugField(blank=True),
        ),
        migrations.RunPython(backfill_listing_slug, migrations.RunPython.noop),
    ]
