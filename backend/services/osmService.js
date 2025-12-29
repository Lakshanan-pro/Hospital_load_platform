const fetch = require("node-fetch");

async function fetchHospitals(lat, lng) {
  const query = `
    [out:json];
    (
      node["amenity"="hospital"](around:5000,${lat},${lng});
      way["amenity"="hospital"](around:5000,${lat},${lng});
    );
    out center;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });

  const data = await res.json();
  return data.elements;
}

// Get address from coordinates by querying OSM for nearest hospital
async function getAddressFromCoordinates(lat, lng, hospitalName = null) {
  try {
    // First, try to find a hospital node/way at these exact coordinates
    let query = `
      [out:json];
      (
        node["amenity"="hospital"](around:100,${lat},${lng});
        way["amenity"="hospital"](around:100,${lat},${lng});
      );
      out body;
    `;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    const data = await res.json();
    
    if (data.elements && data.elements.length > 0) {
      const hospital = data.elements[0];
      const tags = hospital.tags || {};
      
      // Try to construct address from available tags
      const addrFull = tags["addr:full"];
      if (addrFull) return addrFull;
      
      const parts = [];
      if (tags["addr:street"]) parts.push(tags["addr:street"]);
      if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
      if (tags["addr:city"]) parts.push(tags["addr:city"]);
      if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
      
      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
    
    // Fallback: try reverse geocoding using Nominatim
    try {
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'HospitalLoadPlatform/1.0'
          }
        }
      );
      
      if (nominatimRes.ok) {
        const nominatimData = await nominatimRes.json();
        if (nominatimData.address) {
          const addr = nominatimData.address;
          const parts = [];
          if (addr.road || addr.street) parts.push(addr.house_number ? `${addr.house_number} ${addr.road || addr.street}` : (addr.road || addr.street));
          if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
          if (addr.postcode) parts.push(addr.postcode);
          if (parts.length > 0) return parts.join(", ");
          if (nominatimData.display_name) return nominatimData.display_name;
        }
      }
    } catch (nominatimErr) {
      console.warn("Nominatim reverse geocoding failed:", nominatimErr.message);
    }
    
    return null;
  } catch (err) {
    console.error("Error fetching address from coordinates:", err);
    return null;
  }
}

module.exports = { fetchHospitals, getAddressFromCoordinates };
