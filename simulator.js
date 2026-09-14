// simulator.js - Leaflet Map Integration and Vehicle Routing Engine

class Vehicle {
    constructor(id, name, type, hubLat, hubLng, color, iconText) {
        this.id = id;
        this.name = name;
        this.type = type; // 'fire', 'medical', 'police'
        this.hubLat = hubLat;
        this.hubLng = hubLng;
        this.lat = hubLat;
        this.lng = hubLng;
        this.color = color;
        this.iconText = iconText;
        
        this.status = 'idle'; // idle, enroute, onscene, returning
        this.targetIncidentId = null;
        this.targetLat = null;
        this.targetLng = null;
        
        // Speed in lat/lng degrees per tick
        this.baseSpeed = 0.0003; 
        this.path = [];
        this.pathIndex = 0;
        
        // Leaflet Marker reference
        this.marker = null;
        this.initMarker();
    }

    initMarker() {
        const vehicleIcon = L.divIcon({
            className: 'custom-vehicle-icon',
            html: `<div class="map-vehicle-marker ${this.type}" style="border-color:${this.color}">${this.iconText}</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.marker = L.marker([this.lat, this.lng], { icon: vehicleIcon });
        this.marker.addTo(window.simulatorInstance.map);
        
        // Bind hover tooltip
        this.marker.bindTooltip(`<strong>${this.name}</strong><br>Status: ${this.status}`, { direction: 'top' });
    }

    dispatch(incident) {
        this.status = 'enroute';
        this.targetIncidentId = incident.id;
        this.targetLat = incident.x; // mapped x -> lat
        this.targetLng = incident.y; // mapped y -> lng
        
        // Manhattan Routing along NYC street Grid:
        // Waypoint path goes from current -> corner (targetLat, currentLng) -> target
        this.path = [
            { lat: this.lat, lng: this.lng },
            { lat: this.targetLat, lng: this.lng }, // Corner Turn
            { lat: this.targetLat, lng: this.targetLng }
        ];
        this.pathIndex = 0;
        this.marker.getTooltip().setContent(`<strong>${this.name}</strong><br>Status: En Route<br>Target: ${incident.id}`);
    }

    returnToHub() {
        this.status = 'returning';
        this.targetIncidentId = null;
        this.targetLat = this.hubLat;
        this.targetLng = this.hubLng;
        
        // Manhattan Routing returning to base
        this.path = [
            { lat: this.lat, lng: this.lng },
            { lat: this.hubLat, lng: this.lng }, // Corner Turn
            { lat: this.hubLat, lng: this.hubLng }
        ];
        this.pathIndex = 0;
        this.marker.getTooltip().setContent(`<strong>${this.name}</strong><br>Status: Returning to base`);
    }

    update(simSpeed) {
        if (this.status === 'enroute' || this.status === 'returning') {
            if (this.path.length === 0 || this.pathIndex >= this.path.length) {
                this.arrive();
                return;
            }

            const targetNode = this.path[this.pathIndex];
            const dLat = targetNode.lat - this.lat;
            const dLng = targetNode.lng - this.lng;
            const dist = Math.hypot(dLat, dLng);
            
            const currentSpeed = this.baseSpeed * simSpeed;

            if (dist <= currentSpeed) {
                // Snap to node
                this.lat = targetNode.lat;
                this.lng = targetNode.lng;
                this.pathIndex++;
                
                this.marker.setLatLng([this.lat, this.lng]);
                
                if (this.pathIndex >= this.path.length) {
                    this.arrive();
                }
            } else {
                // Move towards next node
                this.lat += (dLat / dist) * currentSpeed;
                this.lng += (dLng / dist) * currentSpeed;
                this.marker.setLatLng([this.lat, this.lng]);
            }
        }
    }

    arrive() {
        if (this.status === 'enroute') {
            this.status = 'onscene';
            this.lat = this.targetLat;
            this.lng = this.targetLng;
            this.marker.setLatLng([this.lat, this.lng]);
            this.marker.getTooltip().setContent(`<strong>${this.name}</strong><br>Status: On Scene`);
            
            // Notify SSA that this unit arrived
            const incident = window.AgentSystem.ssa.getIncident(this.targetIncidentId);
            if (incident) {
                const arrivedList = [...incident.arrivedUnits[this.type], this.id];
                incident.arrivedUnits[this.type] = arrivedList;
                
                incident.status = 'On-Scene';
                incident.history.push(`[${new Date().toLocaleTimeString()}] ${this.name} arrived at incident.`);
                
                window.AgentSystem.ssa.updateIncident(incident.id, {
                    arrivedUnits: incident.arrivedUnits,
                    status: incident.status,
                    history: incident.history
                });

                // Post announcement
                window.AgentSystem.messageBus.publish(
                    this.name,
                    "All Agents",
                    `📍 Arrived on scene at ${incident.sector}. Commencing emergency operations.`,
                    incident.id
                );
            }
        } else if (this.status === 'returning') {
            this.status = 'idle';
            this.lat = this.hubLat;
            this.lng = this.hubLng;
            this.marker.setLatLng([this.lat, this.lng]);
            this.marker.getTooltip().setContent(`<strong>${this.name}</strong><br>Status: Idle`);
            this.path = [];
            this.pathIndex = 0;
        }
    }
}

class Simulation {
    constructor(mapId) {
        window.simulatorInstance = this;
        
        // Initialize Leaflet Map focused on India with a real basemap so it renders visibly
        this.map = L.map(mapId, {
            center: [22.9, 78.9],
            zoom: 5,
            zoomControl: true,
            attributionControl: false,
            minZoom: 4,
            maxZoom: 13
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            crossOrigin: true
        }).addTo(this.map);

        this.map.setView([22.9, 78.9], 5);
        this.map.invalidateSize();

        // Define Hub Locations across India
        this.hubs = {
            fire: { lat: 28.6139, lng: 77.2090, name: "Delhi Fire Command HQ", color: "#ef5350", symbol: "🚒" },
            medical: { lat: 19.0760, lng: 72.8777, name: "Mumbai Medical Response Center", color: "#26a69a", symbol: "🏥" },
            police: { lat: 13.0827, lng: 80.2707, name: "Chennai Police Control HQ", color: "#42a5f5", symbol: "👮" }
        };

        // Render Hub markers on map
        this.initHubMarkers();

        // Initialize Fleets
        this.vehicles = [];
        this.initFleets();

        // Incident Markers Map
        this.incidentMarkers = new Map();

        this.simSpeed = 1.0;
        this.isPaused = false;
        
        // Statistics
        this.stats = {
            resolvedCount: 0,
            activeCount: 0,
            avgResponseTime: 0,
            totalResponseTime: 0,
            totalResolvedCount: 0,
            responseTimes: []
        };
    }

    initHubMarkers() {
        Object.keys(this.hubs).forEach(key => {
            const h = this.hubs[key];
            const hubIcon = L.divIcon({
                className: 'custom-hub-icon',
                html: `<div class="map-hub-marker ${key}">${h.symbol}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([h.lat, h.lng], { icon: hubIcon });
            marker.addTo(this.map);
            marker.bindPopup(`<strong>${h.name}</strong><br>Primary Dispatch Node`);
        });
    }

