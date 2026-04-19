from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrAdminOrReadOnly(BasePermission):
    message = "No tienes permiso para modificar este recurso."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        owner = getattr(obj, "user", None)
        if owner and owner == request.user:
            return True

        return bool(request.user and request.user.is_staff)
