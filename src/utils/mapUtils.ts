
/**
 * Reverse geocodes coordinates to a descriptive place name using OpenStreetMap Nominatim.
 * Prioritizes buildings, amenities, and specific points of interest.
 */
export async function getMapLocationName(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();

    if (data && data.display_name) {
      const parts = data.display_name.split(',');
      const mostSpecific = parts[0].trim();

      // If the most specific name is just the city or a generic campus name, try to find something better
      const genericNames = ['vellore institute', 'vit university', 'vit', 'vellore', 'tamil nadu'];
      const isGeneric = genericNames.some(gen => mostSpecific.toLowerCase().includes(gen));

      if (!isGeneric) {
        return mostSpecific;
      }

      // If the first part was generic, check address fields for specific blocks or buildings
      if (data.address) {
        const specificName = data.address.amenity || 
                           data.address.building || 
                           data.address.shop || 
                           data.address.office || 
                           data.address.tourism ||
                           data.address.historic ||
                           data.address.leisure ||
                           data.address.attraction ||
                           data.address.pedestrian;
        
        if (specificName) return specificName;
      }

      // Final fallback to the first part even if it seems a bit generic
      return mostSpecific;
    }
    return 'On campus';
  } catch (error) {
    console.error("Reverse geocoding failed", error);
    return 'On campus';
  }
}
