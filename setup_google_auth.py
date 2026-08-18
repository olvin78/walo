import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp

# Configurar sitios
site_prod, _ = Site.objects.get_or_create(domain='igualo.com', defaults={'name': 'Igualo'})
site_local, _ = Site.objects.get_or_create(domain='127.0.0.1:8000', defaults={'name': 'Localhost'})
site_localhost, _ = Site.objects.get_or_create(domain='localhost:8000', defaults={'name': 'Localhost 2'})

client_id = 'REPLACED_GOOGLE_OAUTH_CLIENT_ID'
secret = 'GOCSPX-2dlWMFgCnUTLN0kQHiufa0Z2lP'

app, created = SocialApp.objects.get_or_create(
    provider='google',
    defaults={
        'name': 'walo',
        'client_id': client_id,
        'secret': secret,
    }
)

if not created:
    app.client_id = client_id
    app.secret = secret
    app.save()

app.sites.add(site_prod, site_local, site_localhost)
print("Configuración de Google Login completada con éxito.")
