from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse

class Category(models.Model):
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, help_text="Emoji o clase de icono")
    description = models.TextField(blank=True, help_text="Descripción de la categoría")
    keywords = models.TextField(blank=True, help_text="Palabras clave para el buscador (ej: celular, movil, cable)")
    order = models.PositiveIntegerField(default=100, help_text="Orden de visualización (menor número primero)")
    image = models.ImageField(upload_to='categories/', null=True, blank=True)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse("category_detail", kwargs={"slug": self.slug})

class Subcategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="subcategories")
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, help_text="Emoji o clase de icono")
    description = models.TextField(blank=True, help_text="Descripción de la subcategoría")
    keywords = models.TextField(blank=True, help_text="Palabras clave para el buscador")
    order = models.PositiveIntegerField(default=100, help_text="Orden de visualización")
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Subcategories"
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.category.name} - {self.name}"

class Listing(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='listings')
    subcategory = models.ForeignKey(Subcategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='listings')
    location = models.CharField(max_length=100, default='Nicaragua')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    image = models.ImageField(upload_to='listings/', null=True, blank=True)
    payment_methods = models.CharField(max_length=200, default='Efectivo')
    is_active = models.BooleanField(default=True, help_text="¿Está el anuncio visible al público?")
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    favorites = models.ManyToManyField(User, related_name='favorite_listings', blank=True)

    def get_absolute_url(self):
        return reverse('listing_detail', kwargs={'listing_id': self.pk})

    def __str__(self):
        return self.title

class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name='conversations')
    listing = models.ForeignKey(Listing, on_delete=models.SET_NULL, null=True, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat sobre {self.listing.title if self.listing else 'Consulta'}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_sent')
    text = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Mensaje de {self.sender.username}"
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    cover_image = models.ImageField(upload_to='covers/', null=True, blank=True)
    followers = models.ManyToManyField(User, related_name='following', blank=True)
    location = models.CharField(max_length=100, default='Nicaragua', blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    reviews_count = models.PositiveIntegerField(default=1) # Empezar con 1 para usuarios nuevos premium
    
    # Sistema de Verificación Biométrico
    verification_photo = models.ImageField(upload_to='verification_docs/', blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"Perfil de {self.user.username}"

# Señales para crear el perfil automáticamente
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()

class Review(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    rating = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review de {self.user.username} en {self.listing.title}"

class Story(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    image = models.ImageField(upload_to='stories/')
    audio_url = models.URLField(blank=True)
    audio_start = models.FloatField(default=0)
    audio_name = models.CharField(max_length=120, blank=True)
    metadata = models.TextField(blank=True, null=True) # Para JSON de stickers
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Historia de {self.user.username} @ {self.created_at}"

    @property
    def is_expired(self):
        from django.utils import timezone
        import datetime
        return self.created_at < timezone.now() - datetime.timedelta(hours=24)

class ProfileReview(models.Model):
    profile_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='given_reviews')
    rating = models.IntegerField(default=5)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('profile_user', 'reviewer')

    def __str__(self):
        return f"{self.reviewer.username} calificó a {self.profile_user.username} con {self.rating}★"
class BugReport(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField()
    screenshot = models.ImageField(upload_to='bugs/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Fallo reportado el {self.created_at.strftime('%d/%m/%Y')}"
class MarketingConsent(models.Model):
    CONSENT_TYPES = [
        ('notifications', 'Notificaciones'),
        ('marketing', 'Publicidad y Ofertas'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    email = models.EmailField(max_length=255, null=True, blank=True)
    allows_notifications = models.BooleanField(default=False)
    allows_marketing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Consentimiento de Marketing"
        verbose_name_plural = "Consentimientos de Marketing"

    def __str__(self):
        return f"{self.email or 'Usuario ' + str(self.user.id)} - {self.created_at.strftime('%d/%m/%Y')}"
