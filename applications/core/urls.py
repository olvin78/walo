from django.urls import path

from .views import (add_review, category_detail, chat_view, create_listing,
                    delete_conversation, delete_story, edit_profile, explore,
                    favorites_view, home, inbox_view, listing_detail,
                    make_offer, signup, start_conversation, toggle_favorite,
                    toggle_follow, upload_story, user_profile, rate_profile, verify_profile, report_bug)

urlpatterns = [
    path("", home, name="home"),
    path("registro/", signup, name="signup"),
    path("explorar/", explore, name="explore"),
    path("publicar/", create_listing, name="create_listing"),
    path("categoria/<slug:slug>/", category_detail, name="category_detail"),
    path("anuncio/<int:listing_id>/", listing_detail, name="listing_detail"),
    path("anuncio/<int:listing_id>/comentar/", add_review, name="add_review"),
    path("anuncio/<int:listing_id>/oferta/", make_offer, name="make_offer"),
    path("favoritos/", favorites_view, name="favorites"),
    path("favoritos/toggle/<int:listing_id>/", toggle_favorite, name="toggle_favorite"),
    path("mensajes/", inbox_view, name="inbox"),
    path("mensajes/eliminar/<int:conversation_id>/", delete_conversation, name="delete_chat"),
    path("mensajes/<int:conversation_id>/", chat_view, name="chat_detail"),
    path("mensajes/nuevo/<int:listing_id>/", start_conversation, name="start_chat"),
    path("historias/eliminar/<int:story_id>/", delete_story, name="delete_story"),
    path("perfil/<str:username>/", user_profile, name="user_profile"),
    path("perfil/<str:username>/toggle-follow/", toggle_follow, name="toggle_follow"),
    path("configuracion/", edit_profile, name="edit_profile"),
    path("configuracion/verificar/", verify_profile, name="verify_profile"),
    path("perfil/<str:username>/calificar/", rate_profile, name="rate_profile"),
    path("historias/subir/", upload_story, name="upload_story"),
    path("reportar-fallo/", report_bug, name="report_bug"),
]
