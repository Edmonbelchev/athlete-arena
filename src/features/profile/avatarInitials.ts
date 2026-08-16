/** First two letters shown when no profile photo is set. */
export function getAvatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  return trimmed.slice(0, 2).toUpperCase();
}
