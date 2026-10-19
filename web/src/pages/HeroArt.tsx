/** Decorative illustration for the Home hero. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg className={className} width="250" height="170" viewBox="0 0 250 170" fill="none" aria-hidden="true">
      <circle cx="170" cy="70" r="62" fill="#E3EBFA" />
      <rect x="52" y="30" width="150" height="98" rx="10" fill="#1B4CA1" />
      <rect x="60" y="38" width="134" height="82" rx="5" fill="#FFFFFF" />
      <rect x="70" y="50" width="36" height="5" rx="2.5" fill="#C9D6EE" />
      <rect x="70" y="60" width="26" height="5" rx="2.5" fill="#C9D6EE" />
      <rect x="70" y="74" width="40" height="34" rx="4" fill="#E8EEF9" />
      <rect x="126" y="86" width="10" height="22" rx="2" fill="#4F7BD1" />
      <rect x="141" y="74" width="10" height="34" rx="2" fill="#4F7BD1" />
      <rect x="156" y="80" width="10" height="28" rx="2" fill="#4F7BD1" />
      <path d="M38 128h178l-10 12H48z" fill="#C9D6EE" />
      <rect x="182" y="96" width="44" height="44" rx="10" fill="#FFFFFF" stroke="#E3EBFA" />
      <circle cx="204" cy="118" r="10" stroke="#1B4CA1" strokeWidth="4" />
      <circle cx="204" cy="118" r="3" fill="#1B4CA1" />
      <rect x="168" y="44" width="20" height="26" rx="4" fill="#EF951E" />
    </svg>
  );
}