    initFleets() {
        // Fire engines (4 units)
        for (let i = 1; i <= 4; i++) {
            this.vehicles.push(new Vehicle(
                `FE-${i}`,
                `Fire Engine ${i}`,
                'fire',
                this.hubs.fire.lat,
                this.hubs.fire.lng,
                '#ef5350',
                `F${i}`
            ));
        }

        // Ambulances (4 units)
        for (let i = 1; i <= 4; i++) {
            this.vehicles.push(new Vehicle(
                `AMB-${i}`,
                `Ambulance ${i}`,
                'medical',
                this.hubs.medical.lat,
                this.hubs.medical.lng,
                '#26a69a',
                `M${i}`
            ));
        }

        // Police cruisers (4 units)
        for (let i = 1; i <= 4; i++) {
            this.vehicles.push(new Vehicle(
                `PD-${i}`,
                `Cruiser ${i}`,
                'police',
                this.hubs.police.lat,
                this.hubs.police.lng,
                '#42a5f5',
                `P${i}`
            ));
        }
    }

    findAvailableVehicle(type) {
        return this.vehicles.find(v => v.type === type && v.status === 'idle');
    }

    dispatchVehicle(vehicleId, incident) {
        const vehicle = this.vehicles.find(v => v.id === vehicleId);
        if (vehicle) {
            vehicle.dispatch(incident);
        }
    }

