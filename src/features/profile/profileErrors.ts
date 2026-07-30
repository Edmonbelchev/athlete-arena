export function getProfileErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return 'Something went wrong. Please try again.';
  }

  const message = String(error.message);

  if (message.includes('duplicate key') && message.includes('username')) {
    return 'That username is already taken.';
  }

  if (message.includes('profiles_username_format')) {
    return 'Username can only contain lowercase letters, numbers, and underscores.';
  }

  if (message.includes('profiles_username_length')) {
    return 'Username must be at least 3 characters.';
  }

  if (message.includes('Profile stats cannot be modified directly')) {
    return 'Profile stats cannot be edited.';
  }

  if (message.includes('Not enough coins')) {
    return 'You do not have enough coins for this item.';
  }

  if (message.includes('Item not owned')) {
    return 'You need to own this item before equipping it.';
  }

  return message;
}
