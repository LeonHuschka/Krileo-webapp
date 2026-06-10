/**
 * Geography registry for lead generation scope.
 *
 * The user picks one of two kinds of scope:
 *   - a Bundesland  → expands to all its >50k cities (broad coverage)
 *   - a single city → just that city (focused)
 * plus a free-text field for any specific smaller town (e.g. Nürtingen).
 *
 * Google Maps is point-based, so "scrape a Bundesland" = scrape each of
 * its cities and aggregate. Saturation tracking (on the campaigns table)
 * then makes sure we don't re-scrape an exhausted city×niche into
 * duplicates.
 *
 * City list = German cities ≳50,000 inhabitants, grouped by Bundesland.
 * Not exhaustive to the last borderline town — the custom field covers
 * the long tail.
 */

const CITIES_BY_BUNDESLAND: Record<string, string[]> = {
  "Baden-Württemberg": [
    "Stuttgart", "Mannheim", "Karlsruhe", "Freiburg im Breisgau", "Heidelberg",
    "Heilbronn", "Ulm", "Pforzheim", "Reutlingen", "Esslingen am Neckar",
    "Ludwigsburg", "Tübingen", "Villingen-Schwenningen", "Konstanz", "Aalen",
    "Sindelfingen", "Schwäbisch Gmünd", "Friedrichshafen", "Offenburg",
    "Göppingen", "Waiblingen", "Ravensburg", "Lörrach", "Böblingen", "Rastatt",
  ],
  "Bayern": [
    "München", "Nürnberg", "Augsburg", "Regensburg", "Ingolstadt", "Würzburg",
    "Fürth", "Erlangen", "Bamberg", "Bayreuth", "Landshut", "Aschaffenburg",
    "Kempten", "Rosenheim", "Neu-Ulm", "Schweinfurt", "Passau", "Hof",
    "Memmingen", "Coburg",
  ],
  "Berlin": ["Berlin"],
  "Brandenburg": [
    "Potsdam", "Cottbus", "Brandenburg an der Havel", "Frankfurt (Oder)",
  ],
  "Bremen": ["Bremen", "Bremerhaven"],
  "Hamburg": ["Hamburg"],
  "Hessen": [
    "Frankfurt am Main", "Wiesbaden", "Kassel", "Darmstadt", "Offenbach am Main",
    "Hanau", "Gießen", "Marburg", "Fulda", "Rüsselsheim", "Wetzlar",
    "Bad Homburg",
  ],
  "Mecklenburg-Vorpommern": [
    "Rostock", "Schwerin", "Neubrandenburg", "Stralsund", "Greifswald",
  ],
  "Niedersachsen": [
    "Hannover", "Braunschweig", "Oldenburg", "Osnabrück", "Wolfsburg",
    "Göttingen", "Salzgitter", "Hildesheim", "Delmenhorst", "Wilhelmshaven",
    "Lüneburg", "Celle", "Hameln",
  ],
  "Nordrhein-Westfalen": [
    "Köln", "Düsseldorf", "Dortmund", "Essen", "Duisburg", "Bochum", "Wuppertal",
    "Bielefeld", "Bonn", "Münster", "Mönchengladbach", "Gelsenkirchen", "Aachen",
    "Krefeld", "Oberhausen", "Hagen", "Hamm", "Mülheim an der Ruhr", "Leverkusen",
    "Solingen", "Herne", "Neuss", "Paderborn", "Bottrop", "Recklinghausen",
    "Bergisch Gladbach", "Remscheid", "Moers", "Siegen", "Witten", "Gütersloh",
    "Iserlohn", "Düren", "Ratingen", "Lünen", "Marl", "Velbert", "Minden",
    "Dorsten", "Detmold", "Castrop-Rauxel", "Gladbeck", "Arnsberg", "Herford",
    "Bocholt",
  ],
  "Rheinland-Pfalz": [
    "Mainz", "Ludwigshafen am Rhein", "Koblenz", "Trier", "Kaiserslautern",
    "Worms", "Neuwied", "Neustadt an der Weinstraße", "Speyer", "Frankenthal",
    "Bad Kreuznach", "Pirmasens",
  ],
  "Saarland": ["Saarbrücken", "Neunkirchen", "Homburg", "Völklingen"],
  "Sachsen": [
    "Leipzig", "Dresden", "Chemnitz", "Zwickau", "Plauen", "Görlitz",
  ],
  "Sachsen-Anhalt": [
    "Halle (Saale)", "Magdeburg", "Dessau-Roßlau", "Halberstadt",
    "Lutherstadt Wittenberg", "Stendal",
  ],
  "Schleswig-Holstein": [
    "Kiel", "Lübeck", "Flensburg", "Neumünster", "Norderstedt", "Elmshorn",
    "Pinneberg",
  ],
  "Thüringen": [
    "Erfurt", "Jena", "Gera", "Weimar", "Gotha", "Nordhausen", "Eisenach",
  ],
};

export type CityEntry = { name: string; bundesland: string };

export const BUNDESLAENDER: string[] = Object.keys(CITIES_BY_BUNDESLAND).sort();

export const GERMAN_CITIES_50K: CityEntry[] = Object.entries(
  CITIES_BY_BUNDESLAND,
)
  .flatMap(([bundesland, cities]) =>
    cities.map((name) => ({ name, bundesland })),
  )
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

export function citiesInBundesland(bundesland: string): string[] {
  return CITIES_BY_BUNDESLAND[bundesland] ?? [];
}

/**
 * Expand a scope selection into a flat, de-duplicated list of city
 * names to scrape. Bundesländer expand to their cities; explicit cities
 * (incl. free-text custom towns) are added as-is.
 */
export function expandScope(opts: {
  bundeslaender?: string[];
  cities?: string[];
}): string[] {
  const set = new Set<string>();
  for (const bl of opts.bundeslaender ?? []) {
    for (const c of CITIES_BY_BUNDESLAND[bl] ?? []) set.add(c);
  }
  for (const c of opts.cities ?? []) {
    const t = c.trim();
    if (t) set.add(t);
  }
  return Array.from(set);
}
