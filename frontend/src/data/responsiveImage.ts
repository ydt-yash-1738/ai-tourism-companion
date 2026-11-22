// Landing photos come in two widths: the original and a 960px copy
// (name-960.webp). Phones load the small one; wide screens the original.

/** srcSet for a landing photo path like "/images/heritage/agra.webp". */
export function landingSrcSet(path: string): string {
  const base = `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
  return `${base.replace(/\.webp$/, '-960.webp')} 960w, ${base} 1920w`;
}
