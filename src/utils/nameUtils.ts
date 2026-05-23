/**
 * Utility to format email handles into readable names.
 * Example: "abhinav.m2024@vitstudent.ac.in" -> "Abhinav M"
 * Example: "sharangoshreddy" -> "Sharangoshreddy"
 */
export const formatEmailToName = (nameOrEmail: string | undefined | null): string => {
  if (!nameOrEmail) return 'User';
  
  // If it's an email, just take the handle
  const isEmail = nameOrEmail.includes('@');
  const handle = isEmail ? nameOrEmail.split('@')[0] : nameOrEmail;
  
  // Split by dots, underscores, or spaces
  const parts = handle.split(/[._\s]+/);
  
  // Format each part
  const formattedParts = parts.map(part => {
    // Only remove numbers if it looks like a student ID year (e.g. 2024) and it's an email handle
    // If it's a registered name, we should keep what the user typed.
    let textOnly = part.trim();
    if (isEmail) {
      textOnly = textOnly.replace(/\d{4}/g, '').trim(); // Remove 4-digit years only
    }
    
    if (!textOnly) return '';
    
    const first = textOnly.charAt(0).toUpperCase();
    const rest = textOnly.slice(1);
    
    if (rest === rest.toUpperCase() || rest === rest.toLowerCase()) {
      return first + rest.toLowerCase();
    }
    return first + rest;
  }).filter(Boolean);
  
  const result = formattedParts.join(' ');
  return result || 'User';
};
