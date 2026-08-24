# CLAUDE.md — GaIA (frontend)

## Qué es este proyecto
Frontend de GaIA, app de compañía espiritual con IA. Consume el backend de `latidodegaiainteriorismo/GaIA`. Co-creada por Adrián (arquitectura técnica y desarrollo completo) y Mónica Martos (contenido/teoría).

## Repos relacionados
- Frontend (este repo): `latidodegaiainteriorismo/GaIA-frontend`
- Backend: `latidodegaiainteriorismo/GaIA` → https://gaia-2py8.onrender.com

## Infraestructura
- Desplegado en Vercel: https://ga-ia-frontend.vercel.app
- Cuenta principal `latidodegaiainteriorismo@gmail.com` cubre GitHub, Render, Vercel, Supabase, ElevenLabs, HuggingFace
- Flujo de despliegue: commit directo a `main` → auto-deploy en Vercel. **No hay entorno de staging** — probar en local con Claude Code antes de hacer push.

## Arquitectura del frontend (avatar / interfaz)
- **Avatar con efectos de luz ambiental**: halo con Web Audio API (analizador de volumen), glow con `conic-gradient`, animación `gaiaSpin`.
- **AudioContext**: se desbloquea con gesto del usuario (requisito de los navegadores para reproducir audio).
- **Reproducción de audio**: replay por mensaje individual, reproducción de texto seleccionado, pausa/reanudación sin perder la posición.

## Cuidado con esto
- Cualquier cambio en la lógica de audio debe respetar el desbloqueo de AudioContext por gesto de usuario — si se rompe, el audio deja de sonar en la mayoría de navegadores (política estándar de autoplay).
- Verificar que las llamadas al backend usan la URL de producción correcta (`gaia-2py8.onrender.com`) o la variable de entorno correspondiente, no una URL de desarrollo olvidada.

## Estilo de trabajo de Adrián
- Prefiere archivos completos reescritos en vez de diffs cuando el cambio es sustancial.
- Confirmó en su momento la versión canónica de `App.jsx` — si hay dudas sobre qué versión de un componente es la vigente, preguntar antes de sobrescribir.
- Antes de cualquier cambio con impacto en producción, avisar explícitamente qué se va a desplegar y confirmar antes de hacer commit/push a `main`.
