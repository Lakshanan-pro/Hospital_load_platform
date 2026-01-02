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
        case "LOW": return "#2e7d32";
        case "MEDIUM": return "#e65100";
        case "HIGH": return "#c62828";
        case "Unknown": return "#757575";
        default: return "#3498db";
      }
    }

    // Function to format crowd level display
    function formatCrowdLevel(crowdLevel, estimatedWait) {
      if (crowdLevel === "Unknown") {
        return '<span style="color: #7f8c8d; font-weight: 600;">Unknown</span>';
      }
      const colorMap = {
        "LOW": "#2e7d32",
        "MEDIUM": "#e65100",
        "HIGH": "#c62828"
      };
      return `<span style="color: ${colorMap[crowdLevel] || '#3498db'}; font-weight: 600;">${crowdLevel}</span>`;
    }

    // Function to format waiting time display
    function formatWaitingTime(estimatedWait) {
      if (estimatedWait === null || estimatedWait === undefined) {
        return '<span style="color: #7f8c8d;">Not Available</span>';
      }
      return `<span style="color: #2c3e50; font-weight: 500;">${estimatedWait} mins</span>`;
    }

    // Get user live location with high accuracy
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        // User marker with custom icon
        const userIcon = L.divIcon({
          className: "user-marker",
          html: '<div style="background-color: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #3498db;"></div>',
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
            <div style="min-width: 220px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <b style="font-size: 1.15em; color: #2c3e50;">${h.name}</b><br/>
              <hr style="margin: 10px 0; border: none; border-top: 2px solid #e8eef3;">
              <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Distance:</strong> ${distance.toFixed(2)} km</div>
              <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Time to Reach:</strong> ~${timeToReach} mins</div>
              <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Location:</strong> ${h.address || 'Address not available'}</div>
              <hr style="margin: 10px 0; border: none; border-top: 2px solid #e8eef3;">
              <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Crowd Level:</strong> ${formatCrowdLevel(h.crowd_level, h.estimated_wait)}</div>
              <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Estimated Waiting:</strong> ${formatWaitingTime(h.estimated_wait)}</div>
          `;

          // Only show departments and "View Details" links if hospital has DB ID (matched in database)
          if (h.id) {
            // Show departments if available
            if (h.departments && Array.isArray(h.departments) && h.departments.length > 0) {
              popupContent += `
                <hr style="margin: 10px 0; border: none; border-top: 2px solid #e8eef3;">
                <div style="margin: 8px 0; color: #2c3e50;"><strong style="color: #3498db;">Departments:</strong></div>
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
                  <div style="margin: 8px 0; background: #fafbfc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e8eef3;">
                    <a href="hospital.html?id=${h.id}&department=${encodedDeptName}" 
                       style="color: #3498db; text-decoration: none; display: block;">
                      <strong style="color: #2c3e50;">${deptName}</strong><br>
                      <small style="color: #7f8c8d;">
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
              <hr style="margin: 10px 0; border: none; border-top: 2px solid #e8eef3;">
              <a href="hospital.html?id=${h.id}" style="color: #3498db; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 6px;">View All Details →</a>
            `;
          } else {
            popupContent += `
              <div style="margin-top: 10px; font-size: 0.85em; color: #7f8c8d; font-style: italic; background: #f8f9fa; padding: 8px; border-radius: 6px;">
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
