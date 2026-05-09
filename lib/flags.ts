// Mapa nombre del equipo -> código ISO 3166-1 alpha-2 (o gb-eng/sct/wls).
// Usado por flagcdn.com para servir el PNG de la bandera.
// Si un equipo no aparece, agrégalo aquí y compila — no hay API ni magia.

const TEAM_TO_ISO: Record<string, string> = {
  // CONMEBOL
  Argentina: "ar",
  Brasil: "br",
  Brazil: "br",
  Uruguay: "uy",
  Colombia: "co",
  Ecuador: "ec",
  Paraguay: "py",
  "Perú": "pe",
  Peru: "pe",
  Chile: "cl",
  Venezuela: "ve",
  Bolivia: "bo",

  // CONCACAF
  "México": "mx",
  Mexico: "mx",
  "Estados Unidos": "us",
  USA: "us",
  "United States": "us",
  "Canadá": "ca",
  Canada: "ca",
  "Costa Rica": "cr",
  Honduras: "hn",
  "Panamá": "pa",
  Panama: "pa",
  Jamaica: "jm",
  "El Salvador": "sv",
  Guatemala: "gt",
  "Haití": "ht",
  Haiti: "ht",
  Curazao: "cw",
  "Curaçao": "cw",
  "Trinidad y Tobago": "tt",

  // UEFA
  "España": "es",
  Spain: "es",
  Francia: "fr",
  France: "fr",
  Alemania: "de",
  Germany: "de",
  Inglaterra: "gb-eng",
  England: "gb-eng",
  Escocia: "gb-sct",
  Scotland: "gb-sct",
  Gales: "gb-wls",
  Wales: "gb-wls",
  Italia: "it",
  Italy: "it",
  "Países Bajos": "nl",
  Holanda: "nl",
  Netherlands: "nl",
  Portugal: "pt",
  "Bélgica": "be",
  Belgium: "be",
  Croacia: "hr",
  Croatia: "hr",
  Suiza: "ch",
  Switzerland: "ch",
  Polonia: "pl",
  Poland: "pl",
  Austria: "at",
  Dinamarca: "dk",
  Denmark: "dk",
  Serbia: "rs",
  Suecia: "se",
  Sweden: "se",
  Noruega: "no",
  Norway: "no",
  Ucrania: "ua",
  Ukraine: "ua",
  "Hungría": "hu",
  Hungary: "hu",
  "Turquía": "tr",
  Turkey: "tr",
  "República Checa": "cz",
  Chequia: "cz",
  "Czech Republic": "cz",
  Eslovaquia: "sk",
  Slovakia: "sk",
  Eslovenia: "si",
  Slovenia: "si",
  Albania: "al",
  "Bosnia y Herzegovina": "ba",
  Grecia: "gr",
  Greece: "gr",
  Rumania: "ro",
  "Rumanía": "ro",
  Romania: "ro",
  Irlanda: "ie",
  Ireland: "ie",
  Finlandia: "fi",
  Finland: "fi",
  Islandia: "is",
  Iceland: "is",

  // AFC
  "Japón": "jp",
  Japan: "jp",
  "Corea del Sur": "kr",
  "South Korea": "kr",
  "Korea Republic": "kr",
  Australia: "au",
  "Irán": "ir",
  Iran: "ir",
  "Arabia Saudita": "sa",
  "Arabia Saudí": "sa",
  "Saudi Arabia": "sa",
  Catar: "qa",
  "Qatar": "qa",
  Iraq: "iq",
  Irak: "iq",
  "Emiratos Árabes Unidos": "ae",
  EAU: "ae",
  "United Arab Emirates": "ae",
  "Uzbekistán": "uz",
  Uzbekistan: "uz",
  Jordania: "jo",
  Jordan: "jo",

  // CAF
  Marruecos: "ma",
  Morocco: "ma",
  Senegal: "sn",
  Egipto: "eg",
  Egypt: "eg",
  Nigeria: "ng",
  "Camerún": "cm",
  Cameroon: "cm",
  Argelia: "dz",
  Algeria: "dz",
  "Túnez": "tn",
  Tunisia: "tn",
  Ghana: "gh",
  "Costa de Marfil": "ci",
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  "Sudáfrica": "za",
  "South Africa": "za",
  Mali: "ml",
  "Malí": "ml",
  "Burkina Faso": "bf",
  "RD Congo": "cd",
  "Cabo Verde": "cv",
  "Cape Verde": "cv",

  // OFC
  "Nueva Zelanda": "nz",
  "New Zealand": "nz",
};

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function teamFlagUrl(team: string, width: 20 | 40 | 80 = 40): string | null {
  const code =
    TEAM_TO_ISO[team] ??
    TEAM_TO_ISO[team.trim()] ??
    TEAM_TO_ISO[normalize(team)];
  if (!code) return null;
  return `https://flagcdn.com/w${width}/${code}.png`;
}

export function teamFlagSrcSet(team: string): string | null {
  const code =
    TEAM_TO_ISO[team] ??
    TEAM_TO_ISO[team.trim()] ??
    TEAM_TO_ISO[normalize(team)];
  if (!code) return null;
  return `https://flagcdn.com/w40/${code}.png 1x, https://flagcdn.com/w80/${code}.png 2x`;
}
