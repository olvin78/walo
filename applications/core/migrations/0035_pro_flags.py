# Generated manually to align the model state with the live schema.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_searchhistory'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE core_listing ADD COLUMN IF NOT EXISTS is_featured_paid boolean NOT NULL DEFAULT false;"
                        " ALTER TABLE core_profile ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE core_profile DROP COLUMN IF EXISTS is_pro;"
                        " ALTER TABLE core_listing DROP COLUMN IF EXISTS is_featured_paid;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='listing',
                    name='is_featured_paid',
                    field=models.BooleanField(default=False, help_text='¿Anuncio destacado/priorizado?'),
                ),
                migrations.AddField(
                    model_name='profile',
                    name='is_pro',
                    field=models.BooleanField(default=False, help_text='¿Es usuario Pro?'),
                ),
            ],
        ),
    ]
