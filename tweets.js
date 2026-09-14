// tweets.js - Mock Twitter Feed Generator for Disaster Simulator (India Edition)

const USERNAMES = [
    '@delhi_watch', '@mumbai_now', '@bengaluru_alert', '@hyderabad_signal',
    '@city_safety_India', '@citizen_sam', '@indian_road_watch', '@fire_spotter_1',
    '@medical_radar', '@police_scanner_india', '@urban_safety_in', '@daily_bharat'
];

// Real latitude/longitude bounds for major Indian urban sectors
const SECTORS = {
    'Delhi NCR': { name: 'Delhi NCR', latRange: [28.40, 29.05], lngRange: [76.80, 77.60] },
    'Mumbai': { name: 'Mumbai', latRange: [18.90, 19.30], lngRange: [72.75, 73.10] },
    'Bengaluru': { name: 'Bengaluru', latRange: [12.80, 13.20], lngRange: [77.40, 77.80] },
    'Hyderabad': { name: 'Hyderabad', latRange: [17.20, 17.70], lngRange: [78.20, 78.70] },
    'Chennai': { name: 'Chennai', latRange: [12.80, 13.20], lngRange: [80.10, 80.40] },
    'Kolkata': { name: 'Kolkata', latRange: [22.45, 22.75], lngRange: [88.20, 88.55] },
    'Ahmedabad': { name: 'Ahmedabad', latRange: [22.95, 23.10], lngRange: [72.45, 72.75] },
    'Lucknow': { name: 'Lucknow', latRange: [26.70, 27.10], lngRange: [80.80, 81.10] }
};

