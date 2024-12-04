// Function to convert strings into PascalCase (Java class naming convention)

export function formatPascalCase(str: string): string {
  return str
    .toLowerCase() // Transforma a string para minúsculas
    .normalize("NFD") // Remove acentos e caracteres especiais
    .replace(/[\u0300-\u036f]/g, "") // Remove marcas diacríticas
    .trim() // Remove espaços extras nas pontas
    .split(/\s+/) // Divide a string em palavras usando espaços como delimitador
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1)) // Transforma cada palavra para PascalCase
    .join(""); // Junta tudo em uma única string
}
// Function to convert strings into kebab-case (separated by hyphens)

export function formatKebabCase(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "-");
}
// Function to convert the first letter to uppercase

export function firstToUppercase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
