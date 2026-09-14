// agents.js - Multi-Agent Coordination System for Disaster Simulator

class SharedSituationalAwareness {
    constructor() {
        this.incidents = [];
        this.listeners = [];
    }

    addIncident(incident) {
        this.incidents.push(incident);
        this.notifyListeners('add', incident);
    }

    updateIncident(id, updates) {
        const incident = this.incidents.find(inc => inc.id === id);
        if (incident) {
            Object.assign(incident, updates);
            this.notifyListeners('update', incident);
        }
    }

    getIncident(id) {
        return this.incidents.find(inc => inc.id === id);
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(action, data) {
        this.listeners.forEach(cb => cb(action, data));
    }
}

class AgentMessageBus {
    constructor() {
        this.messages = [];
        this.listeners = [];
    }

    publish(sender, recipient, content, incidentId = null) {
        const msg = {
            id: 'msg-' + Math.random().toString(36).substr(2, 9),
            sender: sender,
            recipient: recipient,
            content: content,
            incidentId: incidentId,
            timestamp: new Date().toLocaleTimeString()
        };
        this.messages.push(msg);
        this.listeners.forEach(cb => cb(msg));
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }
}

// Global instances
const ssa = new SharedSituationalAwareness();
const messageBus = new AgentMessageBus();

class TriageAgent {
    constructor() {
        this.name = "Triage Agent";
    }

    processTweet(tweet) {
        const text = tweet.text.toLowerCase();
        const raw = tweet.mockRawData;
        
        // Simulating NLP extraction of coordinates, sector, severity, and category
        let category = raw.reportedCategory;
        let severity = raw.reportedSeverity;
        let sector = raw.detectedSector;
        let x = raw.x;
        let y = raw.y;

        // Structured requirements based on category
        const requirements = {
            fire: false,
            medical: false,
            police: false
        };

        if (category.includes('Fire')) requirements.fire = true;
        if (category.includes('Medical')) requirements.medical = true;
        if (category.includes('Police')) requirements.police = true;
        if (category === 'All') {
            requirements.fire = true;
            requirements.medical = true;
            requirements.police = true;
        }

        const incident = {
            id: tweet.id,
            tweetText: tweet.text,
            username: tweet.username,
            x: x,
            y: y,
            sector: sector,
            severity: severity,
            category: category,
            requirements: requirements,
            dispatchedUnits: { fire: [], medical: [], police: [] },
            arrivedUnits: { fire: [], medical: [], police: [] },
            status: 'Pending', // Pending, Responding, On-Scene, Resolved
            progress: 0, // 0 to 100
            timestamp: tweet.timestamp,
            history: [`[${new Date().toLocaleTimeString()}] Triage Agent registered incident. Requirements: Fire=${requirements.fire}, Medical=${requirements.medical}, Police=${requirements.police}.`]
        };

        ssa.addIncident(incident);
        
        // Log triage message
        messageBus.publish(
            this.name, 
            "All Agents", 
            `⚠️ Alert! Parsed tweet from ${tweet.username}. Incident in ${sector} at (${x}, ${y}). Category: ${category}, Severity: ${severity}. Registered in Situational Board.`,
            incident.id
        );
    }
}

class DepartmentAgent {
    constructor(name, deptKey, messageBus, ssa) {
        this.name = name;
        this.deptKey = deptKey; // 'fire', 'medical', or 'police'
        this.messageBus = messageBus;
        this.ssa = ssa;
        this.simulator = null; // Set dynamically
    }

    setSimulator(sim) {
        this.simulator = sim;
    }

    tick() {
        if (!this.simulator) return;

        // Scan SSA for incidents requiring this department's action
        const activeIncidents = this.ssa.incidents.filter(inc => 
            inc.requirements[this.deptKey] && inc.status !== 'Resolved'
        );

        activeIncidents.forEach(inc => {
            this.evaluateIncident(inc);
        });
    }

    evaluateIncident(incident) {
        const dispatchedCount = incident.dispatchedUnits[this.deptKey].length;
        
        // Determine required unit count based on severity
        let neededCount = 1;
        if (incident.severity === 'High') neededCount = 2;
        if (incident.severity === 'Critical') neededCount = 3;

        // If we need to dispatch more units
        if (dispatchedCount < neededCount) {
            // Find available vehicle from our fleet
            const vehicle = this.simulator.findAvailableVehicle(this.deptKey);
            if (vehicle) {
                // Dispatch vehicle
                this.simulator.dispatchVehicle(vehicle.id, incident);
                
                // Add to dispatched list
                const updatedDispatched = [...incident.dispatchedUnits[this.deptKey], vehicle.id];
                incident.dispatchedUnits[this.deptKey] = updatedDispatched;
                
                // Update status if it was Pending
                if (incident.status === 'Pending') {
                    incident.status = 'Responding';
                }
                
                incident.history.push(`[${new Date().toLocaleTimeString()}] ${this.name} dispatched unit ${vehicle.name}.`);
                this.ssa.updateIncident(incident.id, {
                    dispatchedUnits: incident.dispatchedUnits,
                    status: incident.status,
                    history: incident.history
                });

                // Post dispatch broadcast
                this.messageBus.publish(
                    this.name,
                    "All Agents",
                    `🚒 Dispatched unit ${vehicle.name} to ${incident.sector} (${incident.x}, ${incident.y}) for incident support.`,
                    incident.id
                );

                // Run collaboration / negotiation logic
                this.triggerCollaboration(incident);
            }
        }
    }

