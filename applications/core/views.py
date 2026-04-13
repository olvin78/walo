import json
import math
import re
import unicodedata
import requests
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.db.models import Q
from django.contrib import messages
from django.conf import settings
from django.utils import timezone
import datetime
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from .models import Listing, Category, Subcategory, Review, Profile, Conversation, Message, Story, ProfileReview, BugReport, MarketingConsent

def home(request):
    """
    Página de inicio (Landing Page) con secciones informativas, CTA y búsqueda integrada.
    """
    from django.db.models import Q
    query = request.GET.get('q', '')
    search_results = None
    
    if query:
        search_results = Listing.objects.filter(
            Q(title__icontains=query) | 
            Q(description__icontains=query) | 
            Q(category__name__icontains=query) |
            Q(category__keywords__icontains=query) |
            Q(subcategory__name__icontains=query) |
            Q(subcategory__keywords__icontains=query) |
            Q(location__icontains=query)
        ).filter(is_active=True).order_by('-created_at')[:4]

    categories = Category.objects.all()[:6]
    latest_listings = Listing.objects.filter(is_active=True).order_by('-created_at')[:4]
    
    context = {
        'categories': categories,
        'latest_listings': latest_listings,
        'search_results': search_results,
        'query': query,
    }
    return render(request, "core/home.html", context)

