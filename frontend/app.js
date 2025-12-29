// Only run map logic on map.html
if (document.getElementById("map")) {
  // Wait for DOM to be fully loaded
  document.addEventListener("DOMContentLoaded", () => {
    // Initialize map with default view (will be updated with user location)
    const map = L.map("map").setView([13.0827, 80.2707], 13);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    // Function to calculate travel time (distance / speed)
    function calculateTime(distanceKm, avgSpeedKmH = 30) {
      return Math.round((distanceKm / avgSpeedKmH) * 60); // minutes
    }

    // Function to calculate distance between two coordinates (Haversine formula)
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in km
    }

    // Function to get marker color based on crowd level
    function getColor(crowdLevel) {
      switch (crowdLevel) {
        case "LOW": return "green";
        case "MEDIUM": return "orange";
        case "HIGH": return "red";
        case "Unknown": return "gray";
        default: return "blue";
      }
    }

    // Function to format crowd level display
    function formatCrowdLevel(crowdLevel, estimatedWait) {
      if (crowdLevel === "Unknown") {
        return '<span style="color: #666; font-weight: bold;">Unknown</span>';
      }
      return `<span style="color: ${getColor(crowdLevel)}; font-weight: bold;">${crowdLevel}</span>`;
    }

    // Function to format waiting time display
    function formatWaitingTime(estimatedWait) {
      if (estimatedWait === null || estimatedWait === undefined) {
        return '<span style="color: #666;">Not Available</span>';
      }
      return `${estimatedWait} mins`;
    }

    // Get user live location with high accuracy
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        // User marker with custom icon
        const userIcon = L.divIcon({
          className: "user-marker",
          html: '<div style="background-color: #007bff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #007bff;"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker([userLat, userLng], { icon: userIcon })
          .addTo(map)
          .bindPopup("You are here")
          .openPopup();

        // Center map on user location with appropriate zoom
        map.setView([userLat, userLng], 14);

        // Fetch nearby hospitals from backend
        let hospitals = [];
        try {
          const res = await fetch(
            `http://localhost:5000/api/hospitals/nearby?lat=${userLat}&lng=${userLng}`
          );
          if (res.ok) {
            hospitals = await res.json();
            // Show ALL hospitals (no filtering - DB data is optional enrichment)
          } else {
            throw new Error("Backend error");
          }
        } catch (err) {
          console.error("Error fetching hospitals from backend:", err);
          const loadingOverlay = document.getElementById('loading');
          if (loadingOverlay) {
            loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="color: #dc3545; font-size: 1.5em; margin-bottom: 10px;">⚠️</div><div>Unable to fetch hospital data.</div><div style="font-size: 0.9em; color: #666; margin-top: 10px;">Please check if the backend server is running.</div></div>';
          } else {
            alert("Unable to fetch hospital data from server. Please check if the backend is running.");
          }
          return;
        }

        // Hide loading overlay
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay) {
          loadingOverlay.classList.add('hidden');
        }

        // Show hospitals on map (ALL hospitals, with or without DB data)
        hospitals.forEach((h) => {
          const distance = calculateDistance(userLat, userLng, h.lat, h.lng);
          const timeToReach = calculateTime(distance);

          // Marker color by crowd level (gray for Unknown)
          const marker = L.circleMarker([h.lat, h.lng], {
            radius: 10,
            color: getColor(h.crowd_level),
            fillColor: getColor(h.crowd_level),
            fillOpacity: 0.7,
            weight: 2,
          }).addTo(map);

          // Build popup content
          let popupContent = `
            <div style="min-width: 200px;">
              <b style="font-size: 1.1em;">${h.name}</b><br/>
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
              <div style="margin: 5px 0;"><strong>Distance:</strong> ${distance.toFixed(2)} km</div>
              <div style="margin: 5px 0;"><strong>Time to Reach:</strong> ~${timeToReach} mins</div>
              <div style="margin: 5px 0;"><strong>Location:</strong> ${h.address || 'Address not available'}</div>
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
              <div style="margin: 5px 0;"><strong>Crowd Level:</strong> ${formatCrowdLevel(h.crowd_level, h.estimated_wait)}</div>
              <div style="margin: 5px 0;"><strong>Estimated Waiting:</strong> ${formatWaitingTime(h.estimated_wait)}</div>
          `;

          // Only show departments and "View Details" links if hospital has DB ID (matched in database)
          if (h.id) {
            // Show departments if available
            if (h.departments && Array.isArray(h.departments) && h.departments.length > 0) {
              popupContent += `
                <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
                <div style="margin: 5px 0;"><strong>Departments:</strong></div>
              `;
              
              // Group departments by name (get latest entry for each department)
              const deptMap = new Map();
              h.departments.forEach(dept => {
                const deptName = dept.department || dept.name || 'General';
                if (!deptMap.has(deptName) || 
                    (dept.updated_at && new Date(dept.updated_at) > new Date(deptMap.get(deptName).updated_at || 0))) {
                  deptMap.set(deptName, dept);
                }
              });
              
              // Show each department as a clickable link
              deptMap.forEach((dept, deptName) => {
                const deptCrowdLevel = dept.crowd_level || 'Unknown';
                const deptWait = dept.estimated_wait !== null && dept.estimated_wait !== undefined ? dept.estimated_wait : null;
                const encodedDeptName = encodeURIComponent(deptName);
                popupContent += `
                  <div style="margin: 5px 0;">
                    <a href="hospital.html?id=${h.id}&department=${encodedDeptName}" 
                       style="color: #007bff; text-decoration: none; display: block; padding: 3px 0; border-bottom: 1px solid #eee;">
                      <strong>${deptName}</strong><br>
                      <small style="color: #666;">
                        ${formatCrowdLevel(deptCrowdLevel, deptWait)} • 
                        ${formatWaitingTime(deptWait)}
                      </small>
                    </a>
                  </div>
                `;
              });
            }
            
            // Add general "View Details" link (without department filter)
            popupContent += `
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;">
              <a href="hospital.html?id=${h.id}" style="color: #007bff; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 5px;">View All Details →</a>
            `;
          } else {
            popupContent += `
              <div style="margin-top: 8px; font-size: 0.85em; color: #666; font-style: italic;">
                No detailed information available
              </div>
            `;
          }

          popupContent += `</div>`;

          marker.bindPopup(popupContent);
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay) {
          loadingOverlay.innerHTML = '<div style="text-align: center;"><div style="color: #dc3545; font-size: 1.5em; margin-bottom: 10px;">⚠️</div><div>Unable to fetch your location.</div><div style="font-size: 0.9em; color: #666; margin-top: 10px;">Please allow location access in your browser settings and refresh the page.</div></div>';
        } else {
          alert("Unable to fetch your location. Please allow location access in your browser settings!");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}