    triggerCollaboration(incident) {
        // Implement agency communication rules based on sector awareness and severity
        
        // Rule 1: Fire Agent requests Police crowd control for High/Critical fire incidents
        if (this.deptKey === 'fire' && (incident.severity === 'High' || incident.severity === 'Critical')) {
            // Check if Police is already aware or dispatched
            if (!incident.requirements.police) {
                this.messageBus.publish(
                    this.name,
                    "Police Agent",
                    `🔥 High intensity fire in progress in ${incident.sector}. Requesting police cruiser to secure a perimeter and handle traffic.`,
                    incident.id
                );
            }
        }

        // Rule 2: Fire Agent requests Medical standby for High/Critical fires
        if (this.deptKey === 'fire' && (incident.severity === 'High' || incident.severity === 'Critical')) {
            if (!incident.requirements.medical) {
                this.messageBus.publish(
                    this.name,
                    "Medical Agent",
                    `⚠️ Thick smoke building up in ${incident.sector}. Requesting Ambulance on standby for potential smoke inhalation casualties.`,
                    incident.id
                );
            }
        }

        // Rule 3: Police Agent requests Medical standby during violent reports (High police incident)
        if (this.deptKey === 'police' && (incident.severity === 'High' || incident.severity === 'Critical')) {
            if (!incident.requirements.medical) {
                const containsViolentKeywords = incident.tweetText.toLowerCase().match(/(shots|gun|robbery|fight|stabbing|assault)/);
                if (containsViolentKeywords) {
                    this.messageBus.publish(
                        this.name,
                        "Medical Agent",
                        `🚔 High threat scene at ${incident.sector}. Requesting medical crew to stand by at the outer safety perimeter.`,
                        incident.id
                    );
                }
            }
        }

        // Rule 4: Medical Agent requests Police escort for high-threat areas or active disputes
        if (this.deptKey === 'medical' && incident.category.includes('Police')) {
            // Medical is responding to a crime scene, request security
            if (!incident.requirements.police) {
                this.messageBus.publish(
                    this.name,
                    "Police Agent",
                    `🚑 Dispatching ambulance to incident scene in ${incident.sector}. Requesting police escort to guarantee responder safety.`,
                    incident.id
                );
            }
        }
    }

    receiveMessage(msg) {
        // Handle direct requests from other agents
        const incident = this.ssa.getIncident(msg.incidentId);
        if (!incident) return;

        // If requested to support, update situational requirements
        if (this.deptKey === 'police' && msg.sender === 'Fire Agent' && msg.content.includes('perimeter')) {
            if (!incident.requirements.police) {
                incident.requirements.police = true;
                incident.history.push(`[${new Date().toLocaleTimeString()}] Police requirement added upon Fire Agent request.`);
                this.ssa.updateIncident(incident.id, { 
                    requirements: incident.requirements,
                    history: incident.history
                });
                this.messageBus.publish(
                    this.name,
                    msg.sender,
                    `👮 Acknowledged Fire request. Adding police detail to incident in ${incident.sector}. Dispatching cruiser immediately.`,
                    incident.id
                );
            }
        }

        if (this.deptKey === 'medical' && msg.content.includes('standby')) {
            if (!incident.requirements.medical) {
                incident.requirements.medical = true;
                incident.history.push(`[${new Date().toLocaleTimeString()}] Medical requirement added upon request from ${msg.sender}.`);
                this.ssa.updateIncident(incident.id, { 
                    requirements: incident.requirements,
                    history: incident.history
                });
                this.messageBus.publish(
                    this.name,
                    msg.sender,
                    `🏥 Copy that. Standby medical ambulance dispatched to staging location in ${incident.sector}.`,
                    incident.id
                );
            }
        }

        if (this.deptKey === 'police' && msg.sender === 'Medical Agent' && msg.content.includes('escort')) {
            if (!incident.requirements.police) {
                incident.requirements.police = true;
                incident.history.push(`[${new Date().toLocaleTimeString()}] Police escort requirement added upon Medical request.`);
                this.ssa.updateIncident(incident.id, { 
                    requirements: incident.requirements,
                    history: incident.history
                });
                this.messageBus.publish(
                    this.name,
                    msg.sender,
                    `👮 Security detail en route to coordinate with ambulance at ${incident.sector}. Escort provided.`,
                    incident.id
                );
            }
        }
    }
}

// Create the agents
const fireAgent = new DepartmentAgent("Fire Agent", "fire", messageBus, ssa);
const medicalAgent = new DepartmentAgent("Medical Agent", "medical", messageBus, ssa);
const policeAgent = new DepartmentAgent("Police Agent", "police", messageBus, ssa);
const triageAgent = new TriageAgent();

// Inter-agent message listening hooks
messageBus.subscribe((msg) => {
    // Deliver messages directed to specific agents
    if (msg.recipient === "Fire Agent" || msg.recipient === "All Agents") {
        fireAgent.receiveMessage(msg);
    }
    if (msg.recipient === "Medical Agent" || msg.recipient === "All Agents") {
        medicalAgent.receiveMessage(msg);
    }
    if (msg.recipient === "Police Agent" || msg.recipient === "All Agents") {
        policeAgent.receiveMessage(msg);
    }
});

// Bind to window for simulator usage
window.AgentSystem = {
    ssa: ssa,
    messageBus: messageBus,
    triageAgent: triageAgent,
    fireAgent: fireAgent,
    medicalAgent: medicalAgent,
    policeAgent: policeAgent
};
