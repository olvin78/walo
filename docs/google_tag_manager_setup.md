# Google Tag Manager en IGUALO

## Archivos modificados
- `config/settings.py`
- `config/context_processors.py`
- `templates/base.html`
- `.env`
- `.env.prod`

## Variable de entorno
Usa:

```env
GOOGLE_TAG_MANAGER_ID=GTM-WNN5WBQL
```

## Qué hace la integración
- Si la variable existe y no está vacía, IGUALO carga el contenedor de GTM en el `<head>` global y el bloque `noscript` justo después de abrir `<body>`.
- Si la variable no existe o está vacía, no se carga nada.
- En `DEBUG=True`, no se inyecta GTM.

## Cómo verificar en navegador
1. Abre `view-source:https://www.igualo.com`.
2. Busca `googletagmanager.com/gtm.js?id=GTM-WNN5WBQL`.
3. Busca también el bloque `ns.html?id=GTM-WNN5WBQL`.
4. Confirma que solo aparece una vez.

## Nota sobre GA4
GA4 no se inserta directamente en código. Se configurará dentro de Google Tag Manager desde el panel de GTM.

## Dominio público
La marca pública y el dominio canónico del proyecto son `https://www.igualo.com`.