    tick() {
        if (this.isPaused) return;

        // Ticks department agents
        window.AgentSystem.fireAgent.tick();
        window.AgentSystem.medicalAgent.tick();
        window.AgentSystem.policeAgent.tick();

        // Update Vehicles
        this.vehicles.forEach(vehicle => {
            vehicle.update(this.simSpeed);
        });

        // Update active incidents
        const activeIncidents = window.AgentSystem.ssa.incidents.filter(inc => inc.status !== 'Resolved');
        this.stats.activeCount = activeIncidents.length;

        // Synchronize Leaflet Markers for incidents
        this.syncIncidentMarkers();

        activeIncidents.forEach(inc => {
            this.processIncidentResolution(inc);
        });
    }

    syncIncidentMarkers() {
        const incidents = window.AgentSystem.ssa.incidents;
        
        incidents.forEach(inc => {
            if (inc.status === 'Resolved') {
                // If it is resolved and marker exists, remove it
                if (this.incidentMarkers.has(inc.id)) {
                    const marker = this.incidentMarkers.get(inc.id);
                    this.map.removeLayer(marker);
                    this.incidentMarkers.delete(inc.id);
                }
                return;
            }

            // If active and marker doesn't exist, create it
            if (!this.incidentMarkers.has(inc.id)) {
                const catClass = inc.category.toLowerCase();
                const incIcon = L.divIcon({
                    className: 'custom-incident-icon',
                    html: `<div class="map-incident-marker ${catClass}"><div class="incident-ring"></div><div class="incident-dot"></div></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                });

                const marker = L.marker([inc.x, inc.y], { icon: incIcon });
                marker.addTo(this.map);
                marker.bindPopup(`<strong>Incident ${inc.id}</strong><br>Category: ${inc.category}<br>Severity: ${inc.severity}<br>Status: ${inc.status}<br>${inc.tweetText}`);
                
                this.incidentMarkers.set(inc.id, marker);
            } else {
                // Update popup if status changes
                const marker = this.incidentMarkers.get(inc.id);
                marker.getPopup().setContent(`<strong>Incident ${inc.id}</strong><br>Category: ${inc.category}<br>Severity: ${inc.severity}<br>Status: ${inc.status}<br>${inc.tweetText}`);
            }
        });
    }

    processIncidentResolution(incident) {
        const reqs = incident.requirements;
        let allRequiredArrived = true;
        let activeRespondersCount = 0;

        if (reqs.fire) {
            const hasFire = incident.arrivedUnits.fire.length > 0;
            if (!hasFire) allRequiredArrived = false;
            else activeRespondersCount += incident.arrivedUnits.fire.length;
        }
        if (reqs.medical) {
            const hasMed = incident.arrivedUnits.medical.length > 0;
            if (!hasMed) allRequiredArrived = false;
            else activeRespondersCount += incident.arrivedUnits.medical.length;
        }
        if (reqs.police) {
            const hasPolice = incident.arrivedUnits.police.length > 0;
            if (!hasPolice) allRequiredArrived = false;
            else activeRespondersCount += incident.arrivedUnits.police.length;
        }

        // Ticking progress
        if (activeRespondersCount > 0) {
            let progressRate = 0.4 * this.simSpeed;
            
            if (allRequiredArrived) {
                progressRate *= 2.5; // Collaborative fast-track
            } else {
                progressRate *= 0.5; // Stalled response
            }

            incident.progress = Math.min(100, incident.progress + progressRate);
            
            if (incident.progress >= 100) {
                incident.status = 'Resolved';
                incident.history.push(`[${new Date().toLocaleTimeString()}] Incident resolved and closed.`);
                
                window.AgentSystem.ssa.updateIncident(incident.id, {
                    status: incident.status,
                    progress: 100,
                    history: incident.history
                });

                // Post announcement
                window.AgentSystem.messageBus.publish(
                    "Shared Blackboard",
                    "All Agents",
                    `✅ Incident resolved at ${incident.sector}! Releasing units back to station.`,
                    incident.id
                );

                // Command vehicles to return to base
                this.vehicles.forEach(vehicle => {
                    if (vehicle.targetIncidentId === incident.id) {
                        vehicle.returnToHub();
                    }
                });

                // Update Stats
                this.stats.totalResolvedCount++;
                this.stats.resolvedCount = this.stats.totalResolvedCount;
                
                const responseTime = Math.floor(Math.random() * 25) + 15;
                this.stats.responseTimes.push(responseTime);
                this.stats.totalResponseTime += responseTime;
                this.stats.avgResponseTime = Math.round(this.stats.totalResponseTime / this.stats.responseTimes.length);
            }
        }
    }
}

// Bind to window
window.Simulation = Simulation;
