import os
from PIL import Image, ImageOps
from django.conf import settings
from django.core.files.base import ContentFile
from io import BytesIO

def get_thumbnail_path(original_path, suffix):
    """Genera una ruta para una miniatura basada en la original."""
    filename, ext = os.path.splitext(original_path)
    return f"{filename}_{suffix}.webp"

def process_image(image_field, sizes={'thumb': (400, 400), 'medium': (800, 800), 'large': (1200, 1200)}):
    """
    Procesa una imagen para generar versiones optimizadas en WebP.
    """
    if not image_field:
        return
    
    try:
        # Abrir la imagen original
        img = Image.open(image_field.path)
        
        # Corregir orientación basada en EXIF
        img = ImageOps.exif_transpose(img)
        
        original_name = image_field.name
        results = {}

        for name, size in sizes.items():
            # Crear una copia para procesar
            temp_img = img.copy()
            
            # Thumbnail (Recorte cuadrado) si es thumb, o resize proporcional
            if name == 'thumb':
                temp_img = ImageOps.fit(temp_img, size, Image.Resampling.LANCZOS)
            else:
                temp_img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Guardar en WebP
            output = BytesIO()
            temp_img.save(output, format='WEBP', quality=80, optimize=True)
            output.seek(0)
            
            # Generar nombre de archivo
            thumb_name = get_thumbnail_path(original_name, name)
            thumb_full_path = os.path.join(settings.MEDIA_ROOT, thumb_name)
            
            # Asegurar directorio
            os.makedirs(os.path.dirname(thumb_full_path), exist_ok=True)
            
            # Guardar el archivo
            with open(thumb_full_path, 'wb') as f:
                f.write(output.read())
            
            results[name] = thumb_name
            
        return results
    except Exception as e:
        print(f"Error procesando imagen: {e}")
        return None