const INCIDENT_TEMPLATES = [
    // --- FIRE INCIDENTS ---
    {
        category: 'Fire',
        severity: 'Medium',
        texts: [
            "Heavy smoke seen billowing out of a brownstone in {sector}. Looks like a grease fire started in a kitchen.",
            "Transformer explosion near electrical substation in {sector}. Sparking and small ground fires reported.",
            "Dumpster fire spreading to nearby construction fence in {sector}. Calling 911 now!"
        ]
    },
    {
        category: 'Fire',
        severity: 'High',
        texts: [
            "Major fire alert! Commercial building in {sector} is completely engulfed in flames. Black smoke covering the sky.",
            "Park brush fire moving rapidly near the dry lawn borders of {sector}. Wind is pushing it towards streets!",
            "Gas leak ignited at a restaurant in {sector}. Multiple alarms sounding, flames breaking through windows."
        ]
    },
    {
        category: 'Fire',
        severity: 'Low',
        texts: [
            "Small trash can fire at the corner park in {sector}. Smells like burning plastic.",
            "Minor street wire fire reported in {sector}. It is tiny but needs putting out before it grows.",
            "Barbecue grill fire got out of control on a balcony in {sector}. Smoke is clearing but needs checking."
        ]
    },

    // --- MEDICAL INCIDENTS ---
    {
        category: 'Medical',
        severity: 'Medium',
        texts: [
            "Elderly man collapsed on the sidewalk in {sector}. Appears to be conscious but very weak. Heat stroke?",
            "Cyclist knocked over by car doors opening in {sector}. Leg injury, unable to stand, waiting for EMS.",
            "Construction worker fell from scaffolding in {sector}. He is awake but complaining of severe back pain."
        ]
    },
    {
        category: 'Medical',
        severity: 'High',
        texts: [
            "Urgent! Someone is having severe chest pain and difficulty breathing inside a shop in {sector}.",
            "Pedestrian struck by a speeding taxi in {sector}. Casualty is unconscious, bleeding from head. Send help ASAP!",
            "Severe allergic reaction reported at the food court in {sector}. Individual has trouble swallowing, no EpiPen."
        ]
    },
    {
        category: 'Medical',
        severity: 'Low',
        texts: [
            "Child slipped on wet pavement in {sector} and scraped elbow badly. Bleeding is minor but parents are panicked.",
            "Dehydrated runner sitting by the trail in {sector}, feels dizzy and nauseous. Needs some medical checks.",
            "Person cut their hand opening a metal crate in {sector}. Clean cut but bleeding steadily."
        ]
    },

    // --- POLICE INCIDENTS ---
    {
        category: 'Police',
        severity: 'Medium',
        texts: [
            "Break-in in progress! Witnessed a suspect breaking the side window of a boutique in {sector}.",
            "Road rage incident turning violent in {sector}. Drivers are shouting and pushing in the middle of traffic.",
            "Shoplifter caught by security at the market in {sector}, but suspect is resisting and trying to flee."
        ]
    },
    {
        category: 'Police',
        severity: 'High',
        texts: [
            "Bank alarm going off in {sector}! Seeing masked individuals running inside with bags. Armed robbery!",
            "Shots fired! Heard 3-4 gunshots near the subway entrance in {sector}. People are running for cover!",
            "Suspicious unattended briefcase left right next to the local power station in {sector}. Looks highly dangerous."
        ]
    },
    {
        category: 'Police',
        severity: 'Low',
        texts: [
            "Loud house party in {sector} playing music at 2 AM. Neighbor dispute brewing.",
            "Graffiti taggers active right now on the brick wall in {sector}. Two teens wearing hoodies.",
            "Suspicious individual checking car door handles in the parking lot in {sector}."
        ]
    },

    // --- MULTI-AGENCY INCIDENTS (FIRE + MEDICAL) ---
    {
        category: 'Fire-Medical',
        severity: 'High',
        texts: [
            "Huge explosion in {sector}! Building boiler burst, fire spreading and multiple residents are injured and trapped!",
            "Chemical spill inside laboratory in {sector} has ignited a fire. Workers are coughing and showing signs of chemical inhalation.",
            "Apartment fire in {sector} with thick smoke. Neighbors say an elderly couple is still inside the bedroom."
        ]
    },

    // --- MULTI-AGENCY INCIDENTS (POLICE + MEDICAL) ---
    {
        category: 'Police-Medical',
        severity: 'High',
        texts: [
            "Active robbery in {sector} gone wrong. A shopkeeper was shot. Suspect fled, victim bleeding out!",
            "Major fight broke out outside a club in {sector}. Several injured people on the ground, weapons involved.",
            "Stabbing incident reported in the alleyway of {sector}. Victim is conscious but has lost a lot of blood."
        ]
    },

    // --- MULTI-AGENCY INCIDENTS (FIRE + POLICE) ---
    {
        category: 'Fire-Police',
        severity: 'High',
        texts: [
            "Arson spotted! Witness saw a group deliberately lighting fires near the warehouse district in {sector}.",
            "Violent protest in {sector} has escalated. Demonstrators are blocking roads and lighting trash bins on fire.",
            "Suspicious gas smell in {sector}. Police need to evacuate the block, Fire crew is investigating the source."
        ]
    },

    // --- MULTI-AGENCY INCIDENTS (FIRE + POLICE + MEDICAL) ---
    {
        category: 'All',
        severity: 'Critical',
        texts: [
            "CRITICAL ALERT: Multi-vehicle pileup in {sector}. Fuel truck exploded! Multiple cars burning, casualties trapped in wreckage!",
            "Structure collapse at a construction site in {sector} following a gas leak explosion. Building is on fire, police cordoning off, many injured!",
            "Active shooter incident in {sector} has sparked a fire inside the retail store due to shot fuel canisters. Casualties reported."
        ]
    }
];

function generateRandomTweet() {
    const username = USERNAMES[Math.floor(Math.random() * USERNAMES.length)];
    const template = INCIDENT_TEMPLATES[Math.floor(Math.random() * INCIDENT_TEMPLATES.length)];
    
    // Choose a random sector
    const sectorKeys = Object.keys(SECTORS);
    const sectorKey = sectorKeys[Math.floor(Math.random() * sectorKeys.length)];
    const sectorVal = SECTORS[sectorKey];
    
    // Select text template and insert sector
    const textTemplate = template.texts[Math.floor(Math.random() * template.texts.length)];
    const text = textTemplate.replace('{sector}', sectorKey);
    
    // Calculate random coordinate inside sector bounds
    const lat = Math.random() * (sectorVal.latRange[1] - sectorVal.latRange[0]) + sectorVal.latRange[0];
    const lng = Math.random() * (sectorVal.lngRange[1] - sectorVal.lngRange[0]) + sectorVal.lngRange[0];
    
    return {
        id: 'twt-' + Math.random().toString(36).substr(2, 9),
        username: username,
        text: text,
        timestamp: new Date().toLocaleTimeString(),
        mockRawData: {
            detectedSector: sectorKey,
            x: lat, // mapping x to lat
            y: lng, // mapping y to lng
            reportedCategory: template.category,
            reportedSeverity: template.severity
        }
    };
}

// Make it available on window object
window.MockTwitterFeed = {
    generateRandomTweet: generateRandomTweet,
    sectors: SECTORS
};
