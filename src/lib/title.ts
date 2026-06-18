// Derive a readable book title from a Drive file name.
// e.g. "154_Betty_Azar_Understanding_and_Using_English_Grammar.pdf"
//      -> "Betty Azar Understanding and Using English Grammar"

export function cleanTitle(fileName: string): string {
  let t = fileName.replace(/\.pdf$/i, "");
  // Strip a leading numeric index and its separators: "154_", "07 - ", "12.".
  t = t.replace(/^\s*\d+\s*[_\-.)\]]+\s*/, "");
  // Underscores and stray separators become spaces.
  t = t.replace(/[_]+/g, " ");
  // Collapse whitespace.
  t = t.replace(/\s+/g, " ").trim();
  // Never return empty — fall back to the name without extension.
  return t || fileName.replace(/\.pdf$/i, "");
}
