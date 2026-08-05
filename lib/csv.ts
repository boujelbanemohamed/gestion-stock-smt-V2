// Découpe une ligne CSV en respectant les champs entre guillemets : un
// délimiteur à l'intérieur d'un champ ("Rue X; Bloc B") ne doit pas couper
// la ligne en deux, contrairement à un simple line.split(delimiter). Les
// guillemets doublés ("") à l'intérieur d'un champ entre guillemets sont
// interprétés comme un guillemet littéral, convention CSV standard.
export function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      values.push(current)
      current = ""
    } else {
      current += char
    }
  }
  values.push(current)

  return values
}
