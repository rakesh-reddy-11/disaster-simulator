// app.js - Orchestrator and UI Controller for Disaster Response Simulator (Leaflet Version)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Simulation on the Leaflet map container
    const sim = new Simulation('map');
    
    // Set simulator reference inside agents
    window.AgentSystem.fireAgent.setSimulator(sim);
    window.AgentSystem.medicalAgent.setSimulator(sim);
    window.AgentSystem.policeAgent.setSimulator(sim);

    // Selected incident tracking for Audit Log
    let selectedIncidentId = null;
    
    // Active tab in fleet status
    let activeFleetTab = 'fire';

    // 2. UI References
    const tweetFeed = document.getElementById('tweet-feed');
    const ssaTableBody = document.getElementById('ssa-table-body');
    const terminalLog = document.getElementById('terminal-log');
    const auditLog = document.getElementById('audit-log');
    const fleetList = document.getElementById('fleet-list');
    
    // Control Buttons
    const btnPause = document.getElementById('btn-pause');
    const pauseText = document.getElementById('pause-text');
    const pauseIcon = document.getElementById('pause-icon');
    const btnTriggerTweet = document.getElementById('btn-trigger-tweet');
    const btnTriggerCritical = document.getElementById('btn-trigger-critical');
    
    // Speed Buttons
    const speedButtons = {
        1: document.getElementById('btn-speed-1'),
        2: document.getElementById('btn-speed-2'),
        5: document.getElementById('btn-speed-5'),
        10: document.getElementById('btn-speed-10')
    };

    // Stats Elements
    const statActive = document.getElementById('stat-active');
    const statResolved = document.getElementById('stat-resolved');
    const statTime = document.getElementById('stat-time');
    const statFleet = document.getElementById('stat-fleet');
    
    // Cursor readout
    const mapCursor = document.getElementById('map-cursor');

    // 3. Event Subscriptions & Hooks
    
    // Listen for new/updated incidents in SSA
    window.AgentSystem.ssa.addListener((action, incident) => {
        updateSSATable();
        updateStats();
        
        // If the updated incident is currently selected in auditor, refresh logs
        if (selectedIncidentId === incident.id) {
            renderAuditLog(incident);
        }
    });

    // Listen for messages on agent communication bus
    window.AgentSystem.messageBus.subscribe((msg) => {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        let senderClass = 'sender-triage';
        if (msg.sender === 'Fire Agent') senderClass = 'sender-fire';
        else if (msg.sender === 'Medical Agent') senderClass = 'sender-medical';
        else if (msg.sender === 'Police Agent') senderClass = 'sender-police';
        else if (msg.sender === 'Shared Blackboard') senderClass = 'sender-board';

        line.innerHTML = `
            <span class="terminal-time">[${msg.timestamp}]</span>
            <span class="terminal-sender ${senderClass}">${msg.sender}:</span>
            <span class="terminal-content">${msg.content}</span>
        `;
        
        terminalLog.appendChild(line);
        terminalLog.scrollTop = terminalLog.scrollHeight;

        // Cap messages at 60 entries
        if (terminalLog.children.length > 60) {
            terminalLog.removeChild(terminalLog.firstChild);
        }
    });

    // 4. Controller Functions

    function injectTweet(tweet) {
        // Create HTML card for tweet
        const card = document.createElement('div');
        const catClass = tweet.mockRawData.reportedCategory.toLowerCase();
        card.className = `tweet-card ${catClass}`;
        
        const sevLabel = tweet.mockRawData.reportedSeverity;
        const sevClass = `severity-${sevLabel.toLowerCase()}`;

        card.innerHTML = `
            <div class="tweet-header">
                <span class="tweet-user">${tweet.username}</span>
                <span class="tweet-time">${tweet.timestamp}</span>
            </div>
            <div class="tweet-text">${tweet.text}</div>
            <div class="tweet-analysis">
                <span class="analysis-tag ${sevClass}">${sevLabel} Priority</span>
                <span class="analysis-status">Triage Done</span>
            </div>
        `;

        tweetFeed.insertBefore(card, tweetFeed.firstChild);

        // Cap tweets at 12
        if (tweetFeed.children.length > 12) {
            tweetFeed.removeChild(tweetFeed.lastChild);
        }

        // Send to Triage Agent
        window.AgentSystem.triageAgent.processTweet(tweet);
    }

    function updateSSATable() {
        const incidents = window.AgentSystem.ssa.incidents;
        
        if (incidents.length === 0) {
            ssaTableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7">No active disaster reports. City is currently secure.</td>
                </tr>
            `;
            return;
        }

        // Sort: Non-resolved first, then by priority (Critical > High > Medium > Low), then by recency
        const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const sortedIncidents = [...incidents].sort((a, b) => {
            if (a.status === 'Resolved' && b.status !== 'Resolved') return 1;
            if (a.status !== 'Resolved' && b.status === 'Resolved') return -1;
            
            const aWeight = priorityWeight[a.severity] || 0;
            const bWeight = priorityWeight[b.severity] || 0;
            if (bWeight !== aWeight) return bWeight - aWeight;
            
            return b.timestamp.localeCompare(a.timestamp); // Newer first
        });

        ssaTableBody.innerHTML = '';

        sortedIncidents.forEach(inc => {
            const tr = document.createElement('tr');
            tr.dataset.id = inc.id;
            if (selectedIncidentId === inc.id) {
                tr.className = 'selected';
            }

            // Category badge
            let catBadge = '';
            if (inc.category === 'Fire') catBadge = `<span class="badge badge-fire">FD</span>`;
            else if (inc.category === 'Medical') catBadge = `<span class="badge badge-med">EMS</span>`;
            else if (inc.category === 'Police') catBadge = `<span class="badge badge-pol">PD</span>`;
            else if (inc.category === 'All') catBadge = `<span class="badge badge-critical">All</span>`;
            else catBadge = `<span class="badge badge-multi">Multi</span>`;

            // Active Responders dots
            let respondersHtml = '';
            if (inc.arrivedUnits.fire.length > 0) respondersHtml += `<span class="responder-dot fire">F</span>`;
            if (inc.arrivedUnits.medical.length > 0) respondersHtml += `<span class="responder-dot medical">M</span>`;
            if (inc.arrivedUnits.police.length > 0) respondersHtml += `<span class="responder-dot police">P</span>`;
            if (respondersHtml === '') respondersHtml = '<span style="color:var(--text-muted)">-</span>';

            // Severity DOT
            const sevClass = inc.severity.toLowerCase();

            // Progress bar
            const progressVal = Math.round(inc.progress);
            const progressHtml = `
                <div class="progress-bar-cell">
                    <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px; color:var(--text-secondary)">
                        <span>${progressVal}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${progressVal}%"></div>
                    </div>
                </div>
            `;

            // Status Pill
            const statusClass = inc.status.toLowerCase().replace(' ', '-');

            tr.innerHTML = `
                <td class="incident-id-cell">${inc.id}</td>
                <td>${inc.sector}</td>
                <td>${catBadge} ${inc.category}</td>
                <td><span class="severity-pill ${sevClass}"></span>${inc.severity}</td>
                <td class="responders-col">${respondersHtml}</td>
                <td>${progressHtml}</td>
                <td><span class="status-pill ${statusClass}">${inc.status}</span></td>
            `;

            // Row click selects incident in Log Auditor
            tr.addEventListener('click', () => {
                Array.from(ssaTableBody.children).forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
                
                selectedIncidentId = inc.id;
                renderAuditLog(inc);
                
                // Pan map to incident location
                if (sim.incidentMarkers.has(inc.id)) {
                    const marker = sim.incidentMarkers.get(inc.id);
                    sim.map.panTo(marker.getLatLng());
                }
            });

            ssaTableBody.appendChild(tr);
        });
    }

    function renderAuditLog(incident) {
        if (!incident) {
            auditLog.innerHTML = `<p class="select-hint">Select an incident from the Blackboard to review agent logs.</p>`;
            return;
        }

        let logsHtml = `<div class="audit-incident-title">📋 INCIDENT AUDITOR: ${incident.id}</div>`;
        logsHtml += `<div class="audit-tweet" style="padding: 6px 10px; background:rgba(0,0,0,0.2); border-radius:4px; font-size:11px; color:var(--text-secondary); margin-bottom:8px; border-left:2px solid var(--color-police)">
            <strong>${incident.username}:</strong> "${incident.tweetText}"
        </div>`;

        incident.history.forEach(log => {
            const timeMatch = log.match(/^\[(.*?)\]/);
            const timeStr = timeMatch ? timeMatch[0] : '';
            const textStr = log.replace(timeStr, '').trim();

            logsHtml += `
                <div class="audit-item">
                    <span class="audit-item-time">${timeStr}</span>
                    <span class="audit-item-text">${textStr}</span>
                </div>
            `;
        });

        auditLog.innerHTML = logsHtml;
        auditLog.scrollTop = auditLog.scrollHeight;
    }

    function updateStats() {
        statActive.innerText = sim.stats.activeCount;
        statResolved.innerText = sim.stats.resolvedCount;
        statTime.innerText = `${sim.stats.avgResponseTime}s`;
        
        const activeVehicles = sim.vehicles.filter(v => v.status !== 'idle').length;
        statFleet.innerText = `${activeVehicles}/${sim.vehicles.length}`;
        
        renderFleetMonitor();
    }

    function renderFleetMonitor() {
        const filteredFleet = sim.vehicles.filter(v => v.type === activeFleetTab);
        
        fleetList.innerHTML = '';
        
        filteredFleet.forEach(vehicle => {
            const item = document.createElement('div');
            item.className = 'fleet-item';
            
            const statusClass = `status-${vehicle.status.toLowerCase().replace(' ', '')}`;
            
            // Format coordinates
            const locText = vehicle.status === 'idle' ? 'BASE' : `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}`;
            
            let statusLabel = vehicle.status;
            if (vehicle.status === 'onscene') statusLabel = 'On Scene';
            if (vehicle.status === 'enroute') statusLabel = 'En Route';

            item.innerHTML = `
                <div>
                    <div class="fleet-item-name">${vehicle.name}</div>
                    <div class="fleet-item-loc">${locText}</div>
                </div>
                <div class="fleet-item-status ${statusClass}">${statusLabel}</div>
            `;
            
            // Clicking on fleet item pans map to vehicle
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                sim.map.panTo([vehicle.lat, vehicle.lng]);
            });
            
            fleetList.appendChild(item);
        });
    }

    // 5. Setup Action Listeners
    
    // Fleet Tab Switches
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            activeFleetTab = btn.dataset.tab;
            renderFleetMonitor();
        });
    });

    // Speed buttons
    Object.keys(speedButtons).forEach(speed => {
        speedButtons[speed].addEventListener('click', () => {
            Object.values(speedButtons).forEach(b => b.classList.remove('active'));
            speedButtons[speed].classList.add('active');
            
            sim.simSpeed = parseFloat(speed);
            
            window.AgentSystem.messageBus.publish(
                "Shared Blackboard",
                "All Agents",
                `⚙️ Operational simulation speed adjusted to ${speed}x.`
            );
        });
    });

    // Pause/Play Control
    btnPause.addEventListener('click', () => {
        sim.isPaused = !sim.isPaused;
        
        if (sim.isPaused) {
            pauseText.innerText = 'PLAY';
            btnPause.classList.remove('btn-primary');
            btnPause.classList.add('btn-accent');
            pauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            
            window.AgentSystem.messageBus.publish(
                "Shared Blackboard",
                "All Agents",
                `⏸️ Operations PAUSED. All agents and responders are frozen.`
            );
        } else {
            pauseText.innerText = 'PAUSE';
            btnPause.classList.remove('btn-accent');
            btnPause.classList.add('btn-primary');
            pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            
            window.AgentSystem.messageBus.publish(
                "Shared Blackboard",
                "All Agents",
                `▶️ Operations RESUMED. Responders active.`
            );
        }
    });

    // Generate random tweet manually
    btnTriggerTweet.addEventListener('click', () => {
        const twt = window.MockTwitterFeed.generateRandomTweet();
        injectTweet(twt);
    });

    // Inject preset Critical pileup in central Delhi NCR
    btnTriggerCritical.addEventListener('click', () => {
        const lat = 28.6139;
        const lng = 77.2090;

        const criticalTweet = {
            id: 'twt-critical-' + Math.random().toString(36).substr(2, 5),
            username: '@delhi_emergency_watch',
            text: `⚠️ CRITICAL EMERGENCY: Fuel tanker explosion near Connaught Place, Delhi NCR! Structural collapse, multiple fires, severe traffic gridlock, and active trauma casualties reported!`,
            timestamp: new Date().toLocaleTimeString(),
            mockRawData: {
                detectedSector: 'Delhi NCR',
                x: lat,
                y: lng,
                reportedCategory: 'All',
                reportedSeverity: 'Critical'
            }
        };

        injectTweet(criticalTweet);
    });

    // Cursor positioning display over Leaflet Map
    sim.map.on('mousemove', (e) => {
        mapCursor.innerText = `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
    });

    sim.map.on('mouseout', () => {
        mapCursor.innerText = 'Lat: --, Lng: --';
    });

    // 6. Running loops
    
    // Core Simulation loop at 60 FPS
    function simLoop() {
        sim.tick();
        renderFleetMonitor(); 
        requestAnimationFrame(simLoop);
    }
    requestAnimationFrame(simLoop);

    // Initial tweets stream setup
    setTimeout(() => {
        injectTweet(window.MockTwitterFeed.generateRandomTweet());
    }, 800);

    setTimeout(() => {
        injectTweet(window.MockTwitterFeed.generateRandomTweet());
    }, 2000);

    // Auto tweet stream loop
    let lastTweetTime = Date.now();
    
    setInterval(() => {
        if (sim.isPaused) return;
        
        const now = Date.now();
        const elapsed = now - lastTweetTime;
        const interval = 15000 / Math.sqrt(sim.simSpeed);
        
        if (elapsed >= interval) {
            injectTweet(window.MockTwitterFeed.generateRandomTweet());
            lastTweetTime = now;
        }
    }, 1000);

    // Render initial statistics
    updateStats();
});