def explore(request):
    """
    Página de Exploración (Marketplace) con el buscador, categorías y todos los productos.
    """
    from django.db.models import Q, Count
    query = request.GET.get('q', '')
    category_slug = request.GET.get('category', '')
    subcategory_slug = request.GET.get('subcategory', '')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    location_filter = request.GET.get('location')
    sort = request.GET.get('sort', '-created_at')
    
    # Parámetros de Distancia
    user_lat = request.GET.get('user_lat')
    user_lng = request.GET.get('user_lng')
    radius = request.GET.get('radius') # en KM

    listings = Listing.objects.filter(is_active=True)

    if query:
        synonyms = {
            "movil": ["móvil", "telefono", "teléfono", "celular", "smartphone"],
            "telefono": ["teléfono", "movil", "móvil", "celular", "smartphone"],
            "celular": ["movil", "móvil", "telefono", "teléfono", "smartphone"],
            "comida": ["comidas", "alimentos", "food", "restaurante", "delivery", "desayuno", "almuerzo", "cena", "merienda", "plato", "platos"],
            "comidas": ["comida", "alimentos", "food", "restaurante", "delivery", "desayuno", "almuerzo", "cena", "merienda", "plato", "platos"],
            "plato": ["platos", "comida", "desayuno", "almuerzo", "cena", "merienda"],
            "platos": ["plato", "comida", "desayuno", "almuerzo", "cena", "merienda"],
            "desayuno": ["comida", "plato", "platos", "merienda"],
            "almuerzo": ["comida", "plato", "platos"],
            "cena": ["comida", "plato", "platos"],
            "coche": ["carro", "auto", "vehiculo", "vehículo"],
            "carro": ["coche", "auto", "vehiculo", "vehículo"],
            "auto": ["coche", "carro", "vehiculo", "vehículo"],
            "ropa": ["moda", "camisa", "pantalon", "pantalón"],
        }

        def normalize_token(value: str) -> str:
            value = value.strip().lower()
            return "".join(
                ch for ch in unicodedata.normalize("NFD", value)
                if unicodedata.category(ch) != "Mn"
            )

        def ai_expand_terms(user_query: str) -> list[str]:
            api_key = getattr(settings, "OPENAI_API_KEY", "")
            model = getattr(settings, "OPENAI_MODEL", "gpt-4.1-mini")
            if not api_key:
                return []
            prompt = (
                "Eres un asistente de busqueda para un marketplace en Nicaragua. "
                "Dado un termino de busqueda, devuelve SOLO un JSON array de palabras "
                "relacionadas y sinonimos en español (max 8). No agregues texto extra. "
                f"Termino: {user_query}"
            )
            try:
                response = requests.post(
                    "https://api.openai.com/v1/responses",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "input": prompt,
                        "max_output_tokens": 120,
                        "temperature": 0.2,
                    },
                    timeout=6,
                )
                response.raise_for_status()
                data = response.json()
                text = ""
                for item in data.get("output", []):
                    for content in item.get("content", []):
                        if content.get("type") == "output_text":
                            text += content.get("text", "")
                text = text.strip()
                if not text:
                    return []
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(t) for t in parsed][:8]
                return []
            except Exception:
                return []

        tokens = set()
        cleaned = query.strip().lower()
        if cleaned:
            tokens.add(cleaned)
            tokens.add(normalize_token(cleaned))
            for token in re.split(r"\s+", cleaned):
                if not token:
                    continue
                tokens.add(token)
                tokens.add(normalize_token(token))
                for extra in synonyms.get(token, []):
                    tokens.add(extra)
                    tokens.add(normalize_token(extra))

            for extra in ai_expand_terms(cleaned):
                tokens.add(extra)
                tokens.add(normalize_token(extra))

        search_q = Q()
        for token in tokens:
            search_q |= (
                Q(title__icontains=token)
                | Q(description__icontains=token)
                | Q(category__name__icontains=token)
                | Q(category__keywords__icontains=token)
                | Q(subcategory__name__icontains=token)
                | Q(subcategory__description__icontains=token)
                | Q(subcategory__keywords__icontains=token)
                | Q(location__icontains=token)
            )

        listings = listings.filter(search_q)
    
    current_category = None
    parent_category = None
    current_subcategory = None
    hide_subcategories = False
    subcategories = []

    if subcategory_slug == "all":
        hide_subcategories = True
        subcategory_slug = ""

    if subcategory_slug:
        current_subcategory = get_object_or_404(Subcategory, slug=subcategory_slug)
        current_category = current_subcategory.category
        listings = listings.filter(subcategory=current_subcategory)
        hide_subcategories = True

    if category_slug:
        current_category = get_object_or_404(Category, slug=category_slug)
        listings = listings.filter(category=current_category)

    if current_category:
        subcategories = Subcategory.objects.filter(category=current_category)
        parent_category = current_category

    # Nuevos Filtros Avanzados
    if min_price:
        listings = listings.filter(price__gte=min_price)
    if max_price:
        listings = listings.filter(price__lte=max_price)
    if location_filter:
        listings = listings.filter(location__icontains=location_filter)

    # Filtrado por Distancia (Matemática Haversine)
    if user_lat and user_lng and radius and radius != '0':
        radius = float(radius)
        u_lat = float(user_lat)
        u_lng = float(user_lng)
        
        nearby_ids = []
        for l in listings:
            # Protección extra por si la migración aún no se aplicó
            if hasattr(l, 'latitude') and hasattr(l, 'longitude') and l.latitude and l.longitude:
                # Radio de la Tierra en KM
                R = 6371.0
                phi1, phi2 = math.radians(u_lat), math.radians(float(l.latitude))
                dphi = math.radians(float(l.latitude) - u_lat)
                dlambda = math.radians(float(l.longitude) - u_lng)
                
                a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                dist = R * c
                
                if dist <= radius:
                    nearby_ids.append(l.id)
        
        listings = listings.filter(id__in=nearby_ids)

    # Ordenación
    if sort == 'price_asc':
        listings = listings.order_by('price')
    elif sort == 'price_desc':
        listings = listings.order_by('-price')
    elif sort == 'distance' and user_lat and user_lng:
        # La ordenación por distancia se manejaría mejor con GeoDjango, 
        # pero para esta versión el filtro de radio ya resuelve la necesidad.
        listings = listings.order_by('-created_at')
    else:
        listings = listings.order_by('-created_at')

    # Obtener categorías principales respetando el orden manual definido en el admin
    all_categories = Category.objects.annotate(num_listings=Count('listings')).order_by('order', '-num_listings')
    
    # Límite de cortesía para invitados (4 resultados)
    if not request.user.is_authenticated:
        listings = listings[:4]

    # Manejo de favoritos del usuario
    user_favorites = []
    if request.user.is_authenticated:
        user_favorites = request.user.favorite_listings.values_list('id', flat=True)

    context = {
        'listings': listings,
        'all_categories': all_categories,
        'subcategories': subcategories,
        'parent_category': parent_category,
        'current_subcategory': current_subcategory,
        'hide_subcategories': hide_subcategories,
        'query': query,
        'current_category': current_category,
        'min_price': min_price,
        'max_price': max_price,
        'loc': location_filter,
        'sort': sort,
        'radius': radius,
        'user_favorites': user_favorites,
    }
    return render(request, 'core/explore.html', context)

