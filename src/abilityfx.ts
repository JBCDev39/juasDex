// Efecto de las habilidades en la defensa y qué tan útiles son.
// Tipos: 1 Normal, 2 Lucha, 3 Volador, 4 Veneno, 5 Tierra, 6 Roca, 7 Bicho, 8 Fantasma, 9 Acero,
// 10 Fuego, 11 Agua, 12 Planta, 13 Eléctrico, 14 Psíquico, 15 Hielo, 16 Dragón, 17 Siniestro, 18 Hada

/** habilidad -> { tipo atacante: multiplicador extra } */
export const ABIL_DEF: Record<number, Record<number, number>> = {
  26: { 5: 0 }, // Levitación
  297: { 5: 0 }, // Geofagia
  18: { 10: 0 }, // Absorbe Fuego
  273: { 10: 0 }, // Cuerpo Horneado
  11: { 11: 0 }, // Absorbe Agua
  114: { 11: 0 }, // Colector
  87: { 11: 0, 10: 1.25 }, // Piel Seca
  10: { 13: 0 }, // Absorbe Electricidad
  31: { 13: 0 }, // Pararrayos
  78: { 13: 0 }, // Electromotor
  157: { 12: 0 }, // Herbívoro
  47: { 10: 0.5, 15: 0.5 }, // Sebo
  85: { 10: 0.5 }, // Ignífugo
  199: { 10: 0.5 }, // Pompa
  272: { 8: 0.5 }, // Sal Purificadora
  218: { 10: 2 }, // Peluche (recibe el doble del fuego)
};

/** Qué tan buena es una habilidad en general (0 normal, positivo buena, negativo mala) */
export const ABIL_SCORE: Record<number, number> = {
  37: 6, 74: 6, // Potencia, Energía Pura
  3: 4, 22: 4, 144: 4, 98: 4, 136: 4, 91: 4, 158: 4, 156: 3, 234: 4, 283: 4, 293: 4, 224: 4, 168: 4, 236: 4, 255: 3,
  101: 3, 125: 3, 181: 3, 173: 3, 89: 3, 92: 3, 292: 3, 62: 3, 153: 3, 104: 2, 109: 3, 90: 3, 126: 3, 32: 3,
  2: 3, 70: 3, 45: 2, 117: 2, // climas
  5: 2, 111: 2, 116: 2, 232: 2, 209: 3, 285: 4, 281: 2, 282: 2, 288: 3, 289: 3,
  26: 3, 297: 3, 18: 2, 273: 2, 11: 2, 114: 2, 87: 1, 10: 2, 31: 2, 78: 2, 157: 2, 47: 3, 85: 1, 199: 3, 272: 3,
  33: 1, 34: 1, // dependen del clima
  54: -10, 129: -6, 112: -10, 103: -6, 100: -5, 79: -1, 99: -1, 161: -2, 278: -2,
};

/** Multiplicador final de un ataque contra unos tipos con una habilidad */
export const abilMult = (abil: number | undefined, atk: number, base: number) => {
  const m = abil ? ABIL_DEF[abil]?.[atk] : undefined;
  return m === undefined ? base : base * m;
};
