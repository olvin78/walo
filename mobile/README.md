# Igualo Mobile

App Expo separada del backend Django.

## Arranque local

```bash
cd mobile
npx expo start
```

## Backend

- Web Django: `http://127.0.0.1:8000`
- API: `http://127.0.0.1:8000/api/v1/`

## Nota API

La app usa `EXPO_PUBLIC_API_URL`.

Ejemplo local:
`http://192.168.1.72:8000/api/v1`

Si cambias de red, actualiza `mobile/.env` con la IP real de tu PC.