@login_required
def create_listing(request):
    """
    Vista pro para la creación de anuncios con interfaz premium.
    """
    if request.method == 'POST':
        title = request.POST.get('title')
        description = request.POST.get('description')
        price = request.POST.get('price')
        category_id = request.POST.get('category')
        subcategory_id = request.POST.get('subcategory')
        location = request.POST.get('location', 'Nicaragua')
        image = request.FILES.get('image')
        payment_methods_list = request.POST.getlist('payment_methods')
        payment_methods = ", ".join(payment_methods_list) if payment_methods_list else "Efectivo"
        
        if not all([title, price, category_id]):
            messages.error(request, "Por favor completa todos los campos obligatorios.")
            return redirect('create_listing')

        category = get_object_or_404(Category, id=category_id)
        subcategory = None
        if subcategory_id:
            subcategory = get_object_or_404(Subcategory, id=subcategory_id, category=category)
        
        try:
            listing = Listing.objects.create(
                user=request.user,
                title=title,
                description=description,
                price=price,
                category=category,
                subcategory=subcategory,
                location=location,
                image=image,
                payment_methods=payment_methods
            )
            messages.success(request, "¡Tu anuncio ha sido publicado con éxito!")
            return redirect('listing_detail', listing_id=listing.id)
        except Exception as e:
            messages.error(request, f"Hubo un error al publicar: {str(e)}")
            return redirect('create_listing')
    
    categories = Category.objects.all()
    subcategories = Subcategory.objects.select_related('category').all()
    return render(request, 'core/create_listing.html', {'categories': categories, 'subcategories': subcategories})

@login_required
def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug)
    listings = category.listings.filter(is_active=True).order_by("-created_at")
    context = {"category": category, "listings": listings}
    return render(request, "core/category_detail.html", context)

@login_required
def listing_detail(request, listing_id):
    listing = get_object_or_404(Listing, id=listing_id, is_active=True)
    is_favorite = False
    if request.user.is_authenticated:
        is_favorite = listing.favorites.filter(id=request.user.id).exists()
    
    reviews = listing.reviews.all().order_by('-created_at')
    
    context = {
        "listing": listing,
        "is_favorite": is_favorite,
        "reviews": reviews,
    }
    return render(request, "core/listing_detail.html", context)

@login_required
def favorites_view(request):
    listings = request.user.favorite_listings.filter(is_active=True).order_by('-created_at')
    return render(request, "core/favorites.html", {'listings': listings})

@login_required
def toggle_favorite(request, listing_id):
    listing = get_object_or_404(Listing, id=listing_id)
    if listing.favorites.filter(id=request.user.id).exists():
        listing.favorites.remove(request.user)
        is_favorite = False
    else:
        listing.favorites.add(request.user)
        is_favorite = True
    return JsonResponse({'is_favorite': is_favorite})

@login_required
def inbox_view(request):
    conversations = request.user.conversations.all().order_by('-updated_at')
    
    # Obtener historias activas de las últimas 24h
    time_threshold = timezone.now() - datetime.timedelta(hours=24)
    active_stories = Story.objects.filter(created_at__gte=time_threshold).select_related('user', 'user__profile').order_by('-created_at')

    stories_by_user = []
    user_map = {}
    for story in active_stories:
        if story.user_id not in user_map:
            entry = {'user': story.user, 'stories': []}
            user_map[story.user_id] = entry
            stories_by_user.append(entry)
        user_map[story.user_id]['stories'].append(story)

    stories_payload = []
    for item in stories_by_user:
        user = item['user']
        avatar = user.profile.avatar.url if hasattr(user, 'profile') and user.profile.avatar else f"https://i.pravatar.cc/150?u={user.id}"
        stories_payload.append({
            'user': user,
            'avatar': avatar,
            'script_id': f"stories-{user.id}",
            'stories': [
                {
                    'id': s.id,
                    'img': s.image.url,
                    'audio_url': s.audio_url,
                    'audio_start': s.audio_start,
                    'audio_name': s.audio_name,
                    'metadata': s.metadata,
                    'profile_url': f"/perfil/{user.username}/",
                }
                for s in item['stories']
            ]
        })

    return render(request, "core/inbox.html", {
        'conversations': conversations,
        'stories_by_user': stories_payload
    })

@login_required
def upload_story(request):
    if request.method == 'POST' and request.FILES.get('image'):
        audio_url = request.POST.get('audio_url', '')
        audio_start = request.POST.get('audio_start', '0')
        audio_name = request.POST.get('audio_name', '')
        metadata = request.POST.get('metadata', '')
        try:
            audio_start = float(audio_start)
        except ValueError:
            audio_start = 0
        Story.objects.create(
            user=request.user,
            image=request.FILES.get('image'),
            audio_url=audio_url,
            audio_start=audio_start,
            audio_name=audio_name,
            metadata=metadata
        )
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)


