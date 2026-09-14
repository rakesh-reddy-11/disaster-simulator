# AEGIS RESPONSE

A collaborative multi-agent disaster response simulator built as a browser-based operations dashboard. The project models emergency coordination for fire, medical, and police departments using a live map, incident tracking, vehicle dispatch, agent communication, and social-media-style report ingestion.

## Features

- Live disaster reporting from simulated social media posts
- Shared situational awareness board for active incidents
- Multi-agent coordination between fire, medical, and police units
- Fleet monitoring and dispatch simulation
- Incident severity and response tracking
- Map-based visualization using Leaflet
- Audit log and inter-agent communication terminal

## Project Structure

- `index.html` — main dashboard layout
- `app.js` — UI orchestration and event handling
- `agents.js` — triage and department agents
- `simulator.js` — map, fleet, and routing engine
- `tweets.js` — sample disaster reports
- `style.css` — dashboard styling

## Run locally

Open `index.html` in a browser, or serve the folder with a local web server:

```bash
cd "C:/Users/srake/OneDrive/Desktop/disaster_simulator"
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## GitHub publish

1. Create a new repository on GitHub.
2. In the project folder, run:

```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

Replace `USERNAME` and `REPO_NAME` with your actual GitHub account and repository name.
