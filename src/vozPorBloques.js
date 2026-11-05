// ── Voz por bloques ──────────────────────────────────────────────────────────
// Una respuesta larga se lee en bloques de frases completas que se piden a /tts uno a
// uno (el backend tarda ~7 ms por carácter; todo de golpe pasaba el límite de 30 s del
// servidor). El primero es corto para que la voz empiece enseguida.
const BLOQUE_PRIMERO = 500;
const BLOQUE_MAX     = 1200;

export const dividirEnBloques = (texto, primero = BLOQUE_PRIMERO, max = BLOQUE_MAX) => {
  const frases = (texto || '').replace(/\r/g, '').match(/[^.!?…\n]+[.!?…]*[\s]*|\n+/g) || [];
  const bloques = [];
  let actual = '';
  const cerrar = () => { if (actual.trim()) bloques.push(actual.trim()); actual = ''; };
  for (let frase of frases) {
    // una "frase" sin puntuación más larga que el límite se parte por palabras
    while (frase.length > max) {
      let corte = frase.lastIndexOf(' ', max);
      if (corte < max * 0.4) corte = max;
      if ((actual + frase.slice(0, corte)).length > (bloques.length === 0 ? primero : max)) cerrar();
      actual += frase.slice(0, corte);
      cerrar();
      frase = frase.slice(corte);
    }
    const limite = bloques.length === 0 ? primero : max;
    if (actual && (actual + frase).length > limite) cerrar();
    actual += frase;
  }
  cerrar();
  return bloques;
};
