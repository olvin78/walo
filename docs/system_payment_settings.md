# Sistema de pago global en IGUALO

## Dónde se gestiona
- Panel de administración de Django
- Modelo: `Sistema de pago`

## Qué controla
- Estrellas automáticas de usuarios Pro
- Botones de `Hacerme Pro`
- Botones de `Publicitar`
- Badge de anuncios destacados

## Estado actual
- El sistema queda `apagado` por defecto para el lanzamiento.
- Cuando está apagado, no se muestran elementos Pro en la web pública.
- Se normalizó el dato antiguo de anuncios destacados para que no queden estrellas heredadas de pruebas previas.

## Cómo activarlo más adelante
1. Entra al admin.
2. Abre `Sistema de pago`.
3. Marca `Sistema de pagos activo`.
4. Guarda.

## Nota
No depende de variables de entorno. Se controla desde la base de datos para poder activarlo o apagarlo desde el admin central.