@login_required
def delete_story(request, story_id):
    story = get_object_or_404(Story, id=story_id, user=request.user)
    if request.method == "POST":
        story.delete()
        return JsonResponse({"status": "success"})
    return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)

@login_required
def chat_view(request, conversation_id):
    conversation = get_object_or_404(Conversation, id=conversation_id)
    if request.user not in conversation.participants.all():
        return redirect('home')
    
    if request.method == 'POST':
        text = request.POST.get('text')
        if text:
            Message.objects.create(conversation=conversation, sender=request.user, text=text)
            conversation.save() # Actualiza updated_at
    
    messages = conversation.messages.all()
    other_user = conversation.participants.exclude(id=request.user.id).first()
    return render(request, "core/chat.html", {
        'conversation': conversation, 
        'messages': messages,
        'other_user': other_user
    })

@login_required
def start_conversation(request, listing_id):
    listing = get_object_or_404(Listing, id=listing_id)
    
    # Si el usuario es el dueño, le avisamos con un mensaje
    if listing.user == request.user:
        messages.info(request, "Este es tu propio anuncio. No puedes enviarte mensajes a ti mismo.")
        return redirect('listing_detail', listing_id=listing_id)
    
    # Intentar obtener una conversación existente entre estos dos usuarios para este anuncio
    conversation = Conversation.objects.filter(listing=listing).filter(participants=request.user).filter(participants=listing.user).first()
    
    if not conversation:
        # Crear nueva conversación si no existe
        conversation = Conversation.objects.create(listing=listing)
        conversation.participants.add(request.user, listing.user)
    
    # Redirigir al detalle del chat (chat_view)
    return redirect('chat_detail', conversation_id=conversation.id)

@login_required
def delete_conversation(request, conversation_id):
    conversation = get_object_or_404(Conversation, id=conversation_id)
    if request.user in conversation.participants.all():
        conversation.delete()
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error', 'message': 'No autorizado'}, status=403)

@login_required
def user_profile(request, username):
    profile_user = get_object_or_404(User, username=username)
    Profile.objects.get_or_create(user=profile_user)
    listings = Listing.objects.filter(user=profile_user, is_active=True).order_by('-created_at')
    
    # Rating stats
    reviews = ProfileReview.objects.filter(profile_user=profile_user)
    avg_rating = reviews.aggregate(models.Avg('rating'))['rating__avg'] or 5.0
    reviews_count = reviews.count()
    
    # Check if current user has already rated
    user_rating = 0
    if request.user.is_authenticated:
        ur = reviews.filter(reviewer=request.user).first()
        if ur: user_rating = ur.rating

    context = {
        'profile_user': profile_user,
        'listings': listings,
        'avg_rating': round(avg_rating, 1),
        'reviews_count': reviews_count,
        'user_rating': user_rating
    }
    return render(request, "core/user_profile.html", context)

