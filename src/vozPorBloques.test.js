import { dividirEnBloques } from './vozPorBloques';

const frase = 'Esta es una frase de prueba para la voz de GaIA. ';

test('un texto corto es un solo bloque', () => {
  expect(dividirEnBloques('Hola. ¿Qué tal estás?')).toEqual(['Hola. ¿Qué tal estás?']);
});

test('texto vacío no genera bloques', () => {
  expect(dividirEnBloques('')).toEqual([]);
  expect(dividirEnBloques(null)).toEqual([]);
  expect(dividirEnBloques('   \n ')).toEqual([]);
});

test('el primer bloque es corto y los demás respetan el máximo, siempre en frase completa', () => {
  const bloques = dividirEnBloques(frase.repeat(100));            // ~4900 caracteres
  expect(bloques.length).toBeGreaterThan(3);
  expect(bloques[0].length).toBeLessThanOrEqual(500);
  bloques.forEach(b => {
    expect(b.length).toBeLessThanOrEqual(1200);
    expect(b.endsWith('.')).toBe(true);
  });
});

test('no se pierde ni se inventa texto', () => {
  const texto = frase.repeat(100).trim();
  const unido = dividirEnBloques(texto).join(' ');
  expect(unido.replace(/\s+/g, ' ')).toBe(texto.replace(/\s+/g, ' '));
});

test('una frase sin puntuación más larga que el máximo se parte por palabras', () => {
  const largo = 'palabra '.repeat(400).trim();                      // 3199 caracteres sin un punto
  const bloques = dividirEnBloques(largo);
  expect(bloques.length).toBeGreaterThanOrEqual(3);
  bloques.forEach(b => expect(b.length).toBeLessThanOrEqual(1200));
  expect(bloques.join(' ').split(/\s+/).length).toBe(400);
});

test('conserva los párrafos como parte del texto de los bloques', () => {
  const bloques = dividirEnBloques('Primer párrafo.\n\nSegundo párrafo.');
  expect(bloques.join(' ')).toContain('Segundo párrafo.');
});
