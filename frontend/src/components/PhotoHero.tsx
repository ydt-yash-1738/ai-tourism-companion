interface PhotoHeroProps {
  image: string;
  alt?: string;
  objectPosition?: string;
  eyebrow: string;
  title: string;
}

/** Photo banner at the top of a companion tab, with the photo drifting on scroll. */
export function PhotoHero({ image, alt = '', objectPosition = 'center 32%', eyebrow, title }: PhotoHeroProps) {
  return (
    <header className="photo-hero">
      <img src={image} alt={alt} aria-hidden={alt ? undefined : true} style={{ objectPosition }} />
      <div className="photo-hero__scrim" aria-hidden="true" />
      <div className="photo-hero__text">
        <span className="photo-hero__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </header>
  );
}