@login_required
def edit_profile(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    if request.method == 'POST':
        avatar = request.FILES.get('avatar')
        cover_image = request.FILES.get('cover_image')
        location = request.POST.get('location')
        phone = request.POST.get('phone')
        bio = request.POST.get('bio')
        latitude = request.POST.get('latitude')
        longitude = request.POST.get('longitude')
        
        if request.POST.get('remove_avatar') == 'true':
            profile.avatar = None
        elif avatar:
            profile.avatar = avatar
            
        if request.POST.get('remove_cover') == 'true':
            profile.cover_image = None
        elif cover_image:
            profile.cover_image = cover_image
        
        profile.location = location
        profile.phone = phone
        profile.bio = bio
        
        if latitude and longitude:
            try:
                profile.latitude = float(latitude.replace(',', '.'))
                profile.longitude = float(longitude.replace(',', '.'))
            except ValueError:
                pass
            
        profile.save()
        return redirect('user_profile', username=request.user.username)
            
    return render(request, "core/edit_profile.html", {'profile': profile})

@login_required
def toggle_follow(request, username):
    from django.contrib.auth.models import User
    target_user = get_object_or_404(User, username=username)
    profile = target_user.profile
    if request.user == target_user:
        return JsonResponse({'status': 'error', 'message': 'No puedes seguirte a ti mismo'}, status=400)
    if profile.followers.filter(id=request.user.id).exists():
        profile.followers.remove(request.user)
        following = False
    else:
        profile.followers.add(request.user)
        following = True
    return JsonResponse({'status': 'success', 'following': following, 'followers_count': profile.followers.count()})

@login_required
def add_review(request, listing_id):
    if request.method == 'POST':
        listing = get_object_or_404(Listing, id=listing_id)
        Review.objects.create(listing=listing, user=request.user, text=request.POST.get('text'), rating=request.POST.get('rating', 5))
        return redirect('listing_detail', listing_id=listing_id)
    return redirect('home')

@login_required
def make_offer(request, listing_id):
    listing = get_object_or_404(Listing, id=listing_id)
    if request.method == 'POST':
        amount = request.POST.get('amount')
        message_text = request.POST.get('message', '')
        full_message = f"📢 HE HECHO UNA OFERTA: C$ {amount}\n\nNota: {message_text}"
        
        conversation = Conversation.objects.filter(listing=listing, participants=request.user).filter(participants=listing.user).first()
        if not conversation:
            conversation = Conversation.objects.create(listing=listing)
            conversation.participants.add(request.user, listing.user)
        
        Message.objects.create(conversation=conversation, sender=request.user, text=full_message)
        conversation.save() # Actualiza updated_at
        return redirect('inbox')
    return redirect('listing_detail', listing_id=listing_id)

def signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')
    else:
        form = UserCreationForm()
    return render(request, 'registration/signup.html', {'form': form})

@login_required
def rate_profile(request, username):
    if request.method == 'POST':
        profile_user = get_object_or_404(User, username=username)
        rating = request.POST.get('rating')
        comment = request.POST.get('comment', '')
        
        if profile_user == request.user:
            return JsonResponse({'status': 'error', 'message': 'No puedes calificarte a ti mismo'}, status=400)
            
        ProfileReview.objects.update_or_create(
            profile_user=profile_user,
            reviewer=request.user,
            defaults={'rating': int(rating), 'comment': comment}
        )
        
        # Calcular nuevo promedio
        reviews = ProfileReview.objects.filter(profile_user=profile_user)
        avg = reviews.aggregate(models.Avg('rating'))['rating__avg'] or 5
        
        return JsonResponse({
            'status': 'success',
            'average_rating': round(avg, 1),
            'reviews_count': reviews.count()
        })
    return JsonResponse({'status': 'error'}, status=400)

@login_required
def verify_profile(request):
    if request.method == 'POST':
        import base64
        from django.core.files.base import ContentFile
        
        image_data = request.POST.get('image')
        if image_data:
            format, imgstr = image_data.split(';base64,')
            ext = format.split('/')[-1]
            data = ContentFile(base64.b64decode(imgstr), name=f"verify_{request.user.id}.{ext}")
            
            profile = request.user.profile
            profile.verification_photo = data
            profile.save()
            
            return JsonResponse({'status': 'success', 'message': 'Foto de verificación guardada. Pendiente de revisión.'})
    return JsonResponse({'status': 'error'}, status=400)

from django.contrib import messages

def report_bug(request):
    if request.method == "POST":
        description = request.POST.get("description")
        screenshot = request.FILES.get("screenshot")
        
        if description:
            BugReport.objects.create(
                user=request.user if request.user.is_authenticated else None,
                description=description,
                screenshot=screenshot
            )
            messages.success(request, "¡Gracias! Hemos recibido tu reporte. El equipo técnico lo revisará lo antes posible para seguir mejorando Walo.")
            return redirect(request.META.get('HTTP_REFERER', 'home'))
            
    return redirect('home')

def terms_view(request):
    return render(request, 'core/legal/terms.html')

def privacy_view(request):
    return render(request, 'core/legal/privacy.html')

def cookies_view(request):
    return render(request, 'core/legal/cookies.html')

def legal_notice_view(request):
    return render(request, 'core/legal/legal_notice.html')

@csrf_exempt
def save_marketing_consent(request):
    if request.method == 'POST':
        import json
        data = json.loads(request.body)
        
        email = data.get('email')
        allows_notifications = data.get('allows_notifications', False)
        allows_marketing = data.get('allows_marketing', False)
        
        # Si el usuario está logueado, priorizamos su cuenta
        if request.user.is_authenticated:
            MarketingConsent.objects.update_or_create(
                user=request.user,
                defaults={
                    'email': request.user.email,
                    'allows_notifications': allows_notifications,
                    'allows_marketing': allows_marketing
                }
            )
        elif email:
            MarketingConsent.objects.update_or_create(
                email=email,
                defaults={
                    'allows_notifications': allows_notifications,
                    'allows_marketing': allows_marketing
                }
            )
            
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)
