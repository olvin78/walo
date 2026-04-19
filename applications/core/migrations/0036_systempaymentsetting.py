from django.db import migrations, models


def create_default_system_payment_setting(apps, schema_editor):
    SystemPaymentSetting = apps.get_model('core', 'SystemPaymentSetting')
    SystemPaymentSetting.objects.get_or_create(pk=1, defaults={'enabled': False})


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_pro_flags'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemPaymentSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False, help_text='Activa o desactiva Pro, estrellas y promociones de anuncios en toda la web.', verbose_name='Sistema de pagos activo')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='actualizado el')),
            ],
            options={
                'verbose_name': 'Sistema de pago',
                'verbose_name_plural': 'Sistema de pago',
            },
        ),
        migrations.RunPython(create_default_system_payment_setting, migrations.RunPython.noop),
    ]
