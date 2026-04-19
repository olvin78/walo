from django.core.management.base import BaseCommand
from applications.core.models import Listing, ListingImage
from applications.core.utils import process_image
import os
from django.conf import settings

class Command(BaseCommand):
    help = 'Genera miniaturas optimizadas para todos los anuncios existentes'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando proceso de optimización de imágenes...'))
        
        listings = Listing.objects.exclude(image='')
        listing_images = ListingImage.objects.exclude(image='')
        
        total_listings = listings.count()
        total_extra = listing_images.count()
        
        self.stdout.write(f'Encontrados {total_listings} anuncios y {total_extra} imágenes extra.')
        
        counters = {'reviewed': 0, 'generated': 0, 'skipped': 0, 'errors': 0}

        # Procesar imágenes de Listing
        for item in listings:
            self._process_item(item, counters)
            
        # Procesar imágenes de ListingImage
        for item in listing_images:
            self._process_item(item, counters)

        self.stdout.write(self.style.SUCCESS('\nResumen Final:'))
        self.stdout.write(f'- Total revisadas: {counters["reviewed"]}')
        self.stdout.write(f'- Generadas (o verificadas): {counters["generated"]}')
        self.stdout.write(f'- Saltadas: {counters["skipped"]}')
        self.stdout.write(self.style.ERROR(f'- Errores: {counters["errors"]}'))

    def _process_item(self, item, counters):
        counters['reviewed'] += 1
        try:
            if not item.image or not os.path.exists(item.image.path):
                counters['skipped'] += 1
                return
            
            # process_image internamente maneja si ya existen o no 
            # (en mi implementación actual las sobreescribe/re-genera, 
            # lo cual es bueno para asegurar WebP)
            result = process_image(item.image)
            if result:
                counters['generated'] += 1
                self.stdout.write(f'Procesada: {item.image.name}')
            else:
                counters['errors'] += 1
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error en {item.pk}: {e}'))
            counters['errors'] += 1
